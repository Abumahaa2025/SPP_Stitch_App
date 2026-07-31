"""Derive NotifT[] from persisted ai_state after Apply (arrears + near-expiry only)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from adapters.mappers.common import slug


def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()


def _priority_from_decision(decision: dict) -> str:
    p = str(decision.get("priority") or "high").lower()
    if p in ("critical", "high", "medium", "low"):
        return p
    return "high"


def _entity_slug(*parts: Optional[str]) -> str:
    raw = "|".join(str(p or "").strip() for p in parts if p)
    return slug(raw or "entity")


def _notification_id(analysis_id: str, kind: str, *parts: str) -> str:
    aid = slug(analysis_id)
    entity = _entity_slug(*parts)
    return f"n_ai_{aid}_{kind}_{entity}"


def _is_blocked(decision: dict) -> bool:
    if decision.get("blocked_by_gate") is True:
        return True
    gate_status = str(decision.get("gate_status") or "").lower()
    return gate_status in ("blocked", "review_only")


def _norm(value: Optional[str]) -> str:
    return str(value or "").strip().lower()


def _confirmed_late_keys(ai_state: Dict[str, Any]) -> set[tuple[str, str]]:
    keys: set[tuple[str, str]] = set()
    lifecycle = ai_state.get("normalized_lifecycle") or {}
    for row in lifecycle.get("late_tenants") or []:
        keys.add((_norm(row.get("tenant")), _norm(row.get("unit"))))
    pk = ai_state.get("property_knowledge") or {}
    for row in (pk.get("late") or {}).get("tenants") or []:
        keys.add((_norm(row.get("tenant") or row.get("name")), _norm(row.get("unit"))))
    return keys


def _is_live_only_decision(decision: dict) -> bool:
    if str(decision.get("source") or "").lower() == "live":
        return True
    sources = [str(s).lower() for s in (decision.get("provenance") or {}).get("sources") or []]
    return sources == ["live"]


def _is_confirmed_late_decision(decision: dict, confirmed: set[tuple[str, str]]) -> bool:
    if _is_live_only_decision(decision):
        return False
    tenant = _norm(decision.get("tenant_name") or decision.get("tenant"))
    unit = _norm(decision.get("unit_label") or decision.get("unit"))
    if (tenant, unit) in confirmed:
        return True
    sources = [str(s).lower() for s in (decision.get("provenance") or {}).get("sources") or []]
    return "lifecycle" in sources or "koil" in sources


def _is_confirmed_renewal_decision(decision: dict) -> bool:
    if _is_live_only_decision(decision):
        return False
    sources = [str(s).lower() for s in (decision.get("provenance") or {}).get("sources") or []]
    if "lifecycle" in sources or "koil" in sources or "executive_intelligence" in sources:
        return True
    # Session-injected / analysis-bound renewal decisions may omit provenance.
    return bool(decision.get("created_from_analysis_id") or decision.get("id"))


def _late_from_unified(unified: List[dict], confirmed: set[tuple[str, str]]) -> List[dict]:
    return [
        d
        for d in unified
        if d.get("kind") == "contact_late_tenant"
        and not _is_blocked(d)
        and _is_confirmed_late_decision(d, confirmed)
    ]


def _renewal_from_unified(unified: List[dict]) -> List[dict]:
    return [
        d
        for d in unified
        if d.get("kind") == "renewal"
        and not _is_blocked(d)
        and _is_confirmed_renewal_decision(d)
    ]


def _late_notification(
    analysis_id: str,
    applied_at: str,
    *,
    tenant: str,
    unit: str,
    body_text: str,
    decision_id: Optional[str] = None,
    reason: str = "contact_late_tenant",
) -> Dict[str, Any]:
    tenant = (tenant or "").strip() or "—"
    unit = (unit or "").strip() or "—"
    dedupe = decision_id or f"{tenant}|{unit}"
    return {
        "id": _notification_id(analysis_id, "late", unit, tenant, dedupe),
        "title": f"تحصيل متأخر — {tenant} · وحدة {unit}",
        "body": f"{body_text} · decision:{decision_id or dedupe} · analysis:{analysis_id}",
        "priority": "high",
        "at": applied_at,
        "read": False,
        "analysis_id": analysis_id,
        "decision_id": decision_id or dedupe,
        "reason": reason,
    }


def _renewal_notification(
    analysis_id: str,
    applied_at: str,
    *,
    tenant: str,
    unit: str,
    body_text: str,
    decision_id: Optional[str] = None,
    reason: str = "renewal",
) -> Dict[str, Any]:
    tenant = (tenant or "").strip() or "—"
    unit = (unit or "").strip() or "—"
    dedupe = decision_id or f"{tenant}|{unit}"
    return {
        "id": _notification_id(analysis_id, "expiring", unit, tenant, dedupe),
        "title": f"عقد ينتهي قريبًا — {tenant} · {unit}",
        "body": f"{body_text} · decision:{decision_id or dedupe} · analysis:{analysis_id}",
        "priority": "high",
        "at": applied_at,
        "read": False,
        "analysis_id": analysis_id,
        "decision_id": decision_id or dedupe,
        "reason": reason,
    }


def derive_notifications_from_ai_state(ai_state: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Build flat NotifT-compatible notifications from one applied ai_state."""
    if not ai_state or not ai_state.get("analysis_id"):
        return []

    analysis_id = str(ai_state["analysis_id"])
    applied_at = ai_state.get("applied_at") or _iso(datetime.now(timezone.utc))
    unified = list(ai_state.get("unified_smart_decisions") or [])
    confirmed_late = _confirmed_late_keys(ai_state)
    notifications: List[Dict[str, Any]] = []
    seen_ids: set[str] = set()

    def _add(notif: Dict[str, Any]) -> None:
        nid = notif.get("id")
        if not nid or nid in seen_ids:
            return
        seen_ids.add(nid)
        notifications.append(notif)

    for decision in _late_from_unified(unified, confirmed_late):
        tenant = str(decision.get("tenant_name") or decision.get("tenant") or "").strip()
        unit = str(decision.get("unit_label") or decision.get("unit") or "").strip()
        if not tenant and not unit:
            continue
        body_text = (
            str(decision.get("why") or decision.get("action") or decision.get("title") or "")
            .strip()
            or "متابعة تحصيل المتأخرات"
        )
        _add(
            _late_notification(
                analysis_id,
                applied_at,
                tenant=tenant,
                unit=unit,
                body_text=body_text,
                decision_id=str(decision.get("id") or decision.get("dedupe_key") or ""),
                reason=str(decision.get("kind") or "contact_late_tenant"),
            )
        )

    if not _late_from_unified(unified, confirmed_late):
        lifecycle = ai_state.get("normalized_lifecycle") or {}
        late_rows = list(lifecycle.get("late_tenants") or [])
        if not late_rows:
            pk = ai_state.get("property_knowledge") or {}
            late_rows = list((pk.get("late") or {}).get("tenants") or [])
        for row in late_rows:
            tenant = str(row.get("tenant") or row.get("name") or "").strip()
            unit = str(row.get("unit") or "").strip()
            if not tenant and not unit:
                continue
            unpaid = row.get("total_unpaid") or row.get("rent") or 0
            body_text = f"متابعة تحصيل {float(unpaid):,.0f} ر.س"
            _add(
                _late_notification(
                    analysis_id,
                    applied_at,
                    tenant=tenant,
                    unit=unit,
                    body_text=body_text,
                    decision_id=f"late_{unit}_{tenant}",
                    reason="contact_late_tenant",
                )
            )

    for decision in _renewal_from_unified(unified):
        tenant = str(decision.get("tenant_name") or decision.get("tenant") or "").strip()
        unit = str(decision.get("unit_label") or decision.get("unit") or "").strip()
        if not tenant and not unit:
            continue
        body_text = (
            str(decision.get("why") or decision.get("action") or decision.get("title") or "")
            .strip()
            or "تجديد العقد قريبًا"
        )
        _add(
            _renewal_notification(
                analysis_id,
                applied_at,
                tenant=tenant,
                unit=unit,
                body_text=body_text,
                decision_id=str(decision.get("id") or decision.get("dedupe_key") or ""),
                reason="renewal",
            )
        )

    notifications.sort(key=lambda n: n.get("at", ""), reverse=True)
    return notifications
