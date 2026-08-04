"""Normalize Ejar webhook payloads into SPP notifications + Kowil decisions.

Fan-out audiences (existing product surfaces — no new UI identity):
  - owner          → in-app NotifT + Kowil pending approval
  - agent_contracts → agents holding the contracts permission link
  - tenant         → prepared WhatsApp / portal notice (send only after owner approval)
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import uuid


SUPPORTED_EVENT_TYPES = {
    "contract_nearing_expiry",
    "contract_expiry_warning",
    "contract_expiring",
    "renewal_reminder",
    "official_notice",
}


def _iso(dt: Optional[datetime] = None) -> str:
    return (dt or datetime.now(timezone.utc)).astimezone(timezone.utc).isoformat()


def _s(value: Any, default: str = "") -> str:
    return str(value if value is not None else default).strip()


def normalize_ejar_payload(body: Dict[str, Any]) -> Dict[str, Any]:
    """Map vendor / GAS / manual payloads into a stable internal event."""
    raw_type = _s(
        body.get("event_type")
        or body.get("type")
        or body.get("event")
        or "contract_nearing_expiry"
    ).lower()
    if raw_type not in SUPPORTED_EVENT_TYPES:
        # Unknown official notices still flow through as expiry-style alerts.
        raw_type = "official_notice"

    days_left_raw = body.get("days_left") or body.get("daysRemaining") or body.get("days")
    try:
        days_left = int(days_left_raw) if days_left_raw is not None else None
    except (TypeError, ValueError):
        days_left = None

    event_id = _s(body.get("event_id") or body.get("id")) or f"ejar_{uuid.uuid4().hex[:12]}"
    contract_no = _s(body.get("contract_number") or body.get("contract_no") or body.get("contractId"))
    unit = _s(body.get("unit") or body.get("unit_number") or body.get("unitLabel"))
    tenant_name = _s(body.get("tenant_name") or body.get("tenant") or body.get("lessee"))
    tenant_phone = _s(body.get("tenant_phone") or body.get("phone"))
    owner_name = _s(body.get("owner_name") or body.get("owner") or body.get("lessor"))
    end_date = _s(body.get("end_date") or body.get("contract_end") or body.get("expiry_date"))
    property_name = _s(body.get("property_name") or body.get("property") or body.get("building"))
    message_ar = _s(body.get("message_ar") or body.get("message") or body.get("body_ar"))
    message_en = _s(body.get("message_en") or body.get("body_en"))

    if not message_ar:
        if days_left is not None and contract_no:
            message_ar = (
                f"منصة إيجار: العقد {contract_no} يقترب من الانتهاء"
                + (f" خلال {days_left} يوم" if days_left >= 0 else " (منتهٍ)")
                + (f" — وحدة {unit}" if unit else "")
                + (f" — المستأجر {tenant_name}" if tenant_name else "")
                + "."
            )
        else:
            message_ar = "منصة إيجار: وصل إشعار رسمي متعلق بالعقد. راجع التفاصيل ووافق على الإجراء."

    if not message_en:
        if days_left is not None and contract_no:
            message_en = (
                f"Ejar: contract {contract_no} is nearing expiry"
                + (f" in {days_left} day(s)" if days_left >= 0 else " (expired)")
                + (f" — unit {unit}" if unit else "")
                + (f" — tenant {tenant_name}" if tenant_name else "")
                + "."
            )
        else:
            message_en = "Ejar: an official contract notice arrived. Review and approve the next step."

    priority = "critical" if (days_left is not None and days_left <= 7) else "high"

    return {
        "id": event_id,
        "source": "ejar",
        "event_type": raw_type,
        "contract_number": contract_no,
        "unit": unit,
        "tenant_name": tenant_name,
        "tenant_phone": tenant_phone,
        "owner_name": owner_name,
        "property_name": property_name,
        "end_date": end_date,
        "days_left": days_left,
        "message_ar": message_ar,
        "message_en": message_en,
        "priority": priority,
        "received_at": _iso(),
        "status": "received",
        "owner_approval": "pending",
        "audiences": ["owner", "agent_contracts", "tenant"],
        "raw": body,
    }


def build_notifications(event: Dict[str, Any]) -> List[Dict[str, Any]]:
    """NotifT-compatible rows for owner + contracts-permission holders + tenant inbox."""
    at = _s(event.get("received_at")) or _iso()
    eid = _s(event.get("id"))
    title_ar = "إيجار · قرب انتهاء العقد" if "expir" in _s(event.get("event_type")) else "إيجار · إشعار رسمي"
    title_en = "Ejar · contract nearing expiry" if "expir" in _s(event.get("event_type")) else "Ejar · official notice"
    body = _s(event.get("message_ar")) or _s(event.get("message_en"))
    priority = _s(event.get("priority")) or "high"
    base = {
        "priority": priority,
        "at": at,
        "read": False,
        "route": "/contracts",
        "source": "ejar",
        "ejar_event_id": eid,
    }
    return [
        {
            **base,
            "id": f"n_ejar_{eid}_owner",
            "title": title_ar,
            "title_en": title_en,
            "body": body,
            "audience": "owner",
        },
        {
            **base,
            "id": f"n_ejar_{eid}_agent_contracts",
            "title": title_ar,
            "title_en": title_en,
            "body": body + " · صلاحية العقود",
            "audience": "agent_contracts",
        },
        {
            **base,
            "id": f"n_ejar_{eid}_tenant",
            "title": title_ar,
            "title_en": title_en,
            "body": body,
            "audience": "tenant",
            "route": "/portal/tenant",
        },
    ]


def build_decision(event: Dict[str, Any]) -> Dict[str, Any]:
    """Unified-decision shaped object — requires owner confirmation before notify."""
    eid = _s(event.get("id"))
    days = event.get("days_left")
    why = _s(event.get("message_ar")) or _s(event.get("message_en"))
    return {
        "id": f"ejar_dec_{eid}",
        "kind": "ejar_contract_expiry",
        "source": "ejar",
        "requires_confirmation": True,
        "blocked_by_gate": False,
        "gate_status": "ok",
        "priority": _s(event.get("priority")) or "high",
        "tenant_name": _s(event.get("tenant_name")),
        "unit_label": _s(event.get("unit")),
        "contract_number": _s(event.get("contract_number")),
        "end_date": _s(event.get("end_date")),
        "days_left": days,
        "why": why,
        "title_ar": "كويل يقترح: إبلاغ الأطراف بقرب انتهاء عقد إيجار",
        "title_en": "Kowil suggests: notify parties of Ejar contract expiry",
        "suggested_action": "notify_owner_agent_tenant",
        "audiences": ["owner", "agent_contracts", "tenant"],
        "ejar_event_id": eid,
        "provenance": {"sources": ["ejar"]},
    }


def prepare_party_messages(event: Dict[str, Any]) -> Dict[str, str]:
    """Arabic prepared messages — delivered only after owner approval."""
    contract = _s(event.get("contract_number")) or "—"
    unit = _s(event.get("unit")) or "—"
    tenant = _s(event.get("tenant_name")) or "المستأجر"
    days = event.get("days_left")
    days_bit = f" خلال {days} يوم" if isinstance(days, int) else ""
    end = _s(event.get("end_date"))
    end_bit = f" (تاريخ الانتهاء: {end})" if end else ""

    owner_msg = (
        f"كويل · منصة إيجار: العقد {contract} لوحدة {unit} يقترب من الانتهاء{days_bit}{end_bit}. "
        f"المستأجر: {tenant}. اقترح تجديد أو إخلاء مرتب — وافق لإبلاغ الوكيل والمستأجر."
    )
    agent_msg = (
        f"كويل → وكيل العقود: إشعار إيجار رسمي للعقد {contract} وحدة {unit}{days_bit}{end_bit}. "
        "راجع صلاحية العقود واتخذ اللازم مع المالك."
    )
    tenant_msg = (
        f"السلام عليكم {tenant}، نود إبلاغكم عبر منصة إيجار أن عقد وحدة {unit} "
        f"رقم {contract} يقترب من الانتهاء{days_bit}{end_bit}. "
        "يرجى التواصل مع إدارة العقار بخصوص التجديد. شكراً لكم."
    )
    return {
        "owner": owner_msg,
        "agent_contracts": agent_msg,
        "tenant": tenant_msg,
    }


def build_kowil_task(event: Dict[str, Any]) -> Dict[str, Any]:
    """Payload the frontend Smart Employee desk can hydrate into a task."""
    eid = _s(event.get("id"))
    days = event.get("days_left")
    contract = _s(event.get("contract_number")) or "—"
    unit = _s(event.get("unit")) or "—"
    return {
        "id": f"ejar_task_{eid}",
        "kind": "renew_contract",
        "source": "ejar",
        "ejar_event_id": eid,
        "priority": 1 if (isinstance(days, int) and days <= 14) else 2,
        "titleAr": f"إيجار: قرب انتهاء عقد {contract}",
        "titleEn": f"Ejar: contract {contract} nearing expiry",
        "reasonAr": _s(event.get("message_ar")),
        "reasonEn": _s(event.get("message_en")),
        "action": "open_contracts",
        "actionLabelAr": "اطلب إذن المالك ثم أبلغ الأطراف",
        "actionLabelEn": "Ask owner permission then notify parties",
        "unitNumber": unit,
        "whatsappPhone": _s(event.get("tenant_phone")) or None,
        "whatsappMessage": prepare_party_messages(event)["tenant"],
        "route": "/contracts",
        "requiresOwnerApproval": True,
    }


def build_approval_record(event: Dict[str, Any], *, approved_at: Optional[str] = None) -> Dict[str, Any]:
    """Owner-approved preparation — messages ready, delivery_status not_sent."""
    eid = _s(event.get("id"))
    messages = prepare_party_messages(event)
    ts = approved_at or _iso()
    return {
        "_id": f"ejar_approval:{eid}",
        "approval_id": f"ejar_approval:{eid}",
        "ejar_event_id": eid,
        "decision_id": f"ejar_dec_{eid}",
        "decision_kind": "ejar_contract_expiry",
        "contract_number": _s(event.get("contract_number")),
        "tenant": _s(event.get("tenant_name")),
        "unit": _s(event.get("unit")),
        "tenant_phone": _s(event.get("tenant_phone")),
        "days_left": event.get("days_left"),
        "end_date": _s(event.get("end_date")),
        "prepared_messages": messages,
        "audiences": ["owner", "agent_contracts", "tenant"],
        "approved_at": ts,
        "status": "approved_and_prepared",
        "delivery_status": "not_sent",
        "kowil_note_ar": "كويل جهّز الإشعارات للمالك ووكيل العقود والمستأجر — بانتظار الإرسال بعد إذنك.",
        "kowil_note_en": "Kowil prepared notices for owner, contracts agent, and tenant — awaiting send after your permission.",
    }
