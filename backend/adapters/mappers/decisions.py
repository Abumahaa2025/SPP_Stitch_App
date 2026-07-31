"""Map SPP_Official getAppData → Emergent DecisionT[] (maintenance + financial + tenant)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List

from adapters.mappers.common import slug, unit_property_id


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _priority_from_risk(risk: str) -> str:
    risk = risk or ""
    if any(x in risk for x in ("عاج", "حرج", "critical")):
        return "critical"
    if any(x in risk for x in ("عالي", "high")):
        return "high"
    if any(x in risk for x in ("متوسط", "medium")):
        return "medium"
    return "low"


def map_decisions_from_app_data(app_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    decisions: List[Dict[str, Any]] = []
    now = _iso_now()

    for item in app_data.get("maintenanceRequests") or []:
        status = str(item.get("status") or "")
        if "مكتمل" in status or "closed" in status.lower():
            continue
        risk = str(item.get("risk") or "")
        unit = str(item.get("unit") or "")
        decisions.append(
            {
                "id": f"d_m_{slug(str(item.get('ticketNo') or unit))}",
                "priority": _priority_from_risk(risk),
                "kind": "maintenance",
                "title": str(item.get("type") or "Maintenance request"),
                "reason": f"{unit} — {item.get('tenant', '')}".strip(" —"),
                "impact": f"Status: {status}. Risk: {risk or 'review'}",
                "recommended_action": str(item.get("aiAnalysis") or "Review and assign technician."),
                "confidence": 88,
                "property_id": unit_property_id(unit) if unit else None,
                "created_at": now,
            }
        )

    dashboard = app_data.get("dashboard") or {}
    for unit in dashboard.get("latePayments") or []:
        unit_name = str(unit.get("unit") or "")
        tenant = str(unit.get("tenant") or "")
        rent = float(unit.get("rent") or 0)
        decisions.append(
            {
                "id": f"d_f_{slug(unit_name + tenant)}",
                "priority": "high",
                "kind": "financial",
                "title": f"Late rent — {unit_name}",
                "reason": f"{tenant} · {unit.get('payStatus', 'overdue')}",
                "impact": f"Outstanding ≈ {rent:,.0f} per month.",
                "recommended_action": "Send reminder and schedule follow-up within 24 hours.",
                "confidence": 90,
                "property_id": unit_property_id(unit_name),
                "created_at": now,
            }
        )

    for unit in dashboard.get("nearContracts") or []:
        unit_name = str(unit.get("unit") or "")
        tenant = str(unit.get("tenant") or "")
        decisions.append(
            {
                "id": f"d_t_{slug(unit_name + tenant)}",
                "priority": "medium",
                "kind": "tenant",
                "title": f"Contract renewal — {tenant or unit_name}",
                "reason": f"Expires {unit.get('expiryDate', 'soon')} · {unit.get('daysDisplay', '')}",
                "impact": "Retention avoids vacancy and turnover cost.",
                "recommended_action": "Prepare renewal offer and contact tenant this week.",
                "confidence": 85,
                "property_id": unit_property_id(unit_name),
                "created_at": now,
            }
        )

    for pred in (app_data.get("predictions") or [])[:3]:
        level = str(pred.get("level") or "")
        priority = _priority_from_risk(level)
        decisions.append(
            {
                "id": f"d_p_{slug(str(pred.get('title') or 'prediction'))}",
                "priority": priority if priority != "low" else "medium",
                "kind": "opportunity",
                "title": str(pred.get("title") or "Portfolio insight"),
                "reason": str(pred.get("description") or pred.get("recommendation") or ""),
                "impact": "Early action reduces downstream cost.",
                "recommended_action": str(pred.get("recommendation") or "Review in Brain."),
                "confidence": 78,
                "property_id": None,
                "created_at": now,
            }
        )

    order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    decisions.sort(key=lambda d: order.get(d["priority"], 9))
    return decisions
