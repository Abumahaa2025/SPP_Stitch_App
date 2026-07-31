"""Synthesize month-linked rent rolls from portfolio + filenames when file content unavailable."""

from __future__ import annotations

from typing import Any, Dict, List

from .intake_classifier import FileClassification, classify_file, extract_month, extract_year


def _prop_name(ctx: dict, property_id: str) -> str:
    for p in ctx.get("properties") or []:
        if p.get("id") == property_id:
            return p.get("name") or property_id
    return property_id


def _expand_roster(ctx: dict) -> List[dict]:
    """Baseline tenant roster from live portfolio + realistic vacant slots."""
    roster: List[dict] = []
    tenants_by_prop: Dict[str, List[dict]] = {}
    for t in ctx.get("tenants") or []:
        tenants_by_prop.setdefault(t.get("property_id") or "", []).append(t)

    extras = [
        {"unit": "601", "name": "خالد الحربي", "rent": 9800, "property_id": "prop_b1", "phone": "0501112233"},
        {"unit": "702", "name": "نورة السالم", "rent": 11200, "property_id": "prop_b1", "phone": "0502223344"},
        {"unit": "903", "name": "عبدالله القحطاني", "rent": 10500, "property_id": "prop_b1", "phone": "0503334455"},
        {"unit": "G-01", "name": "محل أزياء نور", "rent": 18000, "property_id": "prop_b2", "phone": "0504445566"},
    ]
    seen_units = set()

    for t in ctx.get("tenants") or []:
        u = str(t.get("unit") or t.get("id"))
        seen_units.add(u)
        roster.append(
            {
                "unit": u,
                "tenant": t.get("name") or "مستأجر",
                "rent": float(t.get("rent") or t.get("monthly_rent") or 10000),
                "phone": t.get("phone") or "",
                "contract": t.get("contract_id") or "",
                "property": _prop_name(ctx, t.get("property_id") or ""),
                "property_id": t.get("property_id"),
            }
        )

    for e in extras:
        if e["unit"] not in seen_units:
            roster.append(
                {
                    "unit": e["unit"],
                    "tenant": e["name"],
                    "rent": e["rent"],
                    "phone": e["phone"],
                    "contract": "",
                    "property": _prop_name(ctx, e["property_id"]),
                    "property_id": e["property_id"],
                }
            )

    return roster


def _month_scenario(month: int, roster: List[dict]) -> List[dict]:
    """Deterministic lifecycle mutations Jan–Jun mirroring real property manager patterns."""
    rows: List[dict] = []
    for base in roster:
        unit = base["unit"]
        tenant = base["tenant"]
        rent = base["rent"]
        include = True
        is_paid = True
        is_late = False

        # 702 نورة — تغادر في أبريل
        if unit == "702" and month >= 4:
            include = False
        # 601 — شاغرة يناير–فبراير، خالد من مارس
        if unit == "601" and month < 3:
            include = False
        # 805 محمد — متأخر مايو–يونيو (من portfolio)
        if unit == "805" and month >= 5:
            is_paid = False
            is_late = True
        # G-02 شركة أفق — متأخر من شهر 4
        if unit == "G-02" and month >= 4:
            is_paid = month == 4  # سدّد أبريل جزئياً في التحليل
            is_late = not is_paid

        if not include:
            continue

        rows.append(
            {
                "unit": unit,
                "tenant": tenant,
                "rent": rent,
                "phone": base.get("phone", ""),
                "contract": base.get("contract", ""),
                "property": base.get("property", ""),
                "is_paid": is_paid,
                "is_late": is_late,
                "pay_status": "مسدد" if is_paid else "متأخر — لم يسدد",
            }
        )

    # 702 — مستأجر جديد من مايو (بعد مغادرة نورة)
    if month >= 5:
        rows.append(
            {
                "unit": "702",
                "tenant": "ريم الشمري",
                "rent": 11500,
                "phone": "0505556677",
                "contract": "CT-702-2026",
                "property": "برج النخيل السكني",
                "is_paid": True,
                "is_late": False,
                "pay_status": "مسدد · بنك",
            }
        )

    return rows


def _default_expense_rows(month: int) -> List[dict]:
    catalog = {
        1: [
            {"description": "صيانة مصعد — برج النخيل", "unit": "برج النخيل", "amount": 4200, "category": "صيانة"},
            {"description": "تكييف مركزي — G-02", "unit": "G-02", "amount": 2800, "category": "صيانة"},
        ],
        2: [
            {"description": "دهان واجهة — برج النخيل", "unit": "برج النخيل", "amount": 6500, "category": "صيانة"},
        ],
        3: [
            {"description": "سباكة — وحدة 601", "unit": "601", "amount": 950, "category": "صيانة"},
            {"description": "تأمين — مجمع الواحة", "unit": "G-02", "amount": 3200, "category": "إدارية"},
        ],
        4: [
            {"description": "صيانة تكييف — G-02", "unit": "G-02", "amount": 2800, "category": "صيانة"},
            {"description": "صيانة تكييف — G-02", "unit": "G-02", "amount": 1500, "category": "صيانة"},
        ],
        5: [
            {"description": "تنظيف خزان — فيlla الريف", "unit": "فيلا", "amount": 1800, "category": "صيانة"},
            {"description": "كهرباء مشاع — برج النخيل", "unit": "برج النخيل", "amount": 5400, "category": "خدمات"},
        ],
        6: [
            {"description": "صيانة باب — 805", "unit": "805", "amount": 650, "category": "صيانة"},
            {"description": "مكافحة حشرات — 903", "unit": "903", "amount": 420, "category": "صيانة"},
        ],
    }
    return catalog.get(month, catalog.get(6, []))


def synthesize_from_files(files: List[dict], ctx: dict) -> dict:
    """Build parsed_rolls + expense_rolls from filenames + portfolio context."""
    roster = _expand_roster(ctx)
    parsed_rolls: List[dict] = []
    expense_rolls: List[dict] = []
    classifications: List[FileClassification] = []

    rent_files: List[tuple] = []
    expense_files: List[tuple] = []

    for f in files:
        cls = classify_file(f)
        classifications.append(cls)
        month = cls.month or extract_month(cls.name)
        year = cls.year or extract_year(cls.name)
        if cls.doc_type in ("rent_roll", "comprehensive"):
            rent_files.append((month or len(rent_files) + 1, year, cls.name, f))
        elif cls.doc_type in ("maintenance", "expense"):
            expense_files.append((month or len(expense_files) + 1, year, cls.name, f))

    if not rent_files:
        for i in range(1, 7):
            rent_files.append((i, 2026, f"كشف_شهر_{i}.xlsx", {"name": f"كشف_شهر_{i}.xlsx"}))

    rent_files.sort(key=lambda x: (x[1], x[0]))
    used_months = set()
    for month, year, fname, _ in rent_files:
        m = month if month else 1
        while m in used_months and m < 12:
            m += 1
        used_months.add(m)
        rows = _month_scenario(m, roster)
        parsed_rolls.append(
            {
                "ok": True,
                "rows": rows,
                "row_count": len(rows),
                "month": m,
                "year": year,
                "file_name": fname,
                "synthetic": True,
            }
        )

    if not expense_files:
        expense_files = [(6, 2026, "كشف_صيانة_ومصروفات.xlsx", {})]

    for month, year, fname, _ in expense_files:
        m = month or 6
        erows = _default_expense_rows(m)
        if not erows and parsed_rolls:
            m = parsed_rolls[-1].get("month") or 6
            erows = _default_expense_rows(m)
        total = sum(r["amount"] for r in erows)
        expense_rolls.append(
            {
                "ok": total > 0,
                "rows": erows,
                "total": total,
                "file_name": fname,
                "row_count": len(erows),
                "month": m,
                "year": year,
                "synthetic": True,
            }
        )

    return {
        "parsed_rolls": parsed_rolls,
        "expense_rolls": expense_rolls,
        "classifications": classifications,
        "synthetic": True,
    }
