"""Map free-text labels from any language into canonical enums."""

from __future__ import annotations

from typing import Optional

from adapters.normalize.dates import days_until
from adapters.normalize.text import clean_text

# (canonical_value, keyword fragments — matched case-insensitively)
_CONTRACT_KEYWORDS = [
    ("expired", ("expired", "منته", "ended", "lapsed", "past due")),
    ("expiring", ("expir", "renew", "قريب", "ending", "due soon", "soon")),
    ("renewed", ("renewed", "تجديد", "extended", "جدد")),
    ("active", ("active", "نشط", "valid", "current", "ساري")),
]

_PAYMENT_KEYWORDS = [
    ("late", ("late", "overdue", "متأخر", "unpaid", "لم يسدد", "delinquent", "past due")),
    ("current", ("paid", "current", "on time", "سدد", "collected", "ok")),
]

_PRIORITY_KEYWORDS = [
    ("critical", ("critical", "urgent", "حرج", "عاجل", "emergency")),
    ("high", ("high", "عالي", "important")),
    ("medium", ("medium", "متوسط", "normal")),
    ("low", ("low", "منخفض", "watch")),
]

_MAINT_CLOSED_KEYWORDS = ("complete", "closed", "done", "resolved", "مكتمل", "منجز", "cancelled")


def _match_keywords(text: str, table: list[tuple[str, tuple[str, ...]]], default: str) -> str:
    low = text.lower()
    for canonical, keys in table:
        if any(k in low for k in keys):
            return canonical
    return default


def contract_status(
    *labels: object,
    days_left: Optional[float] = None,
    expiring_within_days: int = 45,
) -> str:
    text = " ".join(clean_text(x) for x in labels if clean_text(x))
    if days_left is not None:
        if days_left < 0:
            return "expired"
        if days_left <= expiring_within_days:
            return "expiring"
    return _match_keywords(text, _CONTRACT_KEYWORDS, "active")


def payment_status(*labels: object) -> str:
    text = " ".join(clean_text(x) for x in labels if clean_text(x))
    return _match_keywords(text, _PAYMENT_KEYWORDS, "unknown")


def priority_level(*labels: object) -> str:
    text = " ".join(clean_text(x) for x in labels if clean_text(x))
    return _match_keywords(text, _PRIORITY_KEYWORDS, "medium")


def maintenance_status(*labels: object) -> str:
    text = " ".join(clean_text(x) for x in labels if clean_text(x)).lower()
    if any(k in text for k in _MAINT_CLOSED_KEYWORDS):
        return "closed"
    return "open"


def contract_status_from_expiry(expiry_iso: Optional[str], expiring_within_days: int = 45) -> str:
    days = days_until(expiry_iso)
    if days is None:
        return "active"
    return contract_status(days_left=days, expiring_within_days=expiring_within_days)
