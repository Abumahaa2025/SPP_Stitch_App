"""Professional Arabic copy helpers for Brain (briefing + verdicts)."""

from __future__ import annotations

import re
from datetime import date, datetime, timezone
from typing import Dict, List, Optional

_NEG_DAYS_RE = re.compile(r"(?:in\s+)?-(\d+)\s*(?:days?|يوم)", re.IGNORECASE)
_OUTSTANDING_RE = re.compile(
    r"Outstanding\s*≈\s*([\d,]+)\s*per month\.?", re.IGNORECASE
)
_LATE_RENT_TITLE_RE = re.compile(r"Late rent\s*—\s*(.+)", re.IGNORECASE)
_RENEWAL_TITLE_RE = re.compile(r"Contract renewal\s*—\s*(.+)", re.IGNORECASE)
_LEGACY_EXPIRY_RE = re.compile(r"منتهي منذ\s+\d+\s+يوم")
_LEGACY_SOON = "قريب من الانتهاء"
_LEGACY_FAR = re.compile(r"ينتهي بعد\s+\d+\s+يوم")
_PHONE_RE = re.compile(r"\+?\d{9,14}")
_RAW_CONTACT_RE = re.compile(r"ابومها\s*[—\-–]\s*", re.IGNORECASE)


def days_until(end: str) -> Optional[int]:
    if not end:
        return None
    try:
        end_date = datetime.strptime(str(end)[:10], "%Y-%m-%d").date()
        return (end_date - date.today()).days
    except ValueError:
        return None


def contract_renewal_guidance(days: Optional[int]) -> str:
    """Decision-oriented renewal guidance — no raw day counts."""
    if days is None:
        return "حدّد تاريخ انتهاء العقد ثم ضع خطة تجديد."
    if days < 0:
        if abs(days) > 90:
            return "العقد متأخر عن التجديد منذ فترة طويلة ويحتاج متابعة فورية."
        return "العقد منتهٍ ويحتاج تجديداً فورياً."
    if days == 0:
        return "يُنصح بإتمام التجديد اليوم."
    if 1 <= days <= 30:
        return "يُنصح ببدء إجراءات التجديد الآن."
    return "لا يحتاج إجراء حاليًا، ويُعاد تقييمه قبل شهر من الانتهاء."


def contract_renewal_action(days: Optional[int]) -> str:
    """What the property manager should do now."""
    if days is None:
        return "راجع بيانات العقد وحدّد موعد التجديد"
    if days < 0:
        return "اتصل بالمستأجر وافتح ملف التجديد فوراً"
    if days == 0:
        return "أكمل التجديد اليوم"
    if 1 <= days <= 30:
        return "ابدأ إجراءات التجديد الآن"
    return "لا إجراء الآن — ضع تذكيراً قبل الشهر الأخير"


def contract_expiry_phrase(days: Optional[int]) -> str:
    return contract_renewal_guidance(days)


def contract_expiry_from_end(end: str) -> str:
    return contract_renewal_guidance(days_until(end))


def contract_action_from_end(end: str) -> str:
    return contract_renewal_action(days_until(end))


def contract_sort_key(end: str) -> int:
    days = days_until(end)
    return days if days is not None else 999_999


def salutation_ar() -> str:
    hour = datetime.now(timezone.utc).hour
    if hour < 12:
        return "صباح الخير"
    return "مساء الخير"


def fmt_money_ar(amount: float) -> str:
    if amount >= 1_000_000:
        return f"{amount / 1_000_000:.1f} مليون"
    if amount >= 1_000:
        return f"{amount / 1_000:.0f} ألف"
    return f"{amount:,.0f}"


def sanitize_brain_text(text: str) -> str:
    if not text:
        return ""
    out = _NEG_DAYS_RE.sub(
        "العقد متأخر عن التجديد منذ فترة طويلة ويحتاج متابعة فورية.",
        str(text),
    )
    out = _LEGACY_EXPIRY_RE.sub(
        "العقد متأخر عن التجديد منذ فترة طويلة ويحتاج متابعة فورية.",
        out,
    )
    out = _LEGACY_FAR.sub(
        "لا يحتاج إجراء حاليًا، ويُعاد تقييمه قبل شهر من الانتهاء.",
        out,
    )
    out = out.replace(_LEGACY_SOON, "يُنصح ببدء إجراءات التجديد الآن.")
    out = _OUTSTANDING_RE.sub(
        lambda m: f"مستحقات شهرية ≈ {m.group(1)} ريال", out
    )
    out = _RAW_CONTACT_RE.sub("", out)
    out = _PHONE_RE.sub("", out)
    out = re.sub(r"\s{2,}", " ", out).strip(" —-·")
    return out.strip()


def _contract_for_property(contracts: List[dict], property_id: Optional[str]) -> Optional[dict]:
    if not property_id:
        return None
    for contract in contracts:
        if contract.get("property_id") == property_id:
            return contract
    return None


def decision_title_ar(decision: dict) -> str:
    title = str(decision.get("title") or "")
    kind = decision.get("kind")
    if kind == "financial":
        match = _LATE_RENT_TITLE_RE.match(title)
        unit = match.group(1).strip() if match else title
        return sanitize_brain_text(f"حصّل إيجار {unit}")
    if kind == "tenant":
        match = _RENEWAL_TITLE_RE.match(title)
        subject = match.group(1).strip() if match else title
        return sanitize_brain_text(f"جدّد عقد {subject}")
    if kind == "maintenance":
        return sanitize_brain_text(title or "عالج بلاغ الصيانة")
    if kind == "opportunity":
        return sanitize_brain_text(title or "نفّذ فرصة التحسين")
    return sanitize_brain_text(title or "اتخذ قراراً")


def decision_detail_ar(decision: dict, contracts: List[dict]) -> str:
    kind = decision.get("kind")

    if kind == "financial":
        match = _OUTSTANDING_RE.search(str(decision.get("impact") or ""))
        if match:
            amount = float(match.group(1).replace(",", ""))
            return f"تابع التحصيل اليوم — مستحقات {fmt_money_ar(amount)} ريال."
        reason = sanitize_brain_text(str(decision.get("reason") or ""))
        return reason or "أرسل تذكيراً واستكمل التحصيل خلال ٢٤ ساعة."

    if kind == "tenant":
        contract = _contract_for_property(contracts, decision.get("property_id"))
        if contract:
            return contract_renewal_guidance(days_until(contract.get("end", "")))
        return "ضع خطة تجديد وتواصل مع المستأجر هذا الأسبوع."

    if kind == "maintenance":
        reason = sanitize_brain_text(str(decision.get("reason") or ""))
        if reason:
            return f"عيّن معالجة للبلاغ — {reason}."
        return "عيّن فنياً وحدد موعد المعالجة."

    reason = sanitize_brain_text(str(decision.get("reason") or ""))
    impact = sanitize_brain_text(str(decision.get("impact") or ""))
    return impact or reason or "راجع التفاصيل واتخذ قراراً."


def decision_action_ar(decision: dict) -> str:
    kind = decision.get("kind")
    if kind == "financial":
        return "أرسل تذكير تحصيل وتابع خلال ٢٤ ساعة"
    if kind == "tenant":
        return "جهّز عرض التجديد وتواصل مع المستأجر"
    if kind == "maintenance":
        return "عيّن فنياً وحدد موعد المعالجة"
    raw = sanitize_brain_text(str(decision.get("recommended_action") or ""))
    if raw and not raw.lower().startswith("review"):
        return raw[:120]
    return "راجع التفاصيل واتخذ قراراً"


def polish_decision(decision: dict, contracts: List[dict]) -> dict:
    polished = dict(decision)
    polished["title"] = decision_title_ar(decision)
    polished["reason"] = decision_detail_ar(decision, contracts)
    polished["impact"] = polished["reason"]
    polished["recommended_action"] = decision_action_ar(decision)
    return polished


def polish_decisions(decisions: List[dict], contracts: List[dict], limit: int = 4) -> List[dict]:
    return [polish_decision(d, contracts) for d in decisions[:limit]]


def renewal_headline(subject: str, days: Optional[int]) -> str:
    name = subject or "العقد"
    if days is not None and days < 0:
        return f"جدّد عقد {name} فوراً"
    if days is not None and days <= 30:
        return f"ابدأ تجديد {name}"
    return f"لا أولوية حالية لـ {name}"
