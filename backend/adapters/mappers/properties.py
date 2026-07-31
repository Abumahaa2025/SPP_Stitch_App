"""Map SPP_Official getAppData → Emergent PropertyT[]."""

from __future__ import annotations

from typing import Any, Dict, List

from adapters.mappers.common import slug, unit_property_id

_DEFAULT_HEROES = [
    "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&q=80",
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80",
    "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1200&q=80",
    "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80",
]


def _infer_kind(unit_name: str) -> str:
    name = (unit_name or "").lower()
    if any(x in name for x in ("مكتب", "office", "tower")):
        return "office"
    if any(x in name for x in ("فيلا", "villa")):
        return "villa"
    if any(x in name for x in ("penthouse", "ph", "بنت")):
        return "penthouse"
    return "apartment"


def _unit_health(base: int, unit: Dict[str, Any]) -> int:
    score = int(base or 75)
    if not unit.get("tenant"):
        score -= 12
    pay = str(unit.get("payStatus") or "")
    if "متأخر" in pay or "لم يسدد" in pay:
        score -= 18
    contract = str(unit.get("contractStatusResolved") or unit.get("contractStatus") or "")
    if contract == "منتهي":
        score -= 10
    if contract == "قريب الانتهاء":
        score -= 5
    return max(0, min(100, score))


def map_properties_from_app_data(app_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Preserve Emergent PropertyT field names for /api/properties."""
    settings = app_data.get("settings") or {}
    dashboard = app_data.get("dashboard") or {}
    units = dashboard.get("units") or []
    summary = dashboard.get("summary") or {}
    health = app_data.get("propertyHealth") or {}
    base_health = int(health.get("score") or 75)
    portfolio_name = (
        settings.get("propertyName")
        or settings.get("clientName")
        or "محفظتي العقارية"
    )
    city = "الرياض"

    if not units:
        total = int(summary.get("totalUnits") or 1)
        rented = int(summary.get("rented") or 0)
        total_rent = float(summary.get("totalRent") or 0)
        return [
            {
                "id": "prop_main",
                "name": portfolio_name,
                "address": portfolio_name,
                "city": city,
                "kind": "apartment",
                "units": max(total, 1),
                "occupancy": round(rented / max(total, 1), 3),
                "monthly_revenue": total_rent,
                "health_score": base_health,
                "hero_image": _DEFAULT_HEROES[0],
                "tenant_ids": [],
                "owner_id": "own_1",
            }
        ]

    properties: List[Dict[str, Any]] = []
    for index, unit in enumerate(units):
        unit_name = str(unit.get("unit") or f"وحدة {index + 1}")
        tenant = str(unit.get("tenant") or "").strip()
        properties.append(
            {
                "id": unit_property_id(unit_name),
                "name": unit_name,
                "address": portfolio_name,
                "city": city,
                "kind": _infer_kind(unit_name),
                "units": 1,
                "occupancy": 1.0 if tenant else 0.0,
                "monthly_revenue": float(unit.get("rent") or 0),
                "health_score": _unit_health(base_health, unit),
                "hero_image": _DEFAULT_HEROES[index % len(_DEFAULT_HEROES)],
                "tenant_ids": [f"ten_{slug(tenant or unit_name)}"] if tenant else [],
                "owner_id": "own_1",
            }
        )

    return properties
