"""Tests for canonical model, normalization, portfolio memory, and intelligence."""

from datetime import datetime, timedelta, timezone

from adapters.canonical.pipeline import legacy_api_payload, portfolio_from_bundles
from adapters.executive_intelligence.engine import generate_insights
from adapters.normalize.dates import parse_date
from adapters.normalize.enums import contract_status, payment_status
from adapters.normalize.money import parse_money
from adapters.normalize.text import normalize_unit_label, stable_id
from adapters.portfolio_memory.graph import build_memory_graph

EN_BUNDLE = {
    "settings": {
        "portfolioName": "Harbor View",
        "city": "London",
        "currency": "GBP",
        "locale": "en",
    },
    "dashboard": {
        "units": [
            {
                "unitNo": "Flat 2A",
                "tenantName": "Jane Smith",
                "monthlyRent": "1,250.00",
                "endDate": "2026-03-15",
                "paymentStatus": "overdue",
                "status": "active",
            },
            {
                "unit": "Flat 4B",
                "tenant": "Vacant Unit",
                "rent": 0,
            },
        ],
        "nearContracts": [
            {
                "unitNo": "Flat 2A",
                "tenantName": "Jane Smith",
                "monthlyRent": 1250,
                "endDate": (datetime.now(timezone.utc) + timedelta(days=20)).strftime("%Y-%m-%d"),
                "contractStatus": "expiring soon",
            }
        ],
        "latePayments": [
            {"unitNo": "Flat 2A", "tenantName": "Jane Smith", "lateText": "past due"}
        ],
    },
}

AR_BUNDLE = {
    "settings": {"propertyName": "مجمع السكن", "currency": "SAR"},
    "dashboard": {
        "units": [
            {
                "unit": "وحدة 5",
                "tenant": "محمد",
                "rent": "٨٬٥٠٠",
                "payStatus": "متأخر",
                "expiryDate": "2026-11-01",
            }
        ]
    },
}

MEMORY_BUNDLE = {
    "assets": [
        {
            "id": "ac_1",
            "name": "Rooftop AC",
            "type": "ac",
            "unit": "Flat 2A",
            "installDate": "2018-06-01",
            "warrantyEnd": (datetime.now(timezone.utc) + timedelta(days=10)).strftime("%Y-%m-%d"),
            "lifespanYears": 12,
            "totalCost": 12000,
            "faultCount": 4,
        }
    ],
    "events": [
        {
            "assetId": "ac_1",
            "date": "2025-01-01",
            "eventType": "fault",
            "description": "Compressor failure",
            "cost": 800,
        },
        {
            "assetId": "ac_1",
            "date": "2025-06-01",
            "eventType": "maintenance",
            "cost": 600,
        },
        {
            "assetId": "ac_1",
            "date": "2025-09-01",
            "eventType": "fault",
            "cost": 900,
        },
    ],
}


def test_normalize_money_multiformat():
    assert parse_money("1,250.00") == 1250.0
    assert parse_money("٨٬٥٠٠") == 8500.0
    assert parse_money("$2,400") == 2400.0


def test_normalize_enums_language_agnostic():
    assert payment_status("past due") == "late"
    assert payment_status("متأخر") == "late"
    assert contract_status("expiring soon", days_left=20) == "expiring"


def test_stable_ids_ignore_founder_sheet_names():
    a = stable_id(normalize_unit_label("Flat 2A"), prefix="unit")
    b = stable_id(normalize_unit_label("flat 2a"), prefix="unit")
    assert a == b


def test_canonical_portfolio_from_en_bundle():
    portfolio = portfolio_from_bundles(dashboard=EN_BUNDLE)
    assert portfolio.settings.currency == "GBP"
    assert portfolio.settings.city == "London"
    assert portfolio.unit_count >= 1
    occupied = [u for u in portfolio.units if u.tenant_name]
    assert any(u.label.startswith("Flat") for u in occupied)
    assert any(u.payment_status == "late" for u in occupied)


def test_canonical_portfolio_from_ar_bundle():
    portfolio = portfolio_from_bundles(dashboard=AR_BUNDLE)
    assert portfolio.settings.currency == "SAR"
    assert portfolio.monthly_revenue == 8500.0


def test_legacy_emit_backward_compatible_shapes():
    portfolio = portfolio_from_bundles(dashboard=EN_BUNDLE, memory=MEMORY_BUNDLE)
    payload = legacy_api_payload(portfolio, base_health=80, merge_intelligence=True)
    props = payload["properties"]
    tenants = payload["tenants"]
    contracts = payload["contracts"]
    decisions = payload["decisions"]

    assert props and props[0]["id"].startswith("prop_")
    assert "health_score" in props[0]
    assert tenants and tenants[0]["id"].startswith("ten_")
    assert contracts and contracts[0]["id"].startswith("ct_")
    assert decisions and all(d["priority"] in ("critical", "high", "medium", "low") for d in decisions)


def test_portfolio_memory_graph_from_canonical():
    portfolio = portfolio_from_bundles(dashboard=EN_BUNDLE, memory=MEMORY_BUNDLE)
    graph = build_memory_graph(portfolio)
    assert graph.summary["total_assets"] >= 1
    ac = next(p for p in graph.profiles if p.asset.asset_id == "ac_1")
    assert ac.fault_count >= 3
    assert ac.risk in ("medium", "high", "critical")


def test_executive_intelligence_repeat_repair_and_warranty():
    portfolio = portfolio_from_bundles(dashboard=EN_BUNDLE, memory=MEMORY_BUNDLE)
    insights = generate_insights(portfolio)
    scenarios = {i.scenario for i in insights}
    assert "repeat_repair" in scenarios or "warranty_window" in scenarios


def test_parse_date_iso_and_slash():
    assert parse_date("2026-03-15") == "2026-03-15"
    assert parse_date("15/03/2026") == "2026-03-15"
