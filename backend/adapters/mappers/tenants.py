"""Map SPP_Official getAppData → Emergent TenantT[]."""

from __future__ import annotations

from typing import Any, Dict, List

from adapters.mappers.common import tenant_id, unit_property_id


def _reliability(unit: Dict[str, Any]) -> int:
    pay = str(unit.get("payStatus") or "")
    if "متأخر" in pay or "لم يسدد" in pay:
        return 68
    if unit.get("tenant"):
        return 92
    return 50


def map_tenants_from_app_data(app_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    units = (app_data.get("dashboard") or {}).get("units") or []
    tenants: List[Dict[str, Any]] = []

    for unit in units:
        name = str(unit.get("tenant") or "").strip()
        if not name:
            continue
        unit_name = str(unit.get("unit") or "")
        tenants.append(
            {
                "id": tenant_id(name, unit_name),
                "name": name,
                "property_id": unit_property_id(unit_name),
                "unit": unit_name,
                "since": str(unit.get("expiryDate") or "2023-01-01")[:10] or "2023-01-01",
                "rent": float(unit.get("rent") or 0),
                "reliability": _reliability(unit),
            }
        )

    return tenants
