"""Tests for the AI Property Employee — Phase 1 endpoints.

Runs entirely in-memory (TestClient + beta seed). No Mongo, no LLM key needed.
Verifies:
  - /api/ai/employee/chat returns a grounded reply in local fallback mode
  - /api/ai/employee/suggestions returns rule-based proactive recommendations
  - /api/ai/employee/context returns the assembled snapshot
  - Legacy /api/chat still works (no regression)
  - The ai_employee module helpers (context_builder, intent, memory_retriever,
    recommendations, prompt_engineer) behave correctly in isolation.
"""
from __future__ import annotations

import os
import uuid

# Configure before importing server — memory store needs beta mode without Mongo.
os.environ.setdefault("SPP_BETA_MODE", "true")
os.environ.setdefault("SPP_DEMO_MODE", "true")
os.environ.setdefault("SPP_DATA_SOURCE", "mongo")
# Avoid GAS hybrid overriding memory seed during tests.
os.environ.pop("GAS_WEB_APP_URL", None)
os.environ.pop("GAS_DEPLOYMENT_URL", None)

import pytest
from fastapi.testclient import TestClient

import server as spp_server
from adapters.ai_employee import (
    build_employee_context,
    build_system_prompt,
    classify_intent,
    generate_proactive_suggestions,
    retrieve_relevant_memory,
)

API = "/api"


@pytest.fixture(scope="module")
def api_client():
    """Seed the demo portfolio into memory store + ensure no LLM key.

    Also resets the in-memory portfolio cache — other test modules (notably
    test_upload_apply_engines) overwrite _memory_db with CSV import data and
    populate _portfolio_cache. Without this reset, our AI employee tests
    would see the CSV-imported portfolio (Ahmad, Saad, Reem) instead of the
    seed portfolio (Marina Crest, Onyx Sky Loft, Priya Kapoor, etc.).
    """
    spp_server._mongo_available = False
    spp_server._memory_insert_all(spp_server._seed_dataset())
    # Critical: invalidate the cached portfolio context so the next
    # /api/* call rebuilds it from the freshly-seeded memory store.
    spp_server._portfolio_cache = None  # type: ignore[assignment]
    spp_server._portfolio_cache_at = 0.0  # type: ignore[assignment]
    # Force local fallback path (no LLM call).
    spp_server.EMERGENT_LLM_KEY = ""  # type: ignore[assignment]
    with TestClient(spp_server.app) as client:
        yield client


# ---------------- /api/ai/employee/chat ----------------
class TestAIEmployeeChat:
    def test_chat_returns_reply_and_intent(self, api_client):
        sid = f"TEST_{uuid.uuid4()}"
        r = api_client.post(
            f"{API}/ai/employee/chat",
            json={"session_id": sid, "text": "What should I do about Marina Crest?", "lang": "en"},
        )
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        data = r.json()
        assert "reply" in data and isinstance(data["reply"], str) and len(data["reply"]) > 0
        assert "at" in data
        assert data["session_id"] == sid
        assert "intent" in data
        assert data["intent"]["language_hint"] in ("en", "ar")
        # Used LLM should be False — no key configured.
        assert data["used_llm"] is False
        # Context summary must reflect that we matched at least one property.
        assert data["context_summary"]["properties_in_focus"] >= 1

    def test_chat_arabic_query(self, api_client):
        sid = f"TEST_{uuid.uuid4()}"
        r = api_client.post(
            f"{API}/ai/employee/chat",
            json={"session_id": sid, "text": "ماذا عن عقار Marina Crest؟", "lang": "ar"},
        )
        assert r.status_code == 200
        data = r.json()
        assert "reply" in data and len(data["reply"]) > 0
        # Arabic reply should contain Arabic characters.
        assert any("\u0600" <= ch <= "\u06FF" for ch in data["reply"])

    def test_chat_intent_classification_property(self, api_client):
        sid = f"TEST_{uuid.uuid4()}"
        r = api_client.post(
            f"{API}/ai/employee/chat",
            json={"session_id": sid, "text": "Tell me about Marina Crest Residences", "lang": "en"},
        )
        data = r.json()
        assert data["intent"]["kind"] == "property_query"
        assert data["intent"]["property_id"] != ""

    def test_chat_intent_classification_tenant(self, api_client):
        sid = f"TEST_{uuid.uuid4()}"
        r = api_client.post(
            f"{API}/ai/employee/chat",
            json={"session_id": sid, "text": "How reliable is Priya Kapoor?", "lang": "en"},
        )
        data = r.json()
        assert data["intent"]["kind"] == "tenant_query"
        assert data["intent"]["tenant_id"] != ""

    def test_chat_intent_classification_financial(self, api_client):
        sid = f"TEST_{uuid.uuid4()}"
        r = api_client.post(
            f"{API}/ai/employee/chat",
            json={"session_id": sid, "text": "What about my rent collection this month?", "lang": "en"},
        )
        data = r.json()
        assert data["intent"]["kind"] == "financial_query"

    def test_chat_persistence_to_history(self, api_client):
        sid = f"TEST_{uuid.uuid4()}"
        api_client.post(
            f"{API}/ai/employee/chat",
            json={"session_id": sid, "text": "Hello there", "lang": "en"},
        )
        # Same history endpoint that /api/chat uses.
        r = api_client.get(f"{API}/chat/{sid}")
        assert r.status_code == 200
        msgs = r.json()
        assert len(msgs) >= 2
        assert msgs[0]["role"] == "user"
        assert msgs[0]["text"] == "Hello there"
        assert msgs[1]["role"] == "assistant"


# ---------------- /api/ai/employee/suggestions ----------------
class TestAIEmployeeSuggestions:
    def test_suggestions_shape(self, api_client):
        r = api_client.get(f"{API}/ai/employee/suggestions")
        assert r.status_code == 200
        data = r.json()
        assert data["version"] == "ai-employee-v1"
        assert isinstance(data["suggestions"], list)
        assert data["count"] == len(data["suggestions"])
        assert "categories" in data
        cats = data["categories"]
        for k in ("critical", "important", "follow_up", "information"):
            assert k in cats
        # Sum of category counts must equal total count.
        assert sum(cats.values()) == data["count"]

    def test_suggestion_fields(self, api_client):
        r = api_client.get(f"{API}/ai/employee/suggestions")
        for s in r.json()["suggestions"]:
            for k in (
                "id", "category", "kind", "title", "reason", "action",
                "impact", "confidence", "route", "evidence",
            ):
                assert k in s, f"suggestion missing {k}: {s}"
            assert s["category"] in ("critical", "important", "follow_up", "information")
            assert 0 <= s["confidence"] <= 100
            assert isinstance(s["evidence"], list)

    def test_suggestions_sorted_by_category_then_confidence(self, api_client):
        r = api_client.get(f"{API}/ai/employee/suggestions")
        items = r.json()["suggestions"]
        if len(items) < 2:
            pytest.skip("not enough suggestions to verify sort order")
        order = {"critical": 0, "important": 1, "follow_up": 2, "information": 3}
        for a, b in zip(items, items[1:]):
            ca = order[a["category"]]
            cb = order[b["category"]]
            # Either category strictly less, OR same category and confidence >=.
            assert (ca < cb) or (ca == cb and a["confidence"] >= b["confidence"]), (
                f"sort violated: {a['category']}/{a['confidence']} then {b['category']}/{b['confidence']}"
            )

    def test_suggestions_never_empty_when_portfolio_has_data(self, api_client):
        # Seeded portfolio has 4 properties + tenants + contracts — must surface
        # at least one proactive suggestion.
        r = api_client.get(f"{API}/ai/employee/suggestions")
        assert r.json()["count"] >= 1


# ---------------- /api/ai/employee/context ----------------
class TestAIEmployeeContext:
    def test_context_shape(self, api_client):
        r = api_client.get(f"{API}/ai/employee/context")
        assert r.status_code == 200
        data = r.json()
        assert data["version"] == "ai-employee-v1"
        for k in (
            "owner_name", "currency", "portfolio_annual_revenue",
            "avg_health", "occupancy_pct", "expiring_contracts",
            "open_decisions", "properties_count", "tenants_count",
            "contracts_count", "decisions_count",
            "property_ids", "tenant_ids", "contract_ids",
        ):
            assert k in data, f"missing key: {k}"
        assert data["properties_count"] == 4
        assert data["tenants_count"] == 4
        assert data["contracts_count"] == 4
        assert len(data["property_ids"]) == 4
        assert len(data["tenant_ids"]) == 4
        assert len(data["contract_ids"]) == 4

    def test_context_no_pii(self, api_client):
        """Debug endpoint must never leak tenant names or contract numbers — only ids."""
        r = api_client.get(f"{API}/ai/employee/context")
        data = r.json()
        # Tenant ids are abstract (e.g. "tenant_1"), not names.
        text = str(data)
        for forbidden in ("Lina Haddad", "Marina Crest", "Alexander Vale"):
            assert forbidden not in text, f"PII leak: {forbidden} in context debug endpoint"


# ---------------- legacy /api/chat (regression guard) ----------------
class TestLegacyChatRegression:
    def test_legacy_chat_still_works(self, api_client, monkeypatch):
        """The original /api/chat endpoint must remain 100% unchanged in shape."""
        class FakeChat:
            async def send_message(self, msg):  # noqa: ARG002
                return "Legacy chat reply."

        monkeypatch.setattr(
            spp_server, "get_llm_chat",
            lambda session_id, system_message=None: FakeChat(),
        )
        # Need a key so the endpoint doesn't fall through to the error branch.
        old = spp_server.EMERGENT_LLM_KEY
        spp_server.EMERGENT_LLM_KEY = "test-key"
        try:
            sid = f"LEGACY_{uuid.uuid4()}"
            r = api_client.post(
                f"{API}/chat",
                json={"session_id": sid, "text": "Hello"},
            )
            assert r.status_code == 200
            data = r.json()
            # Legacy endpoint returns reply + at (shape unchanged).
            assert "reply" in data and isinstance(data["reply"], str) and len(data["reply"]) > 0
            assert "at" in data
            # Legacy endpoint does NOT include the new AI Employee fields.
            assert "intent" not in data
            assert "used_llm" not in data
            assert "context_summary" not in data
        finally:
            spp_server.EMERGENT_LLM_KEY = old


# ---------------- module-level unit tests ----------------
class TestIntentClassifier:
    def test_arabic_property_query(self):
        i = classify_intent("ماذا عن عقار Marina Crest؟")
        assert i.kind == "property_query"
        assert i.language_hint == "ar"

    def test_english_tenant_query(self):
        i = classify_intent(
            "How reliable is Lina Haddad?",
            properties=[],
            tenants=[{"id": "tenant_1", "name": "Lina Haddad"}],
            contracts=[],
        )
        assert i.kind == "tenant_query"
        assert i.tenant_id == "tenant_1"

    def test_general_fallback(self):
        i = classify_intent("Hello there")
        assert i.kind == "general"
        assert i.language_hint in ("en", "ar")

    def test_unit_extraction(self):
        i = classify_intent("What about unit A-101?")
        assert i.unit == "A-101"


class TestContextBuilder:
    def test_snapshot_compresses_portfolio(self):
        ctx = {
            "settings": {"clientName": "Alexander Vale", "currency": "SAR"},
            "properties": [
                {"id": "p1", "name": "Marina Crest", "kind": "apartment", "city": "Dubai",
                 "units": 12, "occupancy": 0.9, "monthly_revenue": 12000, "health_score": 88},
                {"id": "p2", "name": "Desert Pearl", "kind": "villa", "city": "Riyadh",
                 "units": 4, "occupancy": 0.5, "monthly_revenue": 8000, "health_score": 65},
            ],
            "tenants": [
                {"id": "t1", "name": "Lina Haddad", "property_id": "p1", "unit": "A-101",
                 "since": "2023-01-15", "rent": 2000, "reliability": 92},
                {"id": "t2", "name": "Karim Saad", "property_id": "p2", "unit": "V-1",
                 "since": "2022-06-01", "rent": 4000, "reliability": 55},
            ],
            "contracts": [
                {"id": "c1", "tenant_id": "t1", "property_id": "p1", "start": "2023-01-15",
                 "end": "2026-01-14", "monthly_rent": 2000, "status": "expiring"},
            ],
            "decisions": [
                {"id": "d1", "priority": "high", "kind": "financial", "title": "Collect arrears",
                 "recommended_action": "Send reminder", "confidence": 85, "property_id": "p2"},
            ],
            "reports": [],
        }
        emp = build_employee_context(ctx)
        snap_block = emp.snapshot.to_prompt_block()
        # Snapshot must include all key entities.
        assert "Marina Crest" in snap_block
        assert "Lina Haddad" in snap_block
        assert "expiring" in snap_block
        assert "Collect arrears" in snap_block
        # And the aggregate metrics.
        assert "Avg health" in snap_block
        assert "Occupancy" in snap_block
        # Annual revenue = (12000 + 8000) * 12 = 240000.
        assert emp.snapshot.portfolio_annual_revenue == 240000.0


class TestMemoryRetriever:
    def test_property_query_matches_named_property(self):
        ctx = {
            "settings": {},
            "properties": [
                {"id": "p1", "name": "Marina Crest", "kind": "apartment", "city": "Dubai",
                 "units": 12, "occupancy": 0.4, "monthly_revenue": 12000, "health_score": 55},
            ],
            "tenants": [
                {"id": "t1", "name": "Lina Haddad", "property_id": "p1", "unit": "A-101",
                 "since": "2023-01-15", "rent": 2000, "reliability": 92},
            ],
            "contracts": [], "decisions": [], "reports": [],
        }
        emp = build_employee_context(ctx)
        intent = classify_intent(
            "Tell me about Marina Crest",
            properties=emp.properties,
            tenants=emp.tenants,
            contracts=emp.contracts,
        )
        assert intent.property_id == "p1"
        retrieval = retrieve_relevant_memory(emp, intent)
        assert len(retrieval.properties) == 1
        assert retrieval.properties[0]["id"] == "p1"
        # Property has health 55 (<70) and occupancy 40% (<50%) → at least 2 notes.
        assert len(retrieval.notes) >= 2
        assert any("Marina Crest" in n for n in retrieval.notes)
        assert any("health is 55" in n for n in retrieval.notes)


class TestRecommendations:
    def test_payment_risk_surfaces_low_reliability_tenants(self):
        ctx = {
            "settings": {"currency": "SAR"},
            "properties": [
                {"id": "p1", "name": "Test", "kind": "villa", "city": "X",
                 "units": 1, "occupancy": 1.0, "monthly_revenue": 5000, "health_score": 90},
            ],
            "tenants": [
                {"id": "t1", "name": "Risky", "property_id": "p1", "unit": "V-1",
                 "since": "2023-01-01", "rent": 5000, "reliability": 40},
            ],
            "contracts": [], "decisions": [], "reports": [],
        }
        emp = build_employee_context(ctx)
        sugs = generate_proactive_suggestions(emp)
        kinds = {s.kind for s in sugs}
        assert "payment_risk" in kinds
        risk = next(s for s in sugs if s.kind == "payment_risk")
        assert risk.tenant_id == "t1"
        assert risk.category == "critical"  # rel < 50 → critical
        assert risk.confidence >= 80

    def test_no_suggestions_on_healthy_portfolio(self):
        ctx = {
            "settings": {"currency": "SAR"},
            "properties": [
                {"id": "p1", "name": "Healthy", "kind": "villa", "city": "X",
                 "units": 1, "occupancy": 1.0, "monthly_revenue": 5000, "health_score": 95},
            ],
            "tenants": [
                {"id": "t1", "name": "Reliable", "property_id": "p1", "unit": "V-1",
                 "since": "2023-01-01", "rent": 5000, "reliability": 95},
            ],
            "contracts": [
                {"id": "c1", "tenant_id": "t1", "property_id": "p1", "start": "2023-01-01",
                 "end": "2099-01-01", "monthly_rent": 5000, "status": "active"},
            ],
            "decisions": [], "reports": [],
        }
        emp = build_employee_context(ctx)
        sugs = generate_proactive_suggestions(emp)
        # No payment risk, no vacancy, no expiring, no decisions → empty.
        assert sugs == []


class TestPromptEngineer:
    def test_prompt_includes_snapshot_and_focused_context(self):
        ctx = {
            "settings": {"clientName": "Alexander Vale", "currency": "SAR"},
            "properties": [
                {"id": "p1", "name": "Marina Crest", "kind": "apartment", "city": "Dubai",
                 "units": 12, "occupancy": 0.9, "monthly_revenue": 12000, "health_score": 88},
            ],
            "tenants": [], "contracts": [], "decisions": [], "reports": [],
        }
        emp = build_employee_context(ctx)
        intent = classify_intent("Tell me about Marina Crest")
        intent.property_id = "p1"
        retrieval = retrieve_relevant_memory(emp, intent)
        prompt = build_system_prompt(emp, retrieval, lang="en")
        # Voice + rules section.
        assert "AI Property Employee" in prompt
        assert "PORTFOLIO SNAPSHOT" in prompt
        # Snapshot content.
        assert "Marina Crest" in prompt
        # Focused context section.
        assert "FOCUSED CONTEXT" in prompt
        # Currency token substitution.
        assert "SAR" in prompt
