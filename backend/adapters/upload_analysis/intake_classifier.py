"""Property-specific document classification — rent, maintenance, expense, contract, comprehensive."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import List, Literal, Optional

DocType = Literal[
    "rent_roll",
    "maintenance",
    "expense",
    "contract",
    "receipt",
    "invoice",
    "comprehensive",
    "document",
    "unknown",
]

MONTH_AR = {
    "يناير": 1,
    "january": 1,
    "jan": 1,
    "فبراير": 2,
    "february": 2,
    "feb": 2,
    "مارس": 3,
    "march": 3,
    "mar": 3,
    "أبريل": 4,
    "ابريل": 4,
    "april": 4,
    "apr": 4,
    "مايو": 5,
    "may": 5,
    "يونيو": 6,
    "june": 6,
    "jun": 6,
    "يوليو": 7,
    "july": 7,
    "jul": 7,
    "أغسطس": 8,
    "august": 8,
    "aug": 8,
    "سبتمبر": 9,
    "september": 9,
    "sep": 9,
    "أكتوبر": 10,
    "october": 10,
    "oct": 10,
    "نوفمبر": 11,
    "november": 11,
    "nov": 11,
    "ديسمبر": 12,
    "december": 12,
    "dec": 12,
}

MONTH_LABEL_AR = {
    1: "يناير",
    2: "فبراير",
    3: "مارس",
    4: "أبريل",
    5: "مايو",
    6: "يونيو",
    7: "يوليو",
    8: "أغسطس",
    9: "سبتمبر",
    10: "أكتوبر",
    11: "نوفمبر",
    12: "ديسمبر",
}

MONTH_LABEL_EN = {
    1: "Jan",
    2: "Feb",
    3: "Mar",
    4: "Apr",
    5: "May",
    6: "Jun",
    7: "Jul",
    8: "Aug",
    9: "Sep",
    10: "Oct",
    11: "Nov",
    12: "Dec",
}


@dataclass
class FileClassification:
    name: str
    doc_type: DocType
    doc_type_label_ar: str
    doc_type_label_en: str
    confidence: int
    month: int
    year: int
    unit: str
    reasons: List[str]


def _norm(s: str) -> str:
    # Strip Arabic tatweel/kashida so «الاســــم» matches «اسم»
    s = (s or "").replace("\u0640", "")
    return re.sub(r"\s+", " ", s.strip().lower())


def extract_year(name: str, default: int = 2026) -> int:
    m = re.search(r"(20\d{2})", name or "")
    return int(m.group(1)) if m else default


def extract_month(name: str) -> int:
    raw = _norm(name)
    for label, num in MONTH_AR.items():
        if label in raw:
            return num
    m = re.search(r"شهر[\s._-]*(\d{1,2})", raw)
    if m:
        v = int(m.group(1))
        if 1 <= v <= 12:
            return v
    m = re.search(r"month[\s._-]*(\d{1,2})", raw)
    if m:
        v = int(m.group(1))
        if 1 <= v <= 12:
            return v
    m = re.search(r"[\s._-](0?[1-9]|1[0-2])[\s._-](?:20\d{2}|xlsx|xls|csv)", raw)
    if m:
        return int(m.group(1))
    m = re.search(r"[\s._-](0?[1-9]|1[0-2])[\s._-]?$", raw)
    if m:
        return int(m.group(1))
    return 0


def extract_unit(name: str) -> str:
    m = re.search(r"(?:unit|وحدة|شقة|محل|office|apt)[\s._-]*([a-z0-9\-]+)", _norm(name), re.I)
    if m:
        return m.group(1).upper()
    m = re.search(r"\b(\d{3,4}[a-z]?|g-?\d+)\b", _norm(name), re.I)
    return m.group(1).upper() if m else ""


def classify_file(file_meta: dict, lang: str = "ar") -> FileClassification:
    name = file_meta.get("name") or file_meta.get("fileName") or ""
    mime = file_meta.get("mimeType") or file_meta.get("mime") or ""
    snippet = _norm(file_meta.get("textSnippet") or file_meta.get("contentPreview") or "")
    hint = f"{_norm(name)} { _norm(mime)} {snippet[:500]}"

    doc_type: DocType = "unknown"
    confidence = 45
    reasons: List[str] = []

    name_hint = _norm(name)
    # Monthly rent rolls often embed electricity «فاتورة» columns — name+شهر wins over expense.
    looks_like_monthly_rent = bool(
        re.search(r"(?:كشف|roll|شكشف)", name_hint)
        and re.search(r"(?:شهر|month)", name_hint)
        and not re.search(r"(?:صيان|صيانه|صيانة|maint|repair|مصروف)", name_hint)
    )
    has_rent_columns = bool(
        re.search(
            r"(?:رقم الشقة|ايجار الشقه|ايجار الشقة|قيمه الايجار|قيمة الإيجار|مستأجر|رق.?م ال.?عقد|rent roll|tenant name)",
            snippet[:800],
        )
    )
    # Maintenance/expense columns — must beat rent even if snippet has «فاتورة» / «وحدة».
    name_is_maintenance = bool(re.search(r"(?:صيان|صيانه|صيانة|maint|repair)", name_hint))
    has_maintenance_columns = bool(
        re.search(
            r"(?:رقم الطلب|نوع العطل|تكلفة الصيان|تكلفة الصيانة|نوع المصروف|الجهة الدافع|الفني|work.?order)",
            snippet[:900],
        )
    )
    rent_signals = looks_like_monthly_rent or (has_rent_columns and not has_maintenance_columns)

    if name_is_maintenance or has_maintenance_columns:
        doc_type = "maintenance"
        confidence = 94 if name_is_maintenance and has_maintenance_columns else 90
        reasons.append("صيانة ومصروفات")
    elif rent_signals or (
        re.search(r"(?:كشف|roll|rent.?roll|إيجار|ايجار|تحصيل|rent)", hint)
        and re.search(
            r"(?:شهر|month|يناير|فبر|مار|أب|مايو|يون|excel|xlsx|xls|\d[\s._-]*20\d{2})",
            hint,
        )
        and not name_is_maintenance
    ):
        doc_type = "rent_roll"
        confidence = 92 if looks_like_monthly_rent else 90
        reasons.append("كشف إيجارات شهري")
    elif re.search(r"(?:مصروف|expense|مصاريف)", hint) or (
        re.search(r"(?:فاتورة|invoice)", hint)
        and not rent_signals
        and not re.search(r"(?:إيجار|ايجار|rent roll|كشف إيجار|كشف شهر)", hint)
    ):
        doc_type = "expense"
        confidence = 84
        reasons.append("كشف مصروفات")
    elif re.search(r"(?:كشف شامل|comprehensive|ملخص|portfolio|محفظة)", hint):
        doc_type = "comprehensive"
        confidence = 88
        reasons.append("كشف شامل")
    elif re.search(r"(?:كشف|roll|إيجار|ايجار|rent)", hint) and not name_is_maintenance:
        doc_type = "rent_roll"
        confidence = 74
        reasons.append("كشف إيجارات محتمل")
    elif re.search(r"(?:عقد|contract|lease)", hint):
        doc_type = "contract"
        confidence = 85
        reasons.append("عقد إيجار")
    elif re.search(r"(?:سند|receipt|إيصال|سداد|paid)", hint):
        doc_type = "receipt"
        confidence = 82
        reasons.append("سند سداد")
    elif re.search(r"(?:صيانة|maint|repair)", hint):
        doc_type = "maintenance"
        confidence = 78
        reasons.append("سجل صيانة")
    elif name.lower().endswith((".xlsx", ".xls", ".csv")):
        doc_type = "rent_roll"
        confidence = 62
        reasons.append("جدول — يُعامل ككشف إيجار حتى التحقق")

    month = extract_month(name) or int(file_meta.get("month") or 0)
    year = extract_year(name) or int(file_meta.get("year") or 2026)
    unit = extract_unit(name)

    if doc_type == "rent_roll" and month:
        confidence = min(95, confidence + 6)
        reasons.append(f"شهر {month}/{year}")

    labels_ar = {
        "rent_roll": "كشف إيجارات",
        "maintenance": "صيانة ومصروفات",
        "expense": "كشف مصروفات",
        "contract": "عقد",
        "receipt": "سند سداد",
        "invoice": "فاتورة",
        "comprehensive": "كشف شامل",
        "document": "مستند",
        "unknown": "غير مصنّف",
    }
    labels_en = {
        "rent_roll": "Rent roll",
        "maintenance": "Maintenance & expenses",
        "expense": "Expense sheet",
        "contract": "Contract",
        "receipt": "Receipt",
        "invoice": "Invoice",
        "comprehensive": "Comprehensive statement",
        "document": "Document",
        "unknown": "Unclassified",
    }

    return FileClassification(
        name=name,
        doc_type=doc_type,
        doc_type_label_ar=labels_ar[doc_type],
        doc_type_label_en=labels_en[doc_type],
        confidence=confidence,
        month=month,
        year=year,
        unit=unit,
        reasons=reasons,
    )


def month_label(month: int, lang: str) -> str:
    if lang == "ar":
        return MONTH_LABEL_AR.get(month, str(month))
    return MONTH_LABEL_EN.get(month, str(month))
