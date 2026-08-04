"""Inbound automated messaging / intelligence payloads → Kowil owner approval."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import uuid

from adapters.platform_inbox_client import PlatformChannel


def _iso(dt: Optional[datetime] = None) -> str:
    return (dt or datetime.now(timezone.utc)).astimezone(timezone.utc).isoformat()


def _s(value: Any, default: str = "") -> str:
    return str(value if value is not None else default).strip()


def infer_route(body: Dict[str, Any]) -> str:
    """Suggest audience: tenant | agent | tech | guard | owner."""
    explicit = _s(body.get("route_to") or body.get("audience")).lower()
    if explicit in ("tenant", "agent", "tech", "guard", "owner"):
        return explicit
    text = _s(body.get("message") or body.get("text") or body.get("body")).lower()
    if any(k in text for k in ("صيانة", "maintenance", "فني", "technician")):
        return "tech"
    if any(k in text for k in ("حارس", "guard", "security")):
        return "guard"
    if any(k in text for k in ("وكيل", "agent", "عقد", "contract")):
        return "agent"
    if any(k in text for k in ("مستأجر", "tenant", "إيجار", "rent")):
        return "tenant"
    return "owner"


def normalize_platform_payload(channel: PlatformChannel, body: Dict[str, Any]) -> Dict[str, Any]:
    eid = _s(body.get("id") or body.get("event_id")) or f"plat_{uuid.uuid4().hex[:12]}"
    route = infer_route(body)
    msg_ar = _s(body.get("message_ar") or body.get("message") or body.get("text"))
    msg_en = _s(body.get("message_en") or body.get("message") or body.get("text"))
    return {
        "id": eid,
        "channel": channel,
        "event_type": _s(body.get("event_type") or body.get("type") or "inbound_message"),
        "route_to": route,
        "unit": _s(body.get("unit")),
        "tenant_phone": _s(body.get("tenant_phone") or body.get("phone")),
        "tenant_name": _s(body.get("tenant_name")),
        "message_ar": msg_ar,
        "message_en": msg_en,
        "analysis_ar": _s(body.get("analysis_ar") or f"كويل: رسالة من منصة {'الرسائل' if channel == 'messaging' else 'الذكاء'} — التوجيه المقترح: {route}"),
        "analysis_en": _s(body.get("analysis_en") or f"Kowil: inbound from {'messaging' if channel == 'messaging' else 'intelligence'} platform — suggested route: {route}"),
        "owner_approval": _s(body.get("owner_approval")) or "pending",
        "received_at": _s(body.get("received_at")) or _iso(),
    }


def build_kowil_task(event: Dict[str, Any]) -> Dict[str, Any]:
    eid = _s(event.get("id"))
    channel = _s(event.get("channel"))
    route = _s(event.get("route_to"))
    title_suffix = "رسائل آلية" if channel == "messaging" else "ذكاء"
    return {
        "id": f"platform_task_{eid}",
        "kind": "follow_up",
        "source": channel or "platform",
        "platform_event_id": eid,
        "priority": 2,
        "titleAr": f"كويل · {title_suffix}: توجيه إلى {route}",
        "titleEn": f"Kowil · {channel}: route to {route}",
        "reasonAr": _s(event.get("analysis_ar")),
        "reasonEn": _s(event.get("analysis_en")),
        "action": "mark_done",
        "actionLabelAr": "وافق ثم أرسل تلقائياً",
        "actionLabelEn": "Approve then auto-send",
        "unitNumber": _s(event.get("unit")) or None,
        "whatsappPhone": _s(event.get("tenant_phone")) or None,
        "whatsappMessage": _s(event.get("message_ar")) or _s(event.get("message_en")),
        "route": "/brain",
        "requiresOwnerApproval": True,
        "route_to": route,
    }


def build_approval_record(event: Dict[str, Any], *, approved_at: Optional[str] = None) -> Dict[str, Any]:
    eid = _s(event.get("id"))
    route = _s(event.get("route_to"))
    msg = _s(event.get("message_ar")) or _s(event.get("message_en"))
    ts = approved_at or _iso()
    prepared: Dict[str, str] = {
        "owner": _s(event.get("analysis_ar")) or msg,
        "tenant": msg,
        "agent": msg,
        "tech": msg,
        "guard": msg,
    }
    return {
        "_id": f"platform_approval:{eid}",
        "approval_id": f"platform_approval:{eid}",
        "platform_event_id": eid,
        "channel": _s(event.get("channel")),
        "route_to": route,
        "approved_at": ts,
        "prepared_messages": prepared,
        "delivery_status": "not_sent",
        "kowil_note_ar": f"تم تجهيز الرسالة للتوجيه إلى {route} بعد موافقة المالك.",
        "kowil_note_en": f"Message prepared for route {route} after owner approval.",
    }
