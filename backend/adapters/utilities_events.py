"""Normalize electricity/water bill & notice webhooks into SPP + Kowil payment approvals.

Owner must approve before Kowil prepares a payment / party notice.
delivery_status stays not_sent until a future pay rail is wired.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional
import uuid

UtilityKind = Literal["electricity", "water"]

SUPPORTED_EVENT_TYPES = {
    "bill_issued",
    "bill_due",
    "bill_overdue",
    "payment_reminder",
    "outage_notice",
    "meter_reading",
    "official_notice",
}

KIND_LABEL = {
    "electricity": {"ar": "الكهرباء", "en": "Electricity"},
    "water": {"ar": "المياه", "en": "Water"},
}


def _iso(dt: Optional[datetime] = None) -> str:
    return (dt or datetime.now(timezone.utc)).astimezone(timezone.utc).isoformat()


def _s(value: Any, default: str = "") -> str:
    return str(value if value is not None else default).strip()


def _f(value: Any) -> Optional[float]:
    try:
        if value is None or value == "":
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def normalize_utility_payload(kind: UtilityKind, body: Dict[str, Any]) -> Dict[str, Any]:
    raw_type = _s(
        body.get("event_type") or body.get("type") or body.get("event") or "bill_due"
    ).lower()
    if raw_type not in SUPPORTED_EVENT_TYPES:
        raw_type = "official_notice"

    event_id = _s(body.get("event_id") or body.get("id")) or f"{kind}_{uuid.uuid4().hex[:12]}"
    account = _s(body.get("account_number") or body.get("account") or body.get("subscription_id"))
    bill_no = _s(body.get("bill_number") or body.get("invoice_number") or body.get("bill_id"))
    unit = _s(body.get("unit") or body.get("unit_number") or body.get("unitLabel"))
    property_name = _s(body.get("property_name") or body.get("property") or body.get("building"))
    meter = _s(body.get("meter_number") or body.get("meter"))
    due_date = _s(body.get("due_date") or body.get("payment_due") or body.get("due"))
    period = _s(body.get("period") or body.get("billing_period") or body.get("cycle"))
    amount = _f(body.get("amount") or body.get("total") or body.get("amount_due"))
    currency = _s(body.get("currency") or "SAR") or "SAR"
    provider = _s(body.get("provider") or body.get("company") or KIND_LABEL[kind]["ar"])
    message_ar = _s(body.get("message_ar") or body.get("message") or body.get("body_ar"))
    message_en = _s(body.get("message_en") or body.get("body_en"))
    payment_url = _s(body.get("payment_url") or body.get("pay_url") or body.get("checkout_url"))

    label_ar = KIND_LABEL[kind]["ar"]
    label_en = KIND_LABEL[kind]["en"]
    amount_bit_ar = f" بمبلغ {amount:,.2f} {currency}" if amount is not None else ""
    amount_bit_en = f" amounting to {amount:,.2f} {currency}" if amount is not None else ""

    if not message_ar:
        if raw_type in ("bill_issued", "bill_due", "bill_overdue", "payment_reminder"):
            message_ar = (
                f"{label_ar}: فاتورة"
                + (f" {bill_no}" if bill_no else "")
                + amount_bit_ar
                + (f" — حساب {account}" if account else "")
                + (f" — وحدة {unit}" if unit else "")
                + (f" — استحقاق {due_date}" if due_date else "")
                + ". كويل يقترح السداد بعد إذن المالك."
            )
        else:
            message_ar = f"{label_ar}: وصل إشعار رسمي. راجع التفاصيل ووافق على الإجراء."

    if not message_en:
        if raw_type in ("bill_issued", "bill_due", "bill_overdue", "payment_reminder"):
            message_en = (
                f"{label_en}: bill"
                + (f" {bill_no}" if bill_no else "")
                + amount_bit_en
                + (f" — account {account}" if account else "")
                + (f" — unit {unit}" if unit else "")
                + (f" — due {due_date}" if due_date else "")
                + ". Kowil suggests paying after owner permission."
            )
        else:
            message_en = f"{label_en}: an official notice arrived. Review and approve the next step."

    is_bill = raw_type in ("bill_issued", "bill_due", "bill_overdue", "payment_reminder")
    priority = "critical" if raw_type == "bill_overdue" else ("high" if is_bill else "medium")

    return {
        "id": event_id,
        "source": kind,
        "utility": kind,
        "event_type": raw_type,
        "account_number": account,
        "bill_number": bill_no,
        "unit": unit,
        "property_name": property_name,
        "meter_number": meter,
        "due_date": due_date,
        "period": period,
        "amount": amount,
        "currency": currency,
        "provider": provider,
        "payment_url": payment_url,
        "message_ar": message_ar,
        "message_en": message_en,
        "priority": priority,
        "is_bill": is_bill,
        "received_at": _iso(),
        "status": "received",
        "owner_approval": "pending",
        "audiences": ["owner"],
        "raw": body,
    }


def build_notifications(event: Dict[str, Any]) -> List[Dict[str, Any]]:
    kind = _s(event.get("utility") or event.get("source")) or "electricity"
    label_ar = KIND_LABEL.get(kind, KIND_LABEL["electricity"])["ar"]
    label_en = KIND_LABEL.get(kind, KIND_LABEL["electricity"])["en"]
    at = _s(event.get("received_at")) or _iso()
    eid = _s(event.get("id"))
    is_bill = bool(event.get("is_bill"))
    title_ar = f"{label_ar} · فاتورة مستحقة" if is_bill else f"{label_ar} · إشعار"
    title_en = f"{label_en} · bill due" if is_bill else f"{label_en} · notice"
    body = _s(event.get("message_ar")) or _s(event.get("message_en"))
    return [
        {
            "id": f"n_util_{eid}_owner",
            "title": title_ar,
            "title_en": title_en,
            "body": body,
            "priority": _s(event.get("priority")) or "high",
            "at": at,
            "read": False,
            "route": "/wallet",
            "source": kind,
            "utility": kind,
            "utility_event_id": eid,
            "audience": "owner",
        }
    ]


def build_decision(event: Dict[str, Any]) -> Dict[str, Any]:
    kind = _s(event.get("utility") or event.get("source")) or "electricity"
    eid = _s(event.get("id"))
    is_bill = bool(event.get("is_bill"))
    amount = event.get("amount")
    label_ar = KIND_LABEL.get(kind, {})["ar"]
    label_en = KIND_LABEL.get(kind, {})["en"]
    return {
        "id": f"util_dec_{eid}",
        "kind": "utility_bill_payment" if is_bill else "utility_notice",
        "source": kind,
        "utility": kind,
        "requires_confirmation": True,
        "blocked_by_gate": False,
        "gate_status": "ok",
        "priority": _s(event.get("priority")) or "high",
        "bill_number": _s(event.get("bill_number")),
        "account_number": _s(event.get("account_number")),
        "unit_label": _s(event.get("unit")),
        "amount": amount,
        "currency": _s(event.get("currency")) or "SAR",
        "due_date": _s(event.get("due_date")),
        "why": _s(event.get("message_ar")) or _s(event.get("message_en")),
        "title_ar": (
            f"كويل يقترح: سداد فاتورة {label_ar}"
            + (f" ({amount:,.2f} ر.س)" if isinstance(amount, (int, float)) else "")
        ),
        "title_en": (
            f"Kowil suggests: pay {label_en} bill"
            + (f" ({amount:,.2f} SAR)" if isinstance(amount, (int, float)) else "")
        ),
        "suggested_action": "pay_bill_after_owner_permission" if is_bill else "ack_notice",
        "utility_event_id": eid,
        "provenance": {"sources": [kind]},
    }


def prepare_payment_messages(event: Dict[str, Any]) -> Dict[str, str]:
    kind = _s(event.get("utility") or event.get("source")) or "electricity"
    label_ar = KIND_LABEL.get(kind, {})["ar"]
    bill = _s(event.get("bill_number")) or "—"
    account = _s(event.get("account_number")) or "—"
    unit = _s(event.get("unit")) or "—"
    amount = event.get("amount")
    currency = _s(event.get("currency")) or "SAR"
    due = _s(event.get("due_date"))
    amount_bit = f"{amount:,.2f} {currency}" if isinstance(amount, (int, float)) else "—"
    pay_url = _s(event.get("payment_url"))

    owner_msg = (
        f"كويل · {label_ar}: فاتورة {bill} لحساب {account} وحدة {unit} بمبلغ {amount_bit}"
        + (f" — استحقاق {due}" if due else "")
        + ". وافقتَ على تجهيز السداد — لم يُنفَّذ الدفع تلقائياً."
        + (f" رابط الدفع: {pay_url}" if pay_url else "")
    )
    prep_msg = (
        f"Payment prepared for {label_ar} bill {bill} / account {account} / unit {unit}: {amount_bit}."
        + (" Not auto-charged." if True else "")
        + (f" Pay URL: {pay_url}" if pay_url else "")
    )
    return {"owner": owner_msg, "payment_summary": prep_msg}


def build_kowil_task(event: Dict[str, Any]) -> Dict[str, Any]:
    kind = _s(event.get("utility") or event.get("source")) or "electricity"
    eid = _s(event.get("id"))
    label_ar = KIND_LABEL.get(kind, {})["ar"]
    label_en = KIND_LABEL.get(kind, {})["en"]
    amount = event.get("amount")
    is_bill = bool(event.get("is_bill"))
    return {
        "id": f"util_task_{eid}",
        "kind": "data_gap" if not is_bill else "collect_arrears",
        "source": kind,
        "utility": kind,
        "utility_event_id": eid,
        "priority": 1 if _s(event.get("event_type")) == "bill_overdue" else 2,
        "titleAr": (
            f"{label_ar}: سداد فاتورة"
            + (f" {amount:,.0f} ر.س" if isinstance(amount, (int, float)) else "")
        ),
        "titleEn": (
            f"{label_en}: pay bill"
            + (f" {amount:,.0f} SAR" if isinstance(amount, (int, float)) else "")
        ),
        "reasonAr": _s(event.get("message_ar")),
        "reasonEn": _s(event.get("message_en")),
        "action": "mark_done" if not is_bill else "open_database",
        "actionLabelAr": "اطلب إذن المالك للسداد" if is_bill else "راجع الإشعار",
        "actionLabelEn": "Ask owner permission to pay" if is_bill else "Review notice",
        "unitNumber": _s(event.get("unit")),
        "amount": amount if isinstance(amount, (int, float)) else None,
        "route": "/wallet",
        "requiresOwnerApproval": True,
    }


def build_approval_record(event: Dict[str, Any], *, approved_at: Optional[str] = None) -> Dict[str, Any]:
    eid = _s(event.get("id"))
    kind = _s(event.get("utility") or event.get("source")) or "electricity"
    messages = prepare_payment_messages(event)
    ts = approved_at or _iso()
    return {
        "_id": f"util_approval:{eid}",
        "approval_id": f"util_approval:{eid}",
        "utility_event_id": eid,
        "utility": kind,
        "decision_id": f"util_dec_{eid}",
        "decision_kind": "utility_bill_payment" if event.get("is_bill") else "utility_notice",
        "bill_number": _s(event.get("bill_number")),
        "account_number": _s(event.get("account_number")),
        "unit": _s(event.get("unit")),
        "amount": event.get("amount"),
        "currency": _s(event.get("currency")) or "SAR",
        "due_date": _s(event.get("due_date")),
        "payment_url": _s(event.get("payment_url")),
        "prepared_messages": messages,
        "approved_at": ts,
        "status": "approved_and_prepared",
        "delivery_status": "not_sent",
        "payment_status": "prepared_awaiting_rail",
        "kowil_note_ar": "كويل جهّز السداد بعد إذنك — لم يُخصم أي مبلغ تلقائياً.",
        "kowil_note_en": "Kowil prepared payment after your permission — nothing was auto-charged.",
    }
