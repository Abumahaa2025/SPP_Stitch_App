"""Unit tests for GAS → Emergent mappers (no Mongo / network)."""

from adapters.mappers.contracts import map_contracts_from_app_data
from adapters.mappers.decisions import map_decisions_from_app_data
from adapters.mappers.notifications import map_notifications_from_app_data
from adapters.mappers.reports import map_reports_from_app_data
from adapters.mappers.tenants import map_tenants_from_app_data

SAMPLE = {
    "settings": {"propertyName": "مجمع النخبة", "clientName": "أحمد"},
    "propertyHealth": {"score": 84},
    "report": {"collectionRate": 92, "lateTotal": 5000},
    "expenses": {"netProfit": 45000},
    "dashboard": {
        "summary": {"totalUnits": 2, "rented": 1, "totalRent": 15000},
        "units": [
            {
                "unit": "وحدة 3",
                "tenant": "خالد العتيبي",
                "rent": 12500,
                "payStatus": "متأخر",
                "contractStatusResolved": "نشط",
                "expiryDate": "2026-12-01",
                "contractNo": "C-101",
            },
            {"unit": "وحدة 7", "tenant": "", "rent": 8000},
        ],
        "nearContracts": [
            {
                "unit": "وحدة 3",
                "tenant": "خالد العتيبي",
                "rent": 12500,
                "expiryDate": "2026-08-01",
                "daysDisplay": "45 days",
                "contractStatusResolved": "قريب الانتهاء",
            }
        ],
        "latePayments": [
            {"unit": "وحدة 3", "tenant": "خالد العتيبي", "rent": 12500, "payStatus": "متأخر"}
        ],
    },
    "maintenanceRequests": [
        {
            "ticketNo": "M-1",
            "unit": "وحدة 3",
            "tenant": "خالد",
            "type": "تكييف",
            "status": "مفتوح",
            "risk": "عالي",
        }
    ],
    "predictions": [
        {"title": "تنبيه تحصيل", "level": "عالي", "recommendation": "تابع المتأخرات"}
    ],
    "messages": [{"category": "WhatsApp", "phone": "+9665", "status": "sent"}],
}


def test_map_tenants_skips_vacant():
    tenants = map_tenants_from_app_data(SAMPLE)
    assert len(tenants) == 1
    assert tenants[0]["name"] == "خالد العتيبي"
    assert tenants[0]["rent"] == 12500
    assert tenants[0]["id"].startswith("ten_")


def test_map_contracts_dedupes_and_status():
    contracts = map_contracts_from_app_data(SAMPLE)
    assert len(contracts) >= 1
    assert contracts[0]["monthly_rent"] == 12500
    assert contracts[0]["status"] in ("active", "expiring", "renewed")


def test_map_decisions_includes_maintenance_and_late():
    decisions = map_decisions_from_app_data(SAMPLE)
    kinds = {d["kind"] for d in decisions}
    assert "maintenance" in kinds
    assert "financial" in kinds
    assert all(d["priority"] in ("critical", "high", "medium", "low") for d in decisions)


def test_map_reports_shape():
    reports = map_reports_from_app_data(SAMPLE)
    assert len(reports) == 3
    assert reports[0]["kind"] == "monthly"
    assert reports[0]["accent"] in ("gold", "emerald")


def test_map_notifications_sorted():
    notes = map_notifications_from_app_data(SAMPLE)
    assert len(notes) >= 2
    assert notes[0]["at"] >= notes[-1]["at"]
    assert "read" in notes[0]
