"""Emit legacy API shapes from canonical portfolio — backward compatibility."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from adapters.canonical.models import CanonicalPortfolio, CanonicalUnit
from adapters.mappers.common import contract_id, tenant_id, unit_property_id
from adapters.normalize.dates import parse_date

_DEFAULT_HEROES = [
    "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&q=80",
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80",
    "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1200&q=80",
    "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80",
]


def _infer_kind(label: str) -> str:
    low = (label or "").lower()
    if any(x in low for x in ("office", "tower", "مكتب", "commercial")):
        return "office"
    if any(x in low for x in ("villa", "فيلا", "house")):
        return "villa"
    if any(x in low for x in ("penthouse", "ph")):
        return "penthouse"
    return "apartment"


def _unit_health(unit: CanonicalUnit, base: int = 75) -> int:
    score = base
    if not unit.tenant_name:
        score -= 12
    if unit.payment_status == "late":
        score -= 18
    if unit.contract_status == "expired":
        score -= 10
    if unit.contract_status == "expiring":
        score -= 5
    return max(0, min(100, score))


def emit_properties(portfolio: CanonicalPortfolio, *, base_health: int = 75) -> List[Dict[str, Any]]:
    settings = portfolio.settings
    city = settings.city or "—"
    portfolio_name = settings.portfolio_name

    if not portfolio.units:
        return [
            {
                "id": "prop_main",
                "name": portfolio_name,
                "address": portfolio_name,
                "city": city,
                "kind": "apartment",
                "units": 1,
                "occupancy": 0.0,
                "monthly_revenue": 0.0,
                "health_score": base_health,
                "hero_image": _DEFAULT_HEROES[0],
                "tenant_ids": [],
                "owner_id": settings.owner_id,
            }
        ]

    props: List[Dict[str, Any]] = []
    for index, unit in enumerate(portfolio.units):
        pid = unit_property_id(unit.label)
        props.append(
            {
                "id": pid,
                "name": unit.label,
                "address": portfolio_name,
                "city": city,
                "kind": _infer_kind(unit.label),
                "units": 1,
                "occupancy": 1.0 if unit.tenant_name else 0.0,
                "monthly_revenue": unit.monthly_rent,
                "health_score": _unit_health(unit, base_health),
                "hero_image": _DEFAULT_HEROES[index % len(_DEFAULT_HEROES)],
                "tenant_ids": [tenant_id(unit.tenant_name, unit.label)] if unit.tenant_name else [],
                "owner_id": settings.owner_id,
            }
        )
    return props


def emit_tenants(portfolio: CanonicalPortfolio) -> List[Dict[str, Any]]:
    tenants: List[Dict[str, Any]] = []
    for unit in portfolio.units:
        if not unit.tenant_name:
            continue
        reliability = 68 if unit.payment_status == "late" else 92
        tenants.append(
            {
                "id": tenant_id(unit.tenant_name, unit.label),
                "name": unit.tenant_name,
                "property_id": unit_property_id(unit.label),
                "unit": unit.label,
                "since": unit.expiry_date or "2023-01-01",
                "rent": unit.monthly_rent,
                "reliability": reliability,
            }
        )
    return tenants


def emit_contracts(portfolio: CanonicalPortfolio) -> List[Dict[str, Any]]:
    contracts: List[Dict[str, Any]] = []
    for index, unit in enumerate(portfolio.units):
        if not unit.tenant_name:
            continue
        status = unit.contract_status
        if status == "vacant":
            status = "active"
        contracts.append(
            {
                "id": contract_id(unit.contract_no or unit.unit_id, index),
                "tenant_id": tenant_id(unit.tenant_name, unit.label),
                "property_id": unit_property_id(unit.label),
                "start": "2023-01-01",
                "end": unit.expiry_date or "2028-01-01",
                "monthly_rent": unit.monthly_rent,
                "status": "expiring" if status in ("expiring", "expired") else status,
            }
        )
    order = {"expiring": 0, "active": 1, "renewed": 2}
    contracts.sort(key=lambda c: (order.get(c["status"], 9), c.get("end", "")))
    return contracts


def _property_id_for_unit(portfolio: CanonicalPortfolio, unit_id: Optional[str]) -> Optional[str]:
    if not unit_id:
        return None
    for unit in portfolio.units:
        if unit.unit_id == unit_id:
            return unit_property_id(unit.label)
    return None


def emit_decisions(portfolio: CanonicalPortfolio) -> List[Dict[str, Any]]:
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc).isoformat()
    decisions: List[Dict[str, Any]] = []

    for m in portfolio.maintenance:
        decisions.append(
            {
                "id": m.ticket_id,
                "priority": m.priority,
                "kind": "maintenance",
                "title": m.title,
                "reason": m.description or m.title,
                "impact": f"Status: {m.status}",
                "recommended_action": "Review and assign.",
                "confidence": 85,
                "property_id": _property_id_for_unit(portfolio, m.unit_id),
                "created_at": now,
            }
        )

    for unit in portfolio.units:
        pid = unit_property_id(unit.label)
        if unit.payment_status == "late":
            decisions.append(
                {
                    "id": f"d_f_{unit.unit_id}",
                    "priority": "high",
                    "kind": "financial",
                    "title": f"Late rent — {unit.label}",
                    "reason": f"{unit.tenant_name} · payment overdue",
                    "impact": f"Outstanding ≈ {unit.monthly_rent:,.0f} per month.",
                    "recommended_action": "Send reminder and schedule follow-up.",
                    "confidence": 90,
                    "property_id": pid,
                    "created_at": now,
                }
            )
        if unit.contract_status in ("expiring", "expired"):
            decisions.append(
                {
                    "id": f"d_t_{unit.unit_id}",
                    "priority": "high" if unit.contract_status == "expired" else "medium",
                    "kind": "tenant",
                    "title": f"Contract renewal — {unit.tenant_name or unit.label}",
                    "reason": f"Expires {unit.expiry_date or 'soon'}",
                    "impact": f"Monthly rent {unit.monthly_rent:,.0f} {portfolio.settings.currency}",
                    "recommended_action": "Open renewal discussion.",
                    "confidence": 88,
                    "property_id": pid,
                    "created_at": now,
                }
            )

    return decisions
