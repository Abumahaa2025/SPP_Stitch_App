"""Map SPP_Official getAppData -> Emergent ContractT[].

Data quality: see backend/docs/DATA_QUALITY.md — duplicate contract rows may
survive when the same unit appears in multiple GAS dashboard arrays; dedup is
by unit|tenant only (intentional; do not change without sign-off).
"""

from __future__ import annotations

from typing import Any, Dict, List

from adapters.mappers.common import contract_id, tenant_id, unit_property_id


def _status(unit: Dict[str, Any]) -> str:
    resolved = str(unit.get("contractStatusResolved") or unit.get("contractStatus") or "")
    days_left = unit.get("daysLeft")

    if "منتهي" in resolved:
        return "expiring"
    if resolved == "قريب الانتهاء":
        return "expiring"
    if isinstance(days_left, (int, float)) and 0 <= days_left <= 45:
        return "expiring"
    if "تجديد" in resolved or "renewed" in resolved.lower():
        return "renewed"
    return "active"


def _contract_rows(app_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    dashboard = app_data.get("dashboard") or {}
    rows: List[Dict[str, Any]] = []
    seen = set()

    for source in (
        dashboard.get("units") or [],
        dashboard.get("nearContracts") or [],
        dashboard.get("expiredContracts") or [],
        dashboard.get("latePayments") or [],
    ):
        for unit in source:
            key = str(unit.get("unit") or "") + "|" + str(unit.get("tenant") or "")
            if key in seen:
                continue
            seen.add(key)
            if str(unit.get("tenant") or "").strip():
                rows.append(unit)

    return rows


def map_contracts_from_app_data(app_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    contracts: List[Dict[str, Any]] = []

    for index, unit in enumerate(_contract_rows(app_data)):
        tenant = str(unit.get("tenant") or "").strip()
        unit_name = str(unit.get("unit") or "")
        contracts.append(
            {
                "id": contract_id(str(unit.get("contractNo") or ""), index),
                "tenant_id": tenant_id(tenant, unit_name),
                "property_id": unit_property_id(unit_name),
                "start": "2023-01-01",
                "end": str(unit.get("expiryDate") or "2028-01-01"),
                "monthly_rent": float(unit.get("rent") or 0),
                "status": _status(unit),
            }
        )

    return contracts


def _parse_end_from_decision(decision: Dict[str, Any]) -> str:
    reason = str(decision.get("reason") or "")
    for token in reason.replace("·", " ").split():
        if len(token) >= 8 and token[4] == "-" and token[7] == "-":
            return token[:10]
    return "2028-01-01"


def reconcile_contracts(
    contracts: List[dict],
    decisions: List[dict],
    tenants: List[dict],
    properties: List[dict],
) -> List[dict]:
    """Ensure contracts list matches renewal signals used by Executive Brain."""
    by_property = {c.get("property_id"): c for c in contracts if c.get("property_id")}
    merged = list(contracts)

    tenant_by_property = {t.get("property_id"): t for t in tenants if t.get("property_id")}
    prop_by_id = {p.get("id"): p for p in properties if p.get("id")}

    for decision in decisions:
        if decision.get("kind") != "tenant":
            continue
        pid = decision.get("property_id")
        if not pid or pid in by_property:
            continue
        tenant = tenant_by_property.get(pid)
        if not tenant:
            continue
        prop = prop_by_id.get(pid, {})
        row = {
            "id": contract_id(f"synth_{pid}", len(merged)),
            "tenant_id": tenant["id"],
            "property_id": pid,
            "start": str(tenant.get("since") or "2023-01-01"),
            "end": _parse_end_from_decision(decision),
            "monthly_rent": float(tenant.get("rent") or prop.get("monthly_revenue") or 0),
            "status": "expiring",
        }
        by_property[pid] = row
        merged.append(row)

    order = {"expiring": 0, "active": 1, "renewed": 2}
    merged.sort(key=lambda c: (order.get(c.get("status", "active"), 9), c.get("end", "")))
    return merged
