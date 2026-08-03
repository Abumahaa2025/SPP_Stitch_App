"""Koil Action Registry — Layer 3: draft real, professional action content
for EVERY unified decision kind, not just ``contact_late_tenant``.

This is the piece that turns Koil from a read-only recommender into an
employee that can actually *do* the next step: it drafts a channel-ready
message (WhatsApp deep link when a phone number is known), a follow-up
interval, and a short professional rationale — for every kind emitted by
``adapters.decisions.unifier``.

No network calls happen here. This module is pure data-shaping so it is
safe to call from both the deterministic (AI disabled) path and the LLM
agent path.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Dict, Optional
from urllib.parse import quote


# ---------------------------------------------------------------------------
# Follow-up cadence per kind (hours). Mirrors the cadence already used by
# the on-device frontend employee (smart-employee-agent.ts) so the two
# layers stay consistent when they eventually reconcile the same decision.
# ---------------------------------------------------------------------------
FOLLOW_UP_HOURS: Dict[str, int] = {
    "contact_late_tenant": 48,
    "follow_up_departed_tenant": 72,
    "onboard_new_tenant": 24,
    "review_payment_history": 72,
    "investigate_tenant_change": 48,
    "compare_collection_periods": 168,
    "request_missing_lifecycle_data": 72,
    "maintenance": 36,
    "renewal": 72,
    "vacancy": 168,
    "opportunity": 168,
    "tenant": 48,
    "financial": 48,
}

DEFAULT_FOLLOW_UP_HOURS = 72


@dataclass
class ActionContent:
    """The drafted, ready-to-use output of one action."""

    channel: str  # "whatsapp" | "note" | "task"
    message: str
    deep_link: Optional[str] = None
    phone: Optional[str] = None
    follow_up_hours: int = DEFAULT_FOLLOW_UP_HOURS
    summary: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "channel": self.channel,
            "message": self.message,
            "deep_link": self.deep_link,
            "phone": self.phone,
            "follow_up_hours": self.follow_up_hours,
            "summary": self.summary,
        }


def _digits(phone: Any) -> str:
    return "".join(ch for ch in str(phone or "") if ch.isdigit())


def _wa_link(phone: Any, message: str) -> Optional[str]:
    d = _digits(phone)
    if not d:
        return None
    return f"https://wa.me/{d}?text={quote(message)}"


def _fmt_amount(v: Any) -> str:
    try:
        return f"{float(v):,.0f}"
    except (TypeError, ValueError):
        return "0"


def _tenant_and_unit(decision: Dict[str, Any]) -> tuple[str, str]:
    tenant = str(decision.get("tenant_name") or decision.get("tenant") or "").strip() or "المستأجر"
    unit = str(decision.get("unit_label") or decision.get("unit") or "").strip() or "—"
    return tenant, unit


# ---------------------------------------------------------------------------
# One drafting function per unified decision kind.
# Each returns an ActionContent. `phone` is looked up by the caller from
# the confirmed lifecycle/knowledge rows (never invented here).
# ---------------------------------------------------------------------------

def _draft_contact_late_tenant(decision: Dict[str, Any], phone: str, extra: Dict[str, Any]) -> ActionContent:
    tenant, unit = _tenant_and_unit(decision)
    amount = _fmt_amount(extra.get("total_unpaid") or decision.get("financial_impact"))
    months = extra.get("late_month_count") or 0
    msg = (
        f"السلام عليكم {tenant}، نود تذكيركم بمتبقي إيجار وحدة {unit} "
        f"بمبلغ {amount} ر.س عن {months} شهر. يرجى السداد في أقرب وقت. شكراً لكم."
    )
    return ActionContent(
        channel="whatsapp" if phone else "note",
        message=msg,
        deep_link=_wa_link(phone, msg),
        phone=phone or None,
        follow_up_hours=FOLLOW_UP_HOURS["contact_late_tenant"],
        summary=f"تذكير سداد لـ{tenant} — وحدة {unit} — {amount} ر.س",
    )


def _draft_follow_up_departed_tenant(decision: Dict[str, Any], phone: str, extra: Dict[str, Any]) -> ActionContent:
    tenant, unit = _tenant_and_unit(decision)
    msg = (
        f"متابعة مغادرة المستأجر {tenant} من وحدة {unit}: تأكيد تسليم الوحدة، "
        "فحص حالة الوحدة، وتحديث حالة الوحدة إلى شاغرة إن لم يتم ذلك."
    )
    return ActionContent(
        channel="task",
        message=msg,
        follow_up_hours=FOLLOW_UP_HOURS["follow_up_departed_tenant"],
        summary=f"إغلاق ملف مغادرة {tenant} — وحدة {unit}",
    )


def _draft_onboard_new_tenant(decision: Dict[str, Any], phone: str, extra: Dict[str, Any]) -> ActionContent:
    tenant, unit = _tenant_and_unit(decision)
    msg = (
        f"أهلاً {tenant}، مرحباً بك مستأجراً جديداً في وحدة {unit}. "
        "سنرسل لك رابط بوابة المستأجر لمتابعة العقد والدفعات والتواصل معنا مباشرة."
    )
    return ActionContent(
        channel="whatsapp" if phone else "note",
        message=msg,
        deep_link=_wa_link(phone, msg),
        phone=phone or None,
        follow_up_hours=FOLLOW_UP_HOURS["onboard_new_tenant"],
        summary=f"ترحيب وتفعيل بوابة لـ{tenant} — وحدة {unit}",
    )


def _draft_review_payment_history(decision: Dict[str, Any], phone: str, extra: Dict[str, Any]) -> ActionContent:
    tenant, unit = _tenant_and_unit(decision)
    msg = f"مراجعة سجل مدفوعات {tenant} — وحدة {unit}: مقارنة الأشهر الأخيرة وتحديد أي نمط تأخر متكرر."
    return ActionContent(
        channel="task",
        message=msg,
        follow_up_hours=FOLLOW_UP_HOURS["review_payment_history"],
        summary=f"مراجعة سجل دفع {tenant}",
    )


def _draft_investigate_tenant_change(decision: Dict[str, Any], phone: str, extra: Dict[str, Any]) -> ActionContent:
    tenant, unit = _tenant_and_unit(decision)
    msg = f"تحقق من تغيّر المستأجر على وحدة {unit} — تأكيد هوية {tenant} وتحديث العقد إن لزم."
    return ActionContent(
        channel="task",
        message=msg,
        follow_up_hours=FOLLOW_UP_HOURS["investigate_tenant_change"],
        summary=f"تحقق من تغيّر مستأجر — وحدة {unit}",
    )


def _draft_compare_collection_periods(decision: Dict[str, Any], phone: str, extra: Dict[str, Any]) -> ActionContent:
    msg = "مقارنة فترات التحصيل: راجع التقرير المالي للأشهر المتاحة لرصد أي انحراف في التحصيل."
    return ActionContent(
        channel="task",
        message=msg,
        follow_up_hours=FOLLOW_UP_HOURS["compare_collection_periods"],
        summary="مقارنة فترات التحصيل",
    )


def _draft_request_missing_lifecycle_data(decision: Dict[str, Any], phone: str, extra: Dict[str, Any]) -> ActionContent:
    msg = "بيانات ناقصة تمنع اكتمال دورة الحياة — يرجى رفع كشف الإيجار للشهر المفقود لإكمال التحليل."
    return ActionContent(
        channel="task",
        message=msg,
        follow_up_hours=FOLLOW_UP_HOURS["request_missing_lifecycle_data"],
        summary="طلب استكمال بيانات مفقودة",
    )


def _draft_maintenance(decision: Dict[str, Any], phone: str, extra: Dict[str, Any]) -> ActionContent:
    tenant, unit = _tenant_and_unit(decision)
    title = decision.get("title") or "بلاغ صيانة"
    msg = f"متابعة صيانة — وحدة {unit}: {title}. يرجى تعيين فني وتحديد موعد الإصلاح."
    return ActionContent(
        channel="task",
        message=msg,
        follow_up_hours=FOLLOW_UP_HOURS["maintenance"],
        summary=f"متابعة صيانة — وحدة {unit}",
    )


def _draft_renewal(decision: Dict[str, Any], phone: str, extra: Dict[str, Any]) -> ActionContent:
    tenant, unit = _tenant_and_unit(decision)
    msg = (
        f"السلام عليكم {tenant}، عقد وحدة {unit} يقترب من نهايته. "
        "هل ترغبون بالتجديد؟ يسعدنا ترتيب ذلك أو مناقشة شروط جديدة."
    )
    return ActionContent(
        channel="whatsapp" if phone else "note",
        message=msg,
        deep_link=_wa_link(phone, msg),
        phone=phone or None,
        follow_up_hours=FOLLOW_UP_HOURS["renewal"],
        summary=f"تجديد عقد {tenant} — وحدة {unit}",
    )


def _draft_vacancy(decision: Dict[str, Any], phone: str, extra: Dict[str, Any]) -> ActionContent:
    msg = "شواغر تحتاج تسويقاً: راجع سعر السوق للوحدات الشاغرة وابدأ حملة تسويق أو خفّض السعر إن لزم."
    return ActionContent(
        channel="task",
        message=msg,
        follow_up_hours=FOLLOW_UP_HOURS["vacancy"],
        summary="تسويق الوحدات الشاغرة",
    )


def _draft_opportunity(decision: Dict[str, Any], phone: str, extra: Dict[str, Any]) -> ActionContent:
    msg = decision.get("why") or "فرصة تحسين محتملة رُصدت في المحفظة — راجع التفاصيل واتخذ القرار المناسب."
    return ActionContent(
        channel="task",
        message=str(msg),
        follow_up_hours=FOLLOW_UP_HOURS["opportunity"],
        summary="فرصة تحسين محفظة",
    )


def _draft_generic(decision: Dict[str, Any], phone: str, extra: Dict[str, Any]) -> ActionContent:
    title = decision.get("title") or "إجراء مقترح"
    why = decision.get("why") or ""
    msg = f"{title}. {why}".strip()
    return ActionContent(
        channel="task",
        message=msg,
        follow_up_hours=FOLLOW_UP_HOURS.get(str(decision.get("kind") or ""), DEFAULT_FOLLOW_UP_HOURS),
        summary=title,
    )


_DRAFTERS: Dict[str, Callable[[Dict[str, Any], str, Dict[str, Any]], ActionContent]] = {
    "contact_late_tenant": _draft_contact_late_tenant,
    "follow_up_departed_tenant": _draft_follow_up_departed_tenant,
    "onboard_new_tenant": _draft_onboard_new_tenant,
    "review_payment_history": _draft_review_payment_history,
    "investigate_tenant_change": _draft_investigate_tenant_change,
    "compare_collection_periods": _draft_compare_collection_periods,
    "request_missing_lifecycle_data": _draft_request_missing_lifecycle_data,
    "maintenance": _draft_maintenance,
    "renewal": _draft_renewal,
    "vacancy": _draft_vacancy,
    "opportunity": _draft_opportunity,
    "tenant": _draft_investigate_tenant_change,
    "financial": _draft_contact_late_tenant,
}


def draft_action_content(
    decision: Dict[str, Any],
    *,
    phone: str = "",
    extra: Optional[Dict[str, Any]] = None,
) -> ActionContent:
    """Draft ready-to-use action content for any unified decision kind.

    ``phone`` and ``extra`` (e.g. total_unpaid/late_month_count) must come
    from confirmed data the caller looked up — this function never invents
    financial or contact facts, it only phrases what it is given.
    """
    kind = str(decision.get("kind") or "")
    drafter = _DRAFTERS.get(kind, _draft_generic)
    return drafter(decision, phone, extra or {})
