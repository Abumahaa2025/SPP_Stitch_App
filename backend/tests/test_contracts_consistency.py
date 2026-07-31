"""Contracts must match Executive Brain renewal signals — one portfolio truth."""

from adapters.executive.brain import build_executive_brain
from adapters.executive.ranking import build_ranked_items
from adapters.mappers.contracts import map_contracts_from_app_data, reconcile_contracts
from adapters.mappers.decisions import map_decisions_from_app_data


def _gas_fixture():
    return {
        "dashboard": {
            "units": [
                {
                    "unit": "11",
                    "tenant": "ناصر منصور مفلح السلمي",
                    "rent": 2000,
                    "expiryDate": "2023-11-15",
                    "contractStatusResolved": "منتهي",
                    "daysLeft": -200,
                },
                {
                    "unit": "12",
                    "tenant": "خالد العتيبي",
                    "rent": 1500,
                    "expiryDate": "2026-08-01",
                    "contractStatusResolved": "قريب الانتهاء",
                    "daysLeft": 20,
                },
            ],
            "nearContracts": [
                {
                    "unit": "11",
                    "tenant": "ناصر منصور مفلح السلمي",
                    "rent": 2000,
                    "expiryDate": "2023-11-15",
                    "contractStatusResolved": "منتهي",
                },
            ],
            "latePayments": [],
            "expiredContracts": [],
        },
        "maintenanceRequests": [],
        "predictions": [],
    }


def test_properties_lite_payload_yields_contracts():
    bundle = _gas_fixture()
    contracts = map_contracts_from_app_data(bundle)
    assert len(contracts) >= 2
    assert any(c["status"] == "expiring" for c in contracts)


def test_reconcile_adds_tenant_decision_as_contract():
    bundle = _gas_fixture()
    decisions = map_decisions_from_app_data(bundle)
    tenants = [
        {
            "id": "ten_x",
            "name": "ناصر منصور",
            "property_id": "prop_orphan",
            "unit": "99",
            "since": "2023-01-01",
            "rent": 3000,
            "reliability": 80,
        }
    ]
    orphan_decision = {
        "id": "d_t_orphan",
        "kind": "tenant",
        "property_id": "prop_orphan",
        "reason": "Expires 2023-10-01 · متأخر",
        "priority": "high",
    }
    contracts = reconcile_contracts([], decisions + [orphan_decision], tenants, [])
    assert len(contracts) == 1
    assert contracts[0]["property_id"] == "prop_orphan"
    assert contracts[0]["status"] == "expiring"


def test_executive_renewals_have_matching_contracts():
    bundle = _gas_fixture()
    from adapters.mappers.properties import map_properties_from_app_data
    from adapters.mappers.tenants import map_tenants_from_app_data

    props = map_properties_from_app_data(bundle)
    tenants = map_tenants_from_app_data(bundle)
    decisions = map_decisions_from_app_data(bundle)
    contracts = reconcile_contracts(map_contracts_from_app_data(bundle), decisions, tenants, props)

    ranked = build_ranked_items(props, tenants, contracts, decisions)
    renewals = [r for r in ranked if r.get("kind") == "renewal"]
    expiring = [c for c in contracts if c.get("status") == "expiring"]

    assert expiring, "fixture must include expiring contracts"
    if renewals:
        renewal_pids = {r.get("property_id") for r in renewals if r.get("property_id")}
        contract_pids = {c.get("property_id") for c in expiring}
        assert renewal_pids <= contract_pids, "every executive renewal must exist in /api/contracts data"


def test_executive_and_contracts_share_expiring_count():
    bundle = _gas_fixture()
    from adapters.mappers.properties import map_properties_from_app_data
    from adapters.mappers.tenants import map_tenants_from_app_data

    props = map_properties_from_app_data(bundle)
    tenants = map_tenants_from_app_data(bundle)
    decisions = map_decisions_from_app_data(bundle)
    contracts = reconcile_contracts(map_contracts_from_app_data(bundle), decisions, tenants, props)

    brain = build_executive_brain({}, props, tenants, contracts, decisions)
    assert brain["portfolio"]["expiring_contracts"] == len([c for c in contracts if c["status"] == "expiring"])
