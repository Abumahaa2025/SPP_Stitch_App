"""Executive Brain V2 — ranking, agenda, opportunities, daily brief."""

from datetime import date, timedelta

from adapters.mappers.brain_copy import sanitize_brain_text
from adapters.executive.brain import build_executive_brain
from adapters.executive.ranking import agenda_caps, build_ranked_items, tier_for_score


def _end_in(days: int) -> str:
    return (date.today() + timedelta(days=days)).isoformat()


def _property(i: int, *, occupancy: float = 1.0, health: int = 80, rent: float = 10000):
    return {
        "id": f"prop_{i}",
        "name": f"وحدة {i}",
        "address": f"مبنى {(i // 10) + 1}",
        "city": "الرياض",
        "kind": "apartment",
        "units": 1,
        "occupancy": occupancy,
        "monthly_revenue": rent,
        "health_score": health,
        "hero_image": "",
        "tenant_ids": [f"ten_{i}"] if occupancy >= 0.5 else [],
        "owner_id": "own_1",
    }


def _tenant(i: int):
    return {
        "id": f"ten_{i}",
        "name": f"مستأجر {i}",
        "property_id": f"prop_{i}",
        "unit": f"وحدة {i}",
        "since": "2023-01-01",
        "rent": 10000,
        "reliability": 70,
    }


def _contract(i: int, *, end_days: int = 15, status: str = "expiring", rent: float = 10000):
    return {
        "id": f"ct_{i}",
        "tenant_id": f"ten_{i}",
        "property_id": f"prop_{i}",
        "start": "2023-01-01",
        "end": _end_in(end_days),
        "monthly_rent": rent,
        "status": status,
    }


def _decision(i: int, *, kind: str = "financial", priority: str = "high", pid: str | None = None):
    return {
        "id": f"dec_{i}",
        "property_id": pid or f"prop_{i}",
        "kind": kind,
        "priority": priority,
        "title": f"قرار {i}",
        "summary": "متأخر عن السداد",
        "status": "open",
    }


def _portfolio_30():
    settings = {"clientName": "أحمد المنصور", "propertyName": "مجمع النخبة"}
    properties = [_property(i, occupancy=0.0 if i in (5, 12) else 1.0, health=55 if i == 3 else 80) for i in range(1, 31)]
    tenants = [_tenant(i) for i in range(1, 31) if i not in (5, 12)]
    contracts = [
        _contract(1, end_days=-5),
        _contract(2, end_days=7),
        _contract(3, end_days=20),
        _contract(4, end_days=45, status="active"),
    ]
    decisions = [
        _decision(1, kind="financial", priority="critical", pid="prop_1"),
        _decision(2, kind="maintenance", priority="high", pid="prop_3"),
        _decision(3, kind="maintenance", priority="medium", pid="prop_3"),
        _decision(4, kind="financial", priority="high", pid="prop_6"),
        _decision(5, kind="financial", priority="medium", pid="prop_7"),
        _decision(6, kind="financial", priority="low", pid="prop_8"),
    ]
    return settings, properties, tenants, contracts, decisions


def _portfolio_300():
    settings = {"clientName": "شركة الأفق العقارية"}
    properties = []
    for i in range(1, 301):
        occ = 0.0 if i % 25 == 0 else 1.0
        health = 50 if i % 17 == 0 else 85
        rent = 8000 + (i % 20) * 500
        properties.append(_property(i, occupancy=occ, health=health, rent=rent))
    tenants = [_tenant(i) for i in range(1, 301) if i % 25 != 0]
    contracts = [
        _contract(i, end_days=5 if i % 10 == 0 else 25, rent=12000 if i % 10 == 0 else 9000)
        for i in range(1, 41)
        if i % 3 == 0
    ]
    decisions = []
    for i in range(1, 61):
        decisions.append(
            _decision(
                i,
                kind="financial" if i % 4 == 0 else "maintenance",
                priority=["critical", "high", "medium", "low"][i % 4],
                pid=f"prop_{i}",
            )
        )
    return settings, properties, tenants, contracts, decisions


def test_tier_for_score():
    assert tier_for_score(80) == "now"
    assert tier_for_score(60) == "today"
    assert tier_for_score(40) == "week"
    assert tier_for_score(20) == "follow_up"
    assert tier_for_score(30, "critical") == "now"


def test_agenda_caps_scale():
    assert agenda_caps(30)["now"] == 5
    assert agenda_caps(100)["now"] == 6
    assert agenda_caps(300)["now"] == 8


def test_ranked_items_sorted_by_score():
    settings, props, tenants, contracts, decisions = _portfolio_30()
    ranked = build_ranked_items(props, tenants, contracts, decisions)
    assert len(ranked) >= 6
    scores = [r["score"] for r in ranked]
    assert scores == sorted(scores, reverse=True)
    assert all("title" in r and "action" in r and "tier" in r for r in ranked)


def test_opportunities_and_brief_structure_30_units():
    settings, props, tenants, contracts, decisions = _portfolio_30()
    result = build_executive_brain(settings, props, tenants, contracts, decisions)
    brief = result["daily_brief"]
    assert "what" in brief and brief["what"]
    assert "why" in brief and brief["why"]
    assert "outcome" in brief and brief["outcome"]
    assert "961" not in brief["why"] + brief["what"]
    assert "debug" not in brief["what"].lower()

    agenda = result["agenda"]
    assert set(agenda.keys()) >= {"now", "today", "this_week", "follow_up", "labels"}
    assert agenda["labels"]["now"] == "يجب تنفيذها الآن"

    caps = agenda_caps(30)
    assert len(agenda["now"]) <= caps["now"]
    assert len(agenda["today"]) <= caps["today"]

    opps = result["opportunities"]
    kinds = {o["kind"] for o in opps}
    assert "maintenance_batch" in kinds or "collection" in kinds or "rent_uplift" in kinds

    assert result["version"] == "executive-v2"
    assert result["portfolio"]["units"] == 30


def test_executive_brain_300_units_caps_and_performance():
    settings, props, tenants, contracts, decisions = _portfolio_300()
    result = build_executive_brain(settings, props, tenants, contracts, decisions)

    assert result["portfolio"]["units"] == 300
    caps = agenda_caps(300)
    agenda = result["agenda"]
    assert len(agenda["now"]) <= caps["now"]
    assert len(agenda["today"]) <= caps["today"]
    assert len(agenda["this_week"]) <= caps["week"]
    assert len(result["ranked_decisions"]) <= 50

    brief = result["daily_brief"]
    assert brief["what"]
    assert brief["why"]
    assert brief["outcome"]
    assert brief["focus_count"] >= 0


def test_sanitize_strips_phone_numbers():
    raw = "عين معالجة للبلاغ — ابومها — 966575051487"
    cleaned = sanitize_brain_text(raw)
    assert "966575051487" not in cleaned
    assert "ابومها" not in cleaned or "966" not in cleaned


def test_executive_portfolio_kpis():
    settings, props, tenants, contracts, decisions = _portfolio_30()
    result = build_executive_brain(settings, props, tenants, contracts, decisions)
    pf = result["portfolio"]
    assert pf["avg_health"] > 0
    assert pf["occupancy_pct"] >= 0
    assert pf["annual_revenue_aed"] > 0


def test_empty_portfolio_brief():
    result = build_executive_brain({}, [], [], [], [])
    brief = result["daily_brief"]
    assert "لا قرارات عاجلة" in brief["what"]
    assert result["agenda"]["now"] == []
