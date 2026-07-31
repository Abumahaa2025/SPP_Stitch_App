"""SPP Backend Regression Tests — local ASGI + seeded portfolio.

Uses FastAPI TestClient with in-memory seed so results do not depend on a
remote host that returns 404 or an empty beta portfolio.
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

API = "/api"


@pytest.fixture(scope="module")
def api_client():
    """Seed Alexander Vale demo portfolio into memory store."""
    spp_server._mongo_available = False
    spp_server._memory_insert_all(spp_server._seed_dataset())
    # Gap 3 (complete): reset AI state + portfolio cache so prior test
    # modules (e.g. test_gap3_lifecycle_propagation) don't leak imported
    # data into this module's assertions.
    spp_server._portfolio_cache = None
    spp_server._portfolio_cache_at = 0.0
    spp_server._memory_db.pop(spp_server._AI_STATE_COLLECTION, None)
    spp_server._memory_db.pop(spp_server._AI_STATE_LATEST_COLLECTION, None)
    spp_server._last_applied_analysis = None
    # Optional: AI key stub so chat does not 500 on missing key.
    if not spp_server.EMERGENT_LLM_KEY:
        spp_server.EMERGENT_LLM_KEY = "test-local-key"

    with TestClient(spp_server.app) as client:
        yield client


# ---------------- health ----------------
class TestHealth:
    def test_root(self, api_client):
        r = api_client.get(f"{API}/")
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "online"
        assert data["app"] == "SPP"


# ---------------- briefing (executive narrative) ----------------
class TestBriefing:
    def test_briefing_shape(self, api_client):
        r = api_client.get(f"{API}/briefing")
        assert r.status_code == 200
        data = r.json()
        for key in ["salutation", "owner_name", "headline", "narrative",
                    "portfolio_annual_revenue", "avg_health", "occupancy",
                    "properties_count", "tenants_count", "expiring_contracts",
                    "decisions", "sensor_alerts"]:
            assert key in data, f"missing key: {key}"

    def test_narrative_is_executive_voice(self, api_client):
        r = api_client.get(f"{API}/briefing")
        data = r.json()
        narrative = data["narrative"]
        assert isinstance(narrative, list), "narrative must be a list"
        assert 2 <= len(narrative) <= 6, f"narrative should have 3-4 lines, got {len(narrative)}"
        for line in narrative:
            assert isinstance(line, str) and len(line) > 10

    def test_briefing_numbers(self, api_client):
        r = api_client.get(f"{API}/briefing")
        data = r.json()
        assert data["properties_count"] == 4
        assert data["tenants_count"] == 4
        assert 0 <= data["avg_health"] <= 100
        assert 0 <= data["occupancy"] <= 100
        assert data["portfolio_annual_revenue"] > 0


# ---------------- properties / tenants / contracts ----------------
class TestPortfolio:
    def test_properties(self, api_client):
        r = api_client.get(f"{API}/properties")
        assert r.status_code == 200
        props = r.json()
        assert len(props) == 4
        assert all("_id" not in p for p in props)
        assert all({"id", "name", "health_score", "monthly_revenue"} <= set(p.keys()) for p in props)

    def test_property_by_id(self, api_client):
        r = api_client.get(f"{API}/properties/prop_1")
        assert r.status_code == 200
        assert r.json()["name"] == "Marina Crest Residences"

    def test_property_not_found(self, api_client):
        r = api_client.get(f"{API}/properties/does_not_exist")
        assert r.status_code == 404

    def test_tenants(self, api_client):
        r = api_client.get(f"{API}/tenants")
        assert r.status_code == 200
        tenants = r.json()
        assert len(tenants) == 4
        for t in tenants:
            assert 0 <= t["reliability"] <= 100
            assert t["rent"] > 0

    def test_contracts(self, api_client):
        r = api_client.get(f"{API}/contracts")
        assert r.status_code == 200
        contracts = r.json()
        assert len(contracts) == 4
        statuses = {c["status"] for c in contracts}
        assert statuses <= {"active", "expiring", "renewed"}
        assert any(c["status"] == "expiring" for c in contracts), "at least one expiring for countdown UI"


# ---------------- new premium surfaces ----------------
class TestReports:
    def test_reports_list(self, api_client):
        r = api_client.get(f"{API}/reports")
        assert r.status_code == 200
        reports = r.json()
        assert len(reports) >= 3
        for rep in reports:
            for k in ["id", "kind", "title", "subtitle", "highlight", "pages", "created_at"]:
                assert k in rep
            assert isinstance(rep["pages"], int) and rep["pages"] > 0


class TestKnowledge:
    def test_knowledge_list(self, api_client):
        r = api_client.get(f"{API}/knowledge")
        assert r.status_code == 200
        arts = r.json()
        assert len(arts) >= 3
        for a in arts:
            for k in ["id", "topic", "title", "body", "reading_minutes"]:
                assert k in a
            assert a["reading_minutes"] > 0


class TestGuides:
    def test_guides_list(self, api_client):
        r = api_client.get(f"{API}/guides")
        assert r.status_code == 200
        guides = r.json()
        assert len(guides) >= 3
        for g in guides:
            for k in ["id", "title", "duration", "level", "chapters", "poster"]:
                assert k in g
            assert g["poster"].startswith("http")


class TestOwner:
    def test_owner(self, api_client):
        r = api_client.get(f"{API}/owner")
        assert r.status_code == 200
        data = r.json()
        for k in ["id", "name", "portfolio_value", "properties"]:
            assert k in data
        assert data["name"] == "Alexander Vale"


# ---------------- verdicts (Unified Brain contextual verdicts) ----------------
class TestVerdicts:
    EXPECTED_KEYS = {
        "home", "portfolio", "insights", "health", "maintenance",
        "sensors", "tenants", "contracts", "notifications",
        "reports", "knowledge", "guides", "owner",
    }

    def test_verdicts_shape(self, api_client):
        r = api_client.get(f"{API}/verdicts")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, dict)
        assert set(data.keys()) == self.EXPECTED_KEYS, (
            f"missing/extra keys: {set(data.keys()) ^ self.EXPECTED_KEYS}"
        )
        assert len(data) == 13

    def test_verdict_fields(self, api_client):
        r = api_client.get(f"{API}/verdicts")
        data = r.json()
        for key, verdict in data.items():
            if verdict is None:
                continue
            for k in ("headline", "why", "action", "route"):
                assert k in verdict, f"{key} missing {k}"
                assert isinstance(verdict[k], str) and len(verdict[k]) > 0


# ---------------- ancillary ----------------
class TestAncillary:
    def test_decisions(self, api_client):
        r = api_client.get(f"{API}/decisions")
        assert r.status_code == 200
        decs = r.json()
        assert len(decs) >= 3
        priorities = {d["priority"] for d in decs}
        assert priorities <= {"critical", "high", "medium", "low"}

    def test_sensors(self, api_client):
        r = api_client.get(f"{API}/sensors")
        assert r.status_code == 200
        assert len(r.json()) >= 4

    def test_notifications(self, api_client):
        r = api_client.get(f"{API}/notifications")
        assert r.status_code == 200
        assert len(r.json()) >= 1

    def test_timeline(self, api_client):
        r = api_client.get(f"{API}/timeline")
        assert r.status_code == 200
        assert len(r.json()) >= 1


# ---------------- chat (graceful without live LLM) ----------------
class TestChat:
    def test_chat_endpoint(self, api_client, monkeypatch):
        async def fake_send(self, msg):  # noqa: ARG001
            return "Local regression reply."

        class FakeChat:
            async def send_message(self, msg):  # noqa: ARG002
                return "Local regression reply."

        monkeypatch.setattr(spp_server, "get_llm_chat", lambda session_id, system_message=None: FakeChat())
        sid = f"TEST_{uuid.uuid4()}"
        r = api_client.post(f"{API}/chat", json={"session_id": sid, "text": "Hello"}, timeout=60)
        assert r.status_code == 200, f"chat failed: {r.status_code} {r.text}"
        data = r.json()
        assert "reply" in data and isinstance(data["reply"], str) and len(data["reply"]) > 0
        assert "at" in data

    def test_chat_history_persistence(self, api_client, monkeypatch):
        class FakeChat:
            async def send_message(self, msg):  # noqa: ARG002
                return "Local regression reply."

        monkeypatch.setattr(spp_server, "get_llm_chat", lambda session_id, system_message=None: FakeChat())
        sid = f"TEST_{uuid.uuid4()}"
        api_client.post(f"{API}/chat", json={"session_id": sid, "text": "test-persist"}, timeout=60)
        r = api_client.get(f"{API}/chat/{sid}")
        assert r.status_code == 200
        msgs = r.json()
        assert len(msgs) >= 2  # user + assistant
        assert msgs[0]["role"] == "user"
        assert msgs[0]["text"] == "test-persist"
        assert msgs[1]["role"] == "assistant"
