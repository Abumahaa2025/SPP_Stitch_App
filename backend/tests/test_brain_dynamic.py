"""Unit tests for Brain copy, briefing, and verdict builders."""

from datetime import date, timedelta

from adapters.mappers.brain_copy import (
    contract_renewal_action,
    contract_renewal_guidance,
    days_until,
    sanitize_brain_text,
)
from adapters.mappers.briefing import build_briefing
from adapters.mappers.verdicts import build_verdicts


def _fixture_contract(end: str, status: str = "expiring"):
    return {
        "id": "ct_1",
        "tenant_id": "ten_1",
        "property_id": "prop_a",
        "start": "2023-01-01",
        "end": end,
        "monthly_rent": 12500,
        "status": status,
    }


def _fixture_bundle(contract):
    settings = {"clientName": "أحمد المنصور", "propertyName": "مجمع النخبة"}
    properties = [
        {
            "id": "prop_a",
            "name": "وحدة 3",
            "address": "مجمع النخبة",
            "city": "الرياض",
            "kind": "apartment",
            "units": 1,
            "occupancy": 1.0,
            "monthly_revenue": 12500,
            "health_score": 55,
            "hero_image": "",
            "tenant_ids": ["ten_1"],
            "owner_id": "own_1",
        }
    ]
    tenants = [
        {
            "id": "ten_1",
            "name": "خالد العتيبي",
            "property_id": "prop_a",
            "unit": "وحدة 3",
            "since": "2023-01-01",
            "rent": 12500,
            "reliability": 68,
        }
    ]
    return settings, properties, tenants, [contract], [], [], []


def test_expired_contract_guidance():
    text = contract_renewal_guidance(-961)
    assert text == "العقد متأخر عن التجديد منذ فترة طويلة ويحتاج متابعة فورية."
    assert "961" not in text
    assert contract_renewal_action(-961) == "اتصل بالمستأجر وافتح ملف التجديد فوراً"


def test_soon_contract_guidance_10_days():
    assert contract_renewal_guidance(10) == "يُنصح ببدء إجراءات التجديد الآن."
    assert contract_renewal_action(10) == "ابدأ إجراءات التجديد الآن"


def test_far_contract_guidance_65_days():
    assert contract_renewal_guidance(65) == (
        "لا يحتاج إجراء حاليًا، ويُعاد تقييمه قبل شهر من الانتهاء."
    )


def test_expired_contract_in_briefing_and_verdicts():
    settings, props, tenants, contracts, decisions, reports, notifications = _fixture_bundle(
        _fixture_contract("2023-11-15")
    )
    briefing = build_briefing(settings, props, tenants, contracts, decisions, reports)
    bag = build_verdicts(props, tenants, contracts, decisions, reports, notifications)

    end_days = days_until("2023-11-15")
    renewal_line = next(line for line in briefing["narrative"] if line.startswith("التجديدات"))
    assert "فترة طويلة" in renewal_line or "فورياً" in renewal_line
    assert "961" not in renewal_line
    assert "اتصل بالمستأجر" in renewal_line
    assert bag["contracts"] is not None
    assert bag["contracts"]["why"] == contract_renewal_guidance(end_days)
    assert bag["insights"] is not None
    assert "فترة طويلة" in bag["insights"]["why"]


def test_sanitize_negative_days_leak():
    raw = "nearest ends in -961 days (2023-11-15)"
    clean = sanitize_brain_text(raw)
    assert "-961" not in clean
    assert "فترة طويلة" in clean


def test_financial_decision_polished_for_briefing():
    settings, props, tenants, contracts, _, reports, notifications = _fixture_bundle(
        _fixture_contract("2026-12-01")
    )
    decisions = [
        {
            "id": "d_f_1",
            "priority": "high",
            "kind": "financial",
            "title": "Late rent — وحدة 3",
            "reason": "خالد · متأخر",
            "impact": "Outstanding ≈ 12,500 per month.",
            "recommended_action": "Send reminder and schedule follow-up within 24 hours.",
            "confidence": 90,
            "property_id": "prop_a",
            "created_at": "2026-07-03T00:00:00+00:00",
        }
    ]
    briefing = build_briefing(settings, props, tenants, contracts, decisions, reports)
    assert "Outstanding" not in briefing["narrative"][0]
    assert "تابع التحصيل" in briefing["narrative"][0]
    assert briefing["decisions"][0]["title"].startswith("حصّل إيجار")


def test_contract_expiring_in_10_days_examples():
    end = (date.today() + timedelta(days=10)).isoformat()
    settings, props, tenants, contracts, decisions, reports, notifications = _fixture_bundle(
        _fixture_contract(end)
    )
    briefing = build_briefing(settings, props, tenants, contracts, decisions, reports)
    bag = build_verdicts(props, tenants, contracts, decisions, reports, notifications)

    renewal_line = next(line for line in briefing["narrative"] if line.startswith("التجديدات"))
    assert "يُنصح ببدء إجراءات التجديد الآن" in renewal_line
    assert "ابدأ إجراءات التجديد الآن" in renewal_line

    assert bag["contracts"]["why"] == "يُنصح ببدء إجراءات التجديد الآن."
    assert bag["contracts"]["action"] == "ابدأ إجراءات التجديد الآن"
    assert bag["insights"]["action"] == "ابدأ إجراءات التجديد الآن"
