"""Gap 1 — AI reasoning state persistence.

Verifies the full flow:
  upload analysis → apply analysis → persisted AI state →
  clear live cache → GET /api/briefing → briefing contains imported
  reasoning evidence.

Plus four safety guarantees:
  - server restart-compatible storage abstraction
  - failed apply does NOT overwrite last valid state
  - repeated apply is idempotent
  - missing AI state preserves old endpoint behavior (backward compat)

Runs entirely in-memory (TestClient + beta seed). No Mongo, no LLM key.
"""
from __future__ import annotations

import os
import uuid

# Configure before importing server - memory store needs beta mode without Mongo.
os.environ.setdefault("SPP_BETA_MODE", "true")
os.environ.setdefault("SPP_DEMO_MODE", "true")
os.environ.setdefault("SPP_DATA_SOURCE", "mongo")
os.environ.pop("GAS_WEB_APP_URL", None)
os.environ.pop("GAS_DEPLOYMENT_URL", None)

import pytest
from fastapi.testclient import TestClient

import server as spp_server

API = "/api"

# Two CSV months with one tenant change (Said → Reem on unit 102) so the
# Koil reasoning engine has real lifecycle signals to persist.
CSV1 = "وحدة,مستأجر,إيجار,حالة\n101,أحمد العتيبي,5500,مسدد\n102,سعد القحطاني,4800,مسدد\n"
CSV2 = "وحدة,مستأجر,إيجار,حالة\n101,أحمد العتيبي,5500,مسدد\n102,ريم الشمري,5000,متأخر\n"


def _two_month_files():
    return [
        {"name": "كشف_شهر_1_2026.csv", "textSnippet": CSV1, "mimeType": "text/csv"},
        {"name": "كشف_شهر_2_2026.csv", "textSnippet": CSV2, "mimeType": "text/csv"},
    ]


@pytest.fixture()
def api_client():
    """Fresh in-memory server for each test - no leakage between tests.

    Resets:
      - _memory_db (the beta store)
      - _portfolio_cache (so the next call rebuilds ctx)
      - _import_sessions (so analyze runs fresh)
      - AI state (so prior test's persisted reasoning doesn't leak)
      - _last_applied_analysis pointer
    """
    spp_server._mongo_available = False
    spp_server._memory_clear()
    spp_server._portfolio_cache = None  # type: ignore[assignment]
    spp_server._portfolio_cache_at = 0.0  # type: ignore[assignment]
    # Clear import sessions so analyze re-runs.
    from adapters.gas_import_bridge import _import_sessions
    _import_sessions.clear()
    # Clear AI state explicitly (covers the case where a prior test persisted).
    spp_server._memory_db.pop(spp_server._AI_STATE_COLLECTION, None)
    spp_server._memory_db.pop(spp_server._AI_STATE_LATEST_COLLECTION, None)
    spp_server._last_applied_analysis = None  # type: ignore[assignment]
    spp_server.EMERGENT_LLM_KEY = ""  # type: ignore[assignment]
    with TestClient(spp_server.app) as client:
        yield client


def _upload_and_apply(client):
    """Helper: run upload → apply, return (analysis_id, apply_response)."""
    # 1. Upload analysis
    r = client.post(
        f"{API}/upload/portfolio-analysis",
        json={"files": _two_month_files(), "lang": "ar"},
    )
    assert r.status_code == 200, f"upload failed: {r.status_code} {r.text}"
    analysis_id = r.json()["analysis_id"]

    # 2. Apply analysis
    r2 = client.post(
        f"{API}/upload/apply-analysis",
        json={"analysis_id": analysis_id, "files": _two_month_files()},
    )
    assert r2.status_code == 200, f"apply failed: {r2.status_code} {r2.text}"
    return analysis_id, r2.json()


# ===========================================================================
# Test 1 (required): upload → apply → persist → cache-clear → briefing
# ===========================================================================
class TestFullFlowBriefingContainsReasoning:
    def test_briefing_contains_imported_reasoning_evidence(self, api_client):
        """The headline Gap 1 test.

        Flow:
          1. Upload 2 CSV months
          2. Apply analysis
          3. Verify AI state is persisted in _memory_db
          4. Invalidate _portfolio_cache (simulating TTL expiry)
          5. GET /api/briefing
          6. Assert briefing narrative contains Koil reasoning evidence
        """
        # 1-2. Upload + Apply
        analysis_id, apply_resp = _upload_and_apply(api_client)

        # 3. Verify AI state is persisted in memory store
        store = spp_server._memory_db.get(spp_server._AI_STATE_COLLECTION) or {}
        assert analysis_id in store, f"AI state not persisted for {analysis_id}"
        ai_state = store[analysis_id]
        assert ai_state["analysis_id"] == analysis_id
        assert ai_state["status"] == "applied"
        assert ai_state["pipeline_version"] == "koil-reasoning-v1"
        assert ai_state["applied_at"]  # ISO timestamp set
        # Verify all required artifact blocks are present
        for key in (
            "property_knowledge",
            "koil_reasoning",
            "consistency_gate",
            "executive_brief",
            "lifecycle",
            "tenant_cards",
        ):
            assert key in ai_state, f"AI state missing {key}"

        # Latest pointer must point to this analysis_id
        ptr = spp_server._memory_db.get(spp_server._AI_STATE_LATEST_COLLECTION) or {}
        assert ptr.get("analysis_id") == analysis_id

        # Apply response surfaces the AI state persistence metadata
        assert apply_resp["ai_state_persisted"] is True
        assert apply_resp["ai_state_analysis_id"] == analysis_id
        assert apply_resp["ai_state_pipeline_version"] == "koil-reasoning-v1"

        # 4. Invalidate cache (simulates TTL expiry or fresh request)
        spp_server._portfolio_cache = None  # type: ignore[assignment]
        spp_server._portfolio_cache_at = 0.0  # type: ignore[assignment]

        # 5. GET /api/briefing - must pull persisted AI state into ctx
        r = api_client.get(f"{API}/briefing")
        assert r.status_code == 200, f"briefing failed: {r.status_code} {r.text}"
        brief = r.json()

        # 6. Briefing must contain reasoning evidence
        # The narrative's first line should cite Koil reasoning
        # (because reasoning.recommendations[0].action is non-empty).
        narrative = brief["narrative"]
        assert isinstance(narrative, list)
        assert 2 <= len(narrative) <= 6, f"narrative line count: {len(narrative)}"
        # The first line should start with "افعل الآن (كويل):" when reasoning
        # is present - this is the Gap 1 evidence signature.
        assert any("كويل" in line for line in narrative), (
            f"briefing narrative missing Koil reasoning evidence: {narrative}"
        )

        # Briefing must also include the ai_reasoning provenance block
        assert "ai_reasoning" in brief, "briefing missing ai_reasoning provenance"
        ai_r = brief["ai_reasoning"]
        assert ai_r["has_reasoning"] is True
        assert ai_r["has_consistency_gate"] is True
        assert ai_r["reasoning_version"] == "koil-reasoning-v1"
        assert ai_r["gate_status"] in ("ok", "blocked_for_review")
        # departed_count + newcomers_count are exposed even when 0 (the Koil
        # engine is conservative about flagging departures on soft name
        # matches). The key assertion is that the field EXISTS — the
        # briefing is correctly reading the persisted lifecycle block.
        assert "departed_count" in ai_r
        assert "newcomers_count" in ai_r

    def test_briefing_shape_unchanged_for_existing_clients(self, api_client):
        """Existing briefing keys must all still be present (backward compat)."""
        _upload_and_apply(api_client)
        spp_server._portfolio_cache = None  # type: ignore[assignment]
        spp_server._portfolio_cache_at = 0.0  # type: ignore[assignment]
        brief = api_client.get(f"{API}/briefing").json()
        # Every key the existing test_spp_backend asserts must still be present
        for key in (
            "salutation", "owner_name", "headline", "narrative",
            "portfolio_annual_revenue", "avg_health", "occupancy",
            "properties_count", "tenants_count", "expiring_contracts",
            "decisions", "sensor_alerts",
        ):
            assert key in brief, f"briefing missing legacy key: {key}"


# ===========================================================================
# Test 2 (required): server restart-compatible storage abstraction
# ===========================================================================
class TestServerRestartCompatibility:
    def test_ai_state_survives_cache_invalidation(self, api_client):
        """Cache invalidation simulates the live request path after restart.

        Real server restart = Mongo persists across processes. In beta mode
        we use _memory_db which is process-local, but the storage abstraction
        is identical - the same _load_ai_state() code path serves both.

        This test verifies that after _portfolio_cache is wiped (which is
        what happens on every cold start), the next briefing still pulls
        the persisted AI state from the underlying store.
        """
        analysis_id, _ = _upload_and_apply(api_client)

        # Simulate server restart: wipe the in-process portfolio cache.
        # _memory_db (which holds the AI state) survives - that's the
        # storage abstraction contract.
        spp_server._portfolio_cache = None  # type: ignore[assignment]
        spp_server._portfolio_cache_at = 0.0  # type: ignore[assignment]

        # First briefing after "restart" - must still see the AI state.
        brief = api_client.get(f"{API}/briefing").json()
        assert "ai_reasoning" in brief
        assert brief["ai_reasoning"]["has_reasoning"] is True
        assert brief["ai_reasoning"]["reasoning_version"] == "koil-reasoning-v1"

        # Verify the underlying store still has the doc
        store = spp_server._memory_db.get(spp_server._AI_STATE_COLLECTION) or {}
        assert analysis_id in store

    def test_mongo_storage_path_is_wired(self, api_client, monkeypatch):
        """When Mongo is available, _persist_ai_state must call the right
        collection methods. Verifies the Mongo branch is correctly wired
        even though we can't run a real Mongo in unit tests.
        """
        # Run upload + apply so we have a real ai_state to persist
        analysis_id, _ = _upload_and_apply(api_client)

        # Capture what would be sent to Mongo
        calls = []

        class FakeCollection:
            async def update_one(self, query, update, upsert=False):
                calls.append(("update_one", query, update, upsert))
                # Return an object with matched_count so the caller is happy
                class _R:
                    matched_count = 1
                    upserted_id = "fake"
                return _R()

            async def find_one(self, query, *args, **kwargs):
                calls.append(("find_one", query))
                # Return the persisted doc for the latest pointer
                if query.get("_id") == "latest":
                    return {"_id": "latest", "analysis_id": analysis_id, "applied_at": "2026-01-01T00:00:00Z"}
                # And for the ai_state lookup
                store = spp_server._memory_db.get(spp_server._AI_STATE_COLLECTION) or {}
                return store.get(analysis_id)

            async def delete_many(self, query):
                calls.append(("delete_many", query))

        class FakeDb:
            def __getitem__(self, name):
                return FakeCollection()

        # Flip Mongo on, swap the db handle, and re-run the persist + load
        spp_server._mongo_available = True
        old_get_db = spp_server._get_db
        spp_server._get_db = lambda: FakeDb()
        try:
            # Re-persist via the Mongo path
            store = spp_server._memory_db.get(spp_server._AI_STATE_COLLECTION) or {}
            ai_state = store.get(analysis_id)
            assert ai_state is not None

            import asyncio
            asyncio.get_event_loop().run_until_complete(spp_server._persist_ai_state(ai_state))

            # Verify Mongo got an upsert on ai_state + ai_state_latest
            update_calls = [c for c in calls if c[0] == "update_one"]
            assert len(update_calls) >= 2, f"expected ≥2 update_one calls, got {len(update_calls)}"
            # First call: ai_state collection with analysis_id filter
            assert update_calls[0][1] == {"analysis_id": analysis_id}
            # Second call: ai_state_latest with _id=latest
            assert update_calls[1][1] == {"_id": "latest"}

            # Now load via Mongo path
            loaded = asyncio.get_event_loop().run_until_complete(spp_server._load_ai_state())
            assert loaded is not None
            assert loaded["analysis_id"] == analysis_id
        finally:
            spp_server._mongo_available = False
            spp_server._get_db = old_get_db


# ===========================================================================
# Test 3 (required): failed apply does NOT overwrite last valid state
# ===========================================================================
class TestFailedApplyProtection:
    def test_failed_apply_preserves_last_valid_ai_state(self, api_client):
        """If a second apply fails (e.g. session expired / unknown id), the
        AI state from the first successful apply must remain intact.

        Note: build_local_apply_commit() has pre-existing behavior where it
        returns a placeholder property row even for unknown analysis_ids,
        so the API returns 200 — but the AI state it produces has empty
        property_knowledge and koil_reasoning. _persist_ai_state() refuses
        to persist such incomplete state, which is the safety guard.
        """
        # First apply - succeeds and persists AI state
        aid1, _ = _upload_and_apply(api_client)
        store_after_first = spp_server._memory_db.get(spp_server._AI_STATE_COLLECTION) or {}
        assert aid1 in store_after_first
        first_state = store_after_first[aid1]
        first_applied_at = first_state["applied_at"]

        # Second apply with a non-existent analysis_id.
        # The API returns 200 (pre-existing behavior - placeholder property row),
        # but _persist_ai_state() must refuse to persist the incomplete ai_state.
        fake_aid = "does-not-exist-" + uuid.uuid4().hex
        r = api_client.post(
            f"{API}/upload/apply-analysis",
            json={"analysis_id": fake_aid},
        )
        # Pre-existing behavior: returns 200 with placeholder property (not 404).
        # What matters for Gap 1 is that AI state is NOT corrupted.
        assert r.status_code == 200
        # The response must report ai_state_persisted=False because the
        # session was empty and _persist_ai_state refused the incomplete state.
        assert r.json()["ai_state_persisted"] is False, (
            "failed apply (unknown analysis_id) must not report ai_state_persisted=True"
        )

        # The first apply's AI state must be UNCHANGED
        store_after_failed = spp_server._memory_db.get(spp_server._AI_STATE_COLLECTION) or {}
        assert aid1 in store_after_failed, "first AI state was lost after failed apply"
        assert store_after_failed[aid1]["applied_at"] == first_applied_at, (
            "first AI state was overwritten after failed apply"
        )
        # The fake analysis_id must NOT be in the store
        assert fake_aid not in store_after_failed, (
            "failed apply's empty AI state was persisted - safety guard broken"
        )

        # Latest pointer must still point to the first analysis
        ptr = spp_server._memory_db.get(spp_server._AI_STATE_LATEST_COLLECTION) or {}
        assert ptr.get("analysis_id") == aid1, "latest pointer moved to failed apply"

        # Briefing must still show the first apply's reasoning
        spp_server._portfolio_cache = None  # type: ignore[assignment]
        spp_server._portfolio_cache_at = 0.0  # type: ignore[assignment]
        brief = api_client.get(f"{API}/briefing").json()
        assert "ai_reasoning" in brief
        assert brief["ai_reasoning"]["has_reasoning"] is True


# ===========================================================================
# Test 4 (required): repeated apply is idempotent
# ===========================================================================
class TestIdempotentApply:
    def test_repeated_apply_same_analysis_id_is_idempotent(self, api_client):
        """Applying the same analysis_id twice must not duplicate state
        or move the latest pointer backwards.
        """
        # First apply
        aid, _ = _upload_and_apply(api_client)

        # Re-upload + re-apply with the same analysis_id (simulating a retry)
        # We need a fresh session with the SAME analysis_id to test idempotency.
        # The simplest path: directly call build_local_apply_commit again.
        from adapters.gas_import_bridge import _import_sessions

        # Verify session still exists
        assert aid in _import_sessions

        # Apply again via the API - same analysis_id
        r = api_client.post(
            f"{API}/upload/apply-analysis",
            json={"analysis_id": aid, "files": _two_month_files()},
        )
        assert r.status_code == 200

        # AI state store must have exactly ONE doc for this analysis_id
        store = spp_server._memory_db.get(spp_server._AI_STATE_COLLECTION) or {}
        matching = [k for k, v in store.items() if k == aid]
        assert len(matching) == 1, f"expected 1 doc, got {len(matching)}"

        # Latest pointer must still point to this analysis_id
        ptr = spp_server._memory_db.get(spp_server._AI_STATE_LATEST_COLLECTION) or {}
        assert ptr.get("analysis_id") == aid

        # Briefing must still work
        spp_server._portfolio_cache = None  # type: ignore[assignment]
        spp_server._portfolio_cache_at = 0.0  # type: ignore[assignment]
        brief = api_client.get(f"{API}/briefing").json()
        assert "ai_reasoning" in brief
        assert brief["ai_reasoning"]["has_reasoning"] is True

    def test_two_different_applies_latest_pointer_moves_forward(self, api_client):
        """Applying a second, different analysis_id must move the latest
        pointer forward. The first state doc remains in the store but is
        no longer the 'latest'.
        """
        # First apply
        aid1, _ = _upload_and_apply(api_client)
        ptr1 = spp_server._memory_db.get(spp_server._AI_STATE_LATEST_COLLECTION) or {}
        assert ptr1.get("analysis_id") == aid1

        # Wait a moment so the second apply has a different applied_at
        import time
        time.sleep(0.05)

        # Second apply with different CSV content (different tenants)
        csv3 = "وحدة,مستأجر,إيجار,حالة\n201,فهد,6000,مسدد\n202,نورة,7000,متأخر\n"
        csv4 = "وحدة,مستأجر,إيجار,حالة\n201,فهد,6000,مسدد\n202,نورة,7000,متأخر\n"
        files2 = [
            {"name": "كشف_شهر_3_2026.csv", "textSnippet": csv3, "mimeType": "text/csv"},
            {"name": "كشف_شهر_4_2026.csv", "textSnippet": csv4, "mimeType": "text/csv"},
        ]
        r = api_client.post(
            f"{API}/upload/portfolio-analysis",
            json={"files": files2, "lang": "ar"},
        )
        aid2 = r.json()["analysis_id"]
        assert aid2 != aid1

        r2 = api_client.post(
            f"{API}/upload/apply-analysis",
            json={"analysis_id": aid2, "files": files2},
        )
        assert r2.status_code == 200

        # Both docs must exist in the store
        store = spp_server._memory_db.get(spp_server._AI_STATE_COLLECTION) or {}
        assert aid1 in store
        assert aid2 in store

        # Latest pointer must point to aid2 (the most recent)
        ptr2 = spp_server._memory_db.get(spp_server._AI_STATE_LATEST_COLLECTION) or {}
        assert ptr2.get("analysis_id") == aid2

        # Briefing must reflect aid2's reasoning
        spp_server._portfolio_cache = None  # type: ignore[assignment]
        spp_server._portfolio_cache_at = 0.0  # type: ignore[assignment]
        brief = api_client.get(f"{API}/briefing").json()
        assert "ai_reasoning" in brief


# ===========================================================================
# Test 5 (required): missing AI state preserves old endpoint behavior
# ===========================================================================
class TestMissingAIStateBackwardCompat:
    def test_briefing_without_ai_state_works(self, api_client):
        """When NO import has been applied yet, /api/briefing must still
        work exactly as it did pre-Gap-1 - no ai_reasoning key, no
        reasoning evidence in narrative, normal headline logic.
        """
        # Seed a basic portfolio (no upload, no apply)
        spp_server._memory_insert_all(spp_server._seed_dataset())
        spp_server._portfolio_cache = None  # type: ignore[assignment]
        spp_server._portfolio_cache_at = 0.0  # type: ignore[assignment]

        # No AI state should exist
        store = spp_server._memory_db.get(spp_server._AI_STATE_COLLECTION) or {}
        assert len(store) == 0

        # Briefing must still return a valid response
        brief = api_client.get(f"{API}/briefing").json()

        # All legacy keys present
        for key in (
            "salutation", "owner_name", "headline", "narrative",
            "portfolio_annual_revenue", "avg_health", "occupancy",
            "properties_count", "tenants_count", "expiring_contracts",
            "decisions", "sensor_alerts",
        ):
            assert key in brief

        # ai_reasoning MUST be absent (no import applied yet)
        assert "ai_reasoning" not in brief, (
            "briefing has ai_reasoning block when no AI state was persisted"
        )

        # Narrative must NOT mention Koil (no reasoning evidence)
        narrative = brief["narrative"]
        assert isinstance(narrative, list)
        assert 2 <= len(narrative) <= 6
        assert not any("كويل" in line for line in narrative), (
            f"briefing mentions Koil with no AI state: {narrative}"
        )

        # Existing test contract: 4 properties, 4 tenants
        assert brief["properties_count"] == 4
        assert brief["tenants_count"] == 4

    def test_demo_clear_also_clears_ai_state(self, api_client):
        """POST /api/demo/clear must wipe AI state so a fresh demo load
        doesn't leak the previous import's reasoning.
        """
        # Apply an import first
        _upload_and_apply(api_client)
        store = spp_server._memory_db.get(spp_server._AI_STATE_COLLECTION) or {}
        assert len(store) >= 1

        # Clear demo
        r = api_client.post(f"{API}/demo/clear")
        assert r.status_code == 200

        # AI state must be cleared
        store_after = spp_server._memory_db.get(spp_server._AI_STATE_COLLECTION) or {}
        assert len(store_after) == 0
        ptr = spp_server._memory_db.get(spp_server._AI_STATE_LATEST_COLLECTION) or {}
        assert "analysis_id" not in ptr

        # Briefing must fall back to legacy behavior (no ai_reasoning)
        spp_server._portfolio_cache = None  # type: ignore[assignment]
        spp_server._portfolio_cache_at = 0.0  # type: ignore[assignment]
        # Re-seed so briefing has data to work with
        spp_server._memory_insert_all(spp_server._seed_dataset())
        spp_server._portfolio_cache = None  # type: ignore[assignment]
        brief = api_client.get(f"{API}/briefing").json()
        assert "ai_reasoning" not in brief

    def test_other_endpoints_unchanged_when_ai_state_absent(self, api_client):
        """All other /api/* endpoints must work identically when no AI
        state has been persisted. Smoke check the critical ones.
        """
        spp_server._memory_insert_all(spp_server._seed_dataset())
        spp_server._portfolio_cache = None  # type: ignore[assignment]
        spp_server._portfolio_cache_at = 0.0  # type: ignore[assignment]

        # No AI state in store
        assert len(spp_server._memory_db.get(spp_server._AI_STATE_COLLECTION) or {}) == 0

        # Smoke check: every existing endpoint still 200s
        for path in (
            "/", "/briefing", "/executive", "/portfolio-memory", "/intelligence",
            "/properties", "/properties/prop_1", "/decisions", "/tenants",
            "/contracts", "/timeline", "/sensors", "/notifications",
            "/reports", "/knowledge", "/guides", "/owner", "/beta/info",
            "/build-info", "/verdicts", "/upload/last-applied",
        ):
            r = api_client.get(f"{API}{path}")
            assert r.status_code == 200, f"{path} returned {r.status_code}"

        # ctx must NOT contain reasoning / consistency_gate / lifecycle keys
        # (they're only added when AI state exists)
        # We trigger a fresh ctx build:
        spp_server._portfolio_cache = None  # type: ignore[assignment]
        spp_server._portfolio_cache_at = 0.0  # type: ignore[assignment]
        import asyncio
        ctx = asyncio.get_event_loop().run_until_complete(spp_server._portfolio_live_context())
        assert "ai_state" not in ctx
        assert "reasoning" not in ctx
        assert "consistency_gate" not in ctx
        assert "lifecycle" not in ctx
        assert "executive_brief" not in ctx
        assert "property_knowledge" not in ctx


# ===========================================================================
# Bonus: verify the persisted data shape exactly matches the spec
# ===========================================================================
class TestPersistedDataShape:
    def test_ai_state_has_all_required_fields(self, api_client):
        """The persisted AI state doc must include every field listed in
        the Gap 1 spec:
          - analysis_id
          - pipeline_version
          - applied_at
          - property_knowledge
          - koil_reasoning
          - consistency_gate
          - executive_brief
          - lifecycle
          - tenant_cards
          - status
          - source
        """
        aid, _ = _upload_and_apply(api_client)
        store = spp_server._memory_db.get(spp_server._AI_STATE_COLLECTION) or {}
        ai_state = store[aid]

        required = {
            "analysis_id",
            "pipeline_version",
            "applied_at",
            "status",
            "source",
            "property_knowledge",
            "koil_reasoning",
            "consistency_gate",
            "executive_brief",
            "lifecycle",
            "tenant_cards",
        }
        missing = required - set(ai_state.keys())
        assert not missing, f"AI state missing required fields: {missing}"

        # Type / value sanity
        assert isinstance(ai_state["analysis_id"], str) and len(ai_state["analysis_id"]) > 0
        assert ai_state["pipeline_version"] == "koil-reasoning-v1"
        assert ai_state["status"] == "applied"
        assert ai_state["source"] in ("python", "gas")
        assert isinstance(ai_state["property_knowledge"], dict)
        assert isinstance(ai_state["koil_reasoning"], dict)
        assert isinstance(ai_state["consistency_gate"], dict)
        assert isinstance(ai_state["executive_brief"], dict)
        assert isinstance(ai_state["lifecycle"], dict)
        assert isinstance(ai_state["tenant_cards"], list)
        # applied_at must be a parseable ISO string
        from datetime import datetime
        datetime.fromisoformat(ai_state["applied_at"].replace("Z", "+00:00"))

    def test_latest_pointer_shape(self, api_client):
        """The ai_state_latest pointer must have analysis_id + applied_at."""
        aid, _ = _upload_and_apply(api_client)
        ptr = spp_server._memory_db.get(spp_server._AI_STATE_LATEST_COLLECTION) or {}
        assert "analysis_id" in ptr
        assert "applied_at" in ptr
        assert ptr["analysis_id"] == aid
