"""Deep property statement intake — classify, parse, link months, lifecycle."""

from __future__ import annotations

import re
from typing import Any, Dict, List

from .intake_classifier import classify_file
from .intake_lifecycle import (
    build_annual_stats,
    build_lifecycle,
    build_late_payments_by_month,
    build_monthly_index,
    build_tenant_payment_ledger,
    build_unique_unit_stats,
    costliest_units,
    find_late_tenants,
    maintenance_frequency,
)
from .intake_parser import parse_expense_text, parse_rent_roll_text, align_ambiguous_units_across_parsed_rolls


def _is_rent_file(f: dict, cls) -> bool:
    name = (f.get("name") or "").lower()
    if cls.doc_type in ("rent_roll", "comprehensive"):
        return True
    return bool(
        re.search(r"(?:كشف|rent|إيجار|roll)", name)
        and not re.search(r"(?:صيان|مصروف|expense|maint)", name)
    )


def _is_expense_file(cls) -> bool:
    return cls.doc_type in ("maintenance", "expense")


def analyze_statements_deep(files: List[dict], ctx: dict) -> dict:
    parsed_rolls: List[dict] = []
    expense_rolls: List[dict] = []
    parse_errors: List[dict] = []
    files_without_content: List[dict] = []
    file_classifications: List[dict] = []

    for f in files:
        cls = classify_file(f)
        snippet = str(f.get("textSnippet") or f.get("contentPreview") or "")
        file_classifications.append(
            {
                "name": cls.name,
                "category": cls.doc_type,
                "category_ar": cls.doc_type_label_ar,
                "category_en": cls.doc_type_label_en,
                "confidence": cls.confidence,
                "month": cls.month,
                "year": cls.year,
                "reasons": cls.reasons,
            }
        )

        if _is_expense_file(cls) and len(snippet) > 10:
            exp = parse_expense_text(snippet, f)
            if exp.get("ok"):
                expense_rolls.append(exp)
            continue

        if _is_rent_file(f, cls) and len(snippet) > 10:
            parsed = parse_rent_roll_text(snippet, f)
            if not parsed.get("month"):
                parsed["month"] = cls.month
            if not parsed.get("year"):
                parsed["year"] = cls.year
            if parsed.get("ok"):
                parsed_rolls.append(parsed)
            else:
                parse_errors.append({"file_name": cls.name, "error": parsed.get("error") or "فشل التحليل"})
        elif (_is_rent_file(f, cls) or (f.get("name") or "").lower().endswith((".xlsx", ".xls", ".csv"))) and len(snippet) <= 10:
            files_without_content.append(
                {
                    "file_name": cls.name,
                    "reason": "لم أقرأ محتوى الملف — أعد الرفع أو جرّب ملفاً أصغر",
                }
            )
        elif len(snippet) > 10 and not _is_expense_file(cls):
            try_parsed = parse_rent_roll_text(snippet, f)
            if try_parsed.get("ok") and try_parsed.get("row_count", 0) > 0:
                if not try_parsed.get("month"):
                    try_parsed["month"] = cls.month
                if not try_parsed.get("year"):
                    try_parsed["year"] = cls.year
                parsed_rolls.append(try_parsed)
            elif try_parsed.get("error"):
                parse_errors.append({"file_name": cls.name, "error": try_parsed.get("error")})

    # Dedupe by month — keep latest file per month
    by_month: Dict[int, dict] = {}
    for pr in sorted(parsed_rolls, key=lambda x: (x.get("year", 0), x.get("month", 0))):
        m = int(pr.get("month") or 0)
        if m:
            by_month[m] = pr
        else:
            by_month[900 + len(by_month)] = pr
    parsed_rolls = list(by_month.values())
    parsed_rolls.sort(key=lambda x: (x.get("year", 0), x.get("month", 0)))
    align_ambiguous_units_across_parsed_rolls(parsed_rolls)

    monthly_index = build_monthly_index(parsed_rolls)
    lifecycle = build_lifecycle(monthly_index)
    annual = build_annual_stats(parsed_rolls, lifecycle)
    unique_stats = build_unique_unit_stats(monthly_index)
    payment_ledger = build_tenant_payment_ledger(parsed_rolls)
    quality_log: List[str] = []
    if payment_ledger.get("merge_count"):
        quality_log.append(f"تم دمج {payment_ledger['merge_count']} سجلًا مكررًا للمستأجر/الشهر.")
    for pe in parse_errors:
        quality_log.append(f"خطأ في {pe.get('file_name')}: {pe.get('error')}")
    for fw in files_without_content:
        quality_log.append(f"لم يُقرأ: {fw.get('file_name')}")
    if expense_rolls:
        exp_sum = sum(float(e.get("total") or 0) for e in expense_rolls)
        annual["expense_from_rolls"] = round(exp_sum)
        annual["maintenance_cost"] = round(exp_sum)

    return {
        "parsed_rolls": parsed_rolls,
        "expense_rolls": expense_rolls,
        "parse_errors": parse_errors,
        "files_without_content": files_without_content,
        "file_classifications": file_classifications,
        "monthly_index": monthly_index,
        "lifecycle": lifecycle,
        "annual": annual,
        "late_tenants": find_late_tenants(parsed_rolls),
        "late_by_month": build_late_payments_by_month(payment_ledger),
        "payment_ledger": payment_ledger,
        "unique_unit_stats": unique_stats,
        "quality_log": quality_log,
        "maintenance_freq": maintenance_frequency(expense_rolls),
        "costliest_units": costliest_units(expense_rolls, parsed_rolls),
        "used_synthetic": False,
    }
