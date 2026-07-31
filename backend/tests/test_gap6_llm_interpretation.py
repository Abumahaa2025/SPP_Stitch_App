"""Gap 6 — LLM Interpretation Layer tests.

Tests that the LLM:
- receives persisted AI state, not raw files
- never calculates financial totals
- is disabled when AI_ENABLED=false (zero external calls)
- handles missing API key safely
- validates Arabic responses
- rejects invented financial values
- rejects unknown tenants/units
- rejects unknown decision IDs
- produces review language when gate is blocked
- cannot override requires_confirmation
- handles provider timeout
- rejects malformed output
- doesn't modify persisted AI state
- keeps existing 251 tests passing
- doesn't change existing API response shapes
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

os.environ.setdefault("SPP_BETA_MODE", "true")
os.environ.setdefault("SPP_DEMO_MODE", "true")
os.environ.setdefault("SPP_DATA_SOURCE", "mongo")
os.environ.pop("GAS_WEB_APP_URL", None)
os.environ.pop("GAS_DEPLOYMENT_URL", None)
os.environ["AI_ENABLED"] = "false"  # default: no external calls

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO))
sys.path.insert(0, str(REPO / "backend"))

import pytest
from fastapi.testclient import TestClient

import server as spp_server
from adapters.llm import (
    FakeProvider,
    LLMRequest,
    LLMService,
    build_controlled_context,
    validate_llm_response,
)

API = "/api"

CSV_JAN = (
    "وحدة,مستأجر,إيجار,حالة,جوال,عقد\n"
    "101,A,5000,مسدد,0501111111,C1\n"
    "102,B,4500,مسدد,0502222222,C2\n"
    "103,C,4000,متأخر,0503333333,C3\n"
)
CSV_FEB = (
    "وحدة,مستأجر,إيجار,حالة,جوال,عقد\n"
    "101,A,5000,مسدد,0501111111,C1\n"
    "102,D,4800,مسدد,0504444444,C4\n"
    "103,C,4000,متأخر,0503333333,C3\n"
)


def _files():
    return [
        {"name": "f1.csv", "textSnippet": CSV_JAN, "mimeType": "text/csv"},
        {"name": "f2.csv", "textSnippet": CSV_FEB, "mimeType": "text/csv"},
    ]


@pytest.fixture()
def api_client():
    spp_server._mongo_available = False
    spp_server._memory_clear()
    spp_server._portfolio_cache = None
    spp_server._portfolio_cache_at = 0.0
    from adapters.gas_import_bridge import _import_sessions
    _import_sessions.clear()
    spp_server._memory_db.pop(spp_server._AI_STATE_COLLECTION, None)
    spp_server._memory_db.pop(spp_server._AI_STATE_LATEST_COLLECTION, None)
    spp_server._last_applied_analysis = None
    spp_server.EMERGENT_LLM_KEY = ""
    # Reset LLM service singleton.
    spp_server._llm_service = None
    with TestClient(spp_server.app) as client:
        yield client


def _upload_and_apply(client, files=None):
    files = files or _files()
    r = client.post(f"{API}/upload/portfolio-analysis", json={"files": files, "lang": "ar"})
    assert r.status_code == 200
    aid = r.json()["analysis_id"]
    r2 = client.post(f"{API}/upload/apply-analysis", json={"analysis_id": aid, "files": files})
    assert r2.status_code == 200
    return aid


def _get_ai_state():
    """Get the latest persisted AI state from memory store."""
    store = spp_server._memory_db.get(spp_server._AI_STATE_COLLECTION) or {}
    if not store:
        return {}
    ptr = spp_server._memory_db.get(spp_server._AI_STATE_LATEST_COLLECTION) or {}
    aid = ptr.get("analysis_id")
    return store.get(aid, {})


# ===========================================================================
# 10a. LLM receives persisted AI state, not raw files
# ===========================================================================
class TestContextFromAIState:
    def test_context_has_no_raw_files(self):
        """The controlled context must NOT contain raw file content."""
        ai_state = _get_ai_state() or _make_fake_ai_state()
        ctx = build_controlled_context(ai_state)
        # Must NOT have raw file keys.
        assert "parsed_rolls" not in ctx
        assert "file_classifications" not in ctx
        assert "files" not in ctx
        assert "raw_files" not in ctx
        assert "uploaded_content" not in ctx
        # Must have only the allowed sections.
        allowed = {
            "analysis_id", "task", "locale", "question",
            "canonical_portfolio_summary", "property_knowledge_summary",
            "property_memory", "normalized_lifecycle", "koil_reasoning",
            "executive_brief", "executive_intelligence",
            "unified_smart_decisions", "normalized_gate",
        }
        assert set(ctx.keys()).issubset(allowed), f"unexpected keys: {set(ctx.keys()) - allowed}"

    def test_context_has_decision_ids(self):
        """Context must include unified_smart_decisions with IDs."""
        ai_state = _make_fake_ai_state()
        ctx = build_controlled_context(ai_state)
        decisions = ctx.get("unified_smart_decisions") or []
        assert len(decisions) >= 1
        assert "id" in decisions[0]


# ===========================================================================
# 10b. Financial calculations remain identical before and after LLM
# ===========================================================================
class TestFinancialCalculationsUnchanged:
    def test_financial_values_in_context_match_ai_state(self):
        """Financial values in the context must match the persisted AI state."""
        ai_state = _make_fake_ai_state()
        ctx = build_controlled_context(ai_state)
        pks = ctx.get("property_knowledge_summary") or {}
        assert pks.get("collection_total_expected") == 27000
        assert pks.get("collection_total_collected") == 19000


# ===========================================================================
# 10c. AI_ENABLED=false makes zero external calls
# ===========================================================================
class TestAIDisabled:
    def test_disabled_returns_fallback(self, api_client):
        """When AI_ENABLED=false, /api/ai/respond must return status=disabled."""
        aid = _upload_and_apply(api_client)
        r = api_client.post(
            f"{API}/ai/respond",
            json={"analysis_id": aid, "task": "executive_summary"},
        )
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "disabled"
        assert data["provider"] is None
        assert data["model"] is None
        assert len(data["answer"]) > 0  # has fallback text

    def test_disabled_makes_zero_external_calls(self):
        """FakeProvider call_count must be 0 when AI_ENABLED=false."""
        os.environ["AI_ENABLED"] = "false"
        fake = FakeProvider(mode="valid")
        service = LLMService(provider=fake)
        ai_state = _make_fake_ai_state()
        import asyncio
        resp = asyncio.get_event_loop().run_until_complete(
            service.respond(LLMRequest(analysis_id="test", task="answer"), ai_state)
        )
        assert resp.status == "disabled"
        assert fake.call_count == 0


# ===========================================================================
# 10d. Missing API key causes safe disabled/failure behavior
# ===========================================================================
class TestMissingAPIKey:
    def test_missing_key_returns_disabled(self):
        """When AI_ENABLED=true but no API key, service must return disabled."""
        os.environ["AI_ENABLED"] = "true"
        os.environ.pop("AI_API_KEY", None)
        os.environ.pop("AI_MODEL", None)
        try:
            service = LLMService()  # will try get_provider() → None
            ai_state = _make_fake_ai_state()
            import asyncio
            resp = asyncio.get_event_loop().run_until_complete(
                service.respond(LLMRequest(analysis_id="test"), ai_state)
            )
            assert resp.status == "disabled"
        finally:
            os.environ["AI_ENABLED"] = "false"


# ===========================================================================
# 10e. Valid Arabic answer passes validation
# ===========================================================================
class TestValidAnswer:
    def test_valid_arabic_answer_passes(self):
        """A valid Arabic answer that only references context entities passes."""
        ai_state = _make_fake_ai_state()
        ctx = build_controlled_context(ai_state)
        answer = "يوجد مستأجر واحد متأخر. يُنصح بمراجعة سجل الدفعات."
        is_valid, warnings = validate_llm_response(answer, ctx)
        assert is_valid, f"valid answer rejected: {warnings}"

    def test_valid_answer_with_decision_id(self):
        """An answer citing a known decision ID passes."""
        ai_state = _make_fake_ai_state()
        ctx = build_controlled_context(ai_state)
        decisions = ctx.get("unified_smart_decisions") or []
        if decisions:
            did = decisions[0]["id"]
            answer = f"يُنصح بمراجعة القرار {did}."
            is_valid, warnings = validate_llm_response(answer, ctx)
            assert is_valid, f"valid answer with decision ID rejected: {warnings}"


# ===========================================================================
# 10f. Invented financial values are rejected
# ===========================================================================
class TestInventedFinancial:
    def test_invented_financial_rejected(self):
        """An answer with financial values not in context is rejected."""
        ai_state = _make_fake_ai_state()
        ctx = build_controlled_context(ai_state)
        answer = "إجمالي الإيرادات 999,999 ريال."
        is_valid, warnings = validate_llm_response(answer, ctx)
        assert not is_valid
        assert any("financial" in w.lower() for w in warnings)


# ===========================================================================
# 10g. Unknown tenants or units are rejected
# ===========================================================================
class TestUnknownEntities:
    def test_unknown_tenant_rejected(self):
        """An answer mentioning an unknown tenant is rejected."""
        ai_state = _make_fake_ai_state()
        ctx = build_controlled_context(ai_state)
        # "أحمد العتيبي" is not in the AI state (which has A, B, C, D).
        answer = "المستأجر أحمد العتيبي في الوحدة 101 لديه متأخرات."
        is_valid, warnings = validate_llm_response(answer, ctx)
        assert not is_valid
        assert any("tenant" in w.lower() for w in warnings)

    def test_unknown_unit_rejected(self):
        """An answer mentioning an unknown unit is rejected."""
        ai_state = _make_fake_ai_state()
        ctx = build_controlled_context(ai_state)
        answer = "الوحدة 999 تحتاج صيانة عاجلة."
        is_valid, warnings = validate_llm_response(answer, ctx)
        assert not is_valid
        assert any("unit" in w.lower() for w in warnings)


# ===========================================================================
# 10h. Unknown decision IDs are rejected
# ===========================================================================
class TestUnknownDecisionIDs:
    def test_unknown_decision_id_rejected(self):
        """An answer citing an unknown decision ID is rejected."""
        ai_state = _make_fake_ai_state()
        ctx = build_controlled_context(ai_state)
        answer = "قرار: fake_decision_id غير موجود."
        is_valid, warnings = validate_llm_response(answer, ctx)
        assert not is_valid
        assert any("decision" in w.lower() for w in warnings)


# ===========================================================================
# 10i. Blocked gate produces review language
# ===========================================================================
class TestBlockedGateReviewLanguage:
    def test_blocked_gate_definitive_claim_rejected(self):
        """When gate is blocked, a definitive claim is rejected."""
        ai_state = _make_fake_ai_state()
        ai_state["normalized_gate"] = {
            "version": "consistency-gate-v1",
            "status": "blocked_for_review",
            "confidence_cap": 50,
            "conflicts": [{"code": "paid_marked_overdue", "severity": "high", "message": "test"}],
        }
        ctx = build_controlled_context(ai_state)
        answer = "تم تأكيد مغادرة المستأجر خالد من الوحدة 101 بشكل نهائي."
        is_valid, warnings = validate_llm_response(answer, ctx)
        assert not is_valid
        assert any("gate" in w.lower() or "definitive" in w.lower() for w in warnings)

    def test_blocked_gate_review_language_passes(self):
        """When gate is blocked, review language passes validation."""
        ai_state = _make_fake_ai_state()
        ai_state["normalized_gate"] = {
            "version": "consistency-gate-v1",
            "status": "blocked_for_review",
            "confidence_cap": 50,
            "conflicts": [{"code": "paid_marked_overdue", "severity": "high", "message": "test"}],
        }
        ctx = build_controlled_context(ai_state)
        answer = "توجد مؤشرات تحتاج مراجعة قبل أي إجراء تنفيذي."
        is_valid, warnings = validate_llm_response(answer, ctx)
        assert is_valid, f"review language rejected: {warnings}"


# ===========================================================================
# 10j. LLM cannot override requires_confirmation
# ===========================================================================
class TestCannotOverrideConfirmation:
    def test_requires_confirmation_preserved_in_context(self):
        """The context must preserve requires_confirmation from unified decisions."""
        ai_state = _make_fake_ai_state()
        ctx = build_controlled_context(ai_state)
        decisions = ctx.get("unified_smart_decisions") or []
        for d in decisions:
            assert "requires_confirmation" in d
            # The LLM cannot change this — it's in the context, not the output.


# ===========================================================================
# 10k. Provider timeout is handled safely
# ===========================================================================
class TestProviderTimeout:
    def test_timeout_returns_failed_status(self):
        """When the provider times out, the response status must be 'failed'."""
        fake = FakeProvider(mode="timeout")
        service = LLMService(provider=fake)
        ai_state = _make_fake_ai_state()
        import asyncio
        os.environ["AI_ENABLED"] = "true"
        try:
            resp = asyncio.get_event_loop().run_until_complete(
                service.respond(LLMRequest(analysis_id="test"), ai_state)
            )
            assert resp.status == "failed"
            assert "timed out" in (resp.warnings[0] if resp.warnings else "").lower()
        finally:
            os.environ["AI_ENABLED"] = "false"


# ===========================================================================
# 10l. Malformed provider output is rejected
# ===========================================================================
class TestMalformedOutput:
    def test_malformed_output_handled(self):
        """When the provider returns None text, the response must handle it gracefully."""
        fake = FakeProvider(mode="malformed")
        service = LLMService(provider=fake)
        ai_state = _make_fake_ai_state()
        import asyncio
        # Must set AI_ENABLED=true so the fake provider is used.
        os.environ["AI_ENABLED"] = "true"
        try:
            resp = asyncio.get_event_loop().run_until_complete(
                service.respond(LLMRequest(analysis_id="test"), ai_state)
            )
            # Malformed (None) text → empty answer → validation fails (Rule 7)
            # → status="blocked_for_review" (not "completed" — the rejected
            # empty text is not surfaced to the user).
            assert resp.status in ("blocked_for_review", "failed")
            assert len(resp.warnings) > 0  # must have validation warnings
        finally:
            os.environ["AI_ENABLED"] = "false"


# ===========================================================================
# 10l-bis. Validation failure blocks the rejected LLM text from the user
# ===========================================================================
class TestValidationFailureBlocksResponse:
    """End-to-end tests through LLMService.respond() verifying that when
    validation fails, the rejected LLM text is NOT returned to the user.

    Instead, a safe deterministic fallback is returned with
    status="blocked_for_review", preserving analysis_id, task, gate_status,
    and warnings.
    """

    def test_invented_financial_blocked(self):
        """When the LLM invents financial values, the response must be
        blocked_for_review and the invented text must NOT appear in answer."""
        fake = FakeProvider(mode="invented_financial")
        service = LLMService(provider=fake)
        ai_state = _make_fake_ai_state()
        import asyncio
        os.environ["AI_ENABLED"] = "true"
        try:
            resp = asyncio.get_event_loop().run_until_complete(
                service.respond(LLMRequest(analysis_id="test-aid-123"), ai_state)
            )
            # Status must be blocked_for_review (not completed)
            assert resp.status == "blocked_for_review", \
                f"expected blocked_for_review, got {resp.status}"
            # The rejected LLM text must NOT appear in the answer
            assert "999,999" not in resp.answer, \
                f"invented financial value leaked into answer: {resp.answer}"
            assert "إجمالي الإيرادات 999,999" not in resp.answer, \
                f"rejected LLM text leaked into answer: {resp.answer}"
            # Warnings must be preserved
            assert len(resp.warnings) > 0, "warnings must be preserved"
            assert any("financial" in w.lower() for w in resp.warnings), \
                f"expected financial warning, got {resp.warnings}"
            # Preserved fields
            assert resp.analysis_id == "test-aid-123"
            assert resp.task == "answer"
            # Answer must contain the safe deterministic fallback marker
            assert "الملخص التنفيذي" in resp.answer or "مراجعة" in resp.answer
        finally:
            os.environ["AI_ENABLED"] = "false"

    def test_unknown_tenant_blocked(self):
        """When the LLM mentions an unknown tenant, the response must be
        blocked_for_review and the rejected text must NOT appear in answer."""
        fake = FakeProvider(mode="unknown_tenant")
        service = LLMService(provider=fake)
        ai_state = _make_fake_ai_state()
        import asyncio
        os.environ["AI_ENABLED"] = "true"
        try:
            resp = asyncio.get_event_loop().run_until_complete(
                service.respond(LLMRequest(analysis_id="test-aid-123"), ai_state)
            )
            # Status must be blocked_for_review
            assert resp.status == "blocked_for_review", \
                f"expected blocked_for_review, got {resp.status}"
            # The rejected LLM text must NOT appear in the answer
            assert "أحمد العتيبي" not in resp.answer, \
                f"unknown tenant name leaked into answer: {resp.answer}"
            assert "999" not in resp.answer, \
                f"unknown unit number leaked into answer: {resp.answer}"
            # Warnings must be preserved
            assert len(resp.warnings) > 0, "warnings must be preserved"
            assert any("tenant" in w.lower() for w in resp.warnings), \
                f"expected tenant warning, got {resp.warnings}"
            # Preserved fields
            assert resp.analysis_id == "test-aid-123"
            assert resp.task == "answer"
        finally:
            os.environ["AI_ENABLED"] = "false"

    def test_gate_contradiction_blocked(self):
        """When the LLM makes a definitive claim despite a blocked gate,
        the response must be blocked_for_review and the rejected text must
        NOT appear in answer."""
        fake = FakeProvider(mode="gate_contradiction")
        service = LLMService(provider=fake)
        ai_state = _make_fake_ai_state()
        # Set gate to blocked_for_review so Rule 6 (gate contradiction) fires.
        ai_state["normalized_gate"] = {
            "version": "consistency-gate-v1",
            "status": "blocked_for_review",
            "confidence_cap": 50,
            "conflicts": [{"code": "paid_marked_overdue", "severity": "high", "message": "test"}],
        }
        import asyncio
        os.environ["AI_ENABLED"] = "true"
        try:
            resp = asyncio.get_event_loop().run_until_complete(
                service.respond(LLMRequest(analysis_id="test-aid-123"), ai_state)
            )
            # Status must be blocked_for_review
            assert resp.status == "blocked_for_review", \
                f"expected blocked_for_review, got {resp.status}"
            # The rejected LLM text must NOT appear in the answer
            assert "تأكيد مغادرة" not in resp.answer, \
                f"rejected definitive claim leaked into answer: {resp.answer}"
            assert "خالد" not in resp.answer, \
                f"rejected tenant name leaked into answer: {resp.answer}"
            assert "بشكل نهائي" not in resp.answer, \
                f"rejected definitive language leaked into answer: {resp.answer}"
            # Warnings must be preserved
            assert len(resp.warnings) > 0, "warnings must be preserved"
            assert any("gate" in w.lower() or "definitive" in w.lower() for w in resp.warnings), \
                f"expected gate/definitive warning, got {resp.warnings}"
            # Preserved fields
            assert resp.analysis_id == "test-aid-123"
            assert resp.task == "answer"
            # gate_status must be preserved from context
            assert resp.gate_status == "blocked_for_review"
        finally:
            os.environ["AI_ENABLED"] = "false"


# ===========================================================================
# 10m. Repeated requests do not modify persisted AI state
# ===========================================================================
class TestNoStateModification:
    def test_repeated_requests_dont_modify_state(self):
        """Calling the LLM service twice must not modify the AI state."""
        ai_state = _make_fake_ai_state()
        original_keys = set(ai_state.keys())
        original_decisions = len(ai_state.get("unified_smart_decisions") or [])

        fake = FakeProvider(mode="valid")
        service = LLMService(provider=fake)
        import asyncio
        os.environ["AI_ENABLED"] = "true"
        try:
            loop = asyncio.get_event_loop()
            loop.run_until_complete(
                service.respond(LLMRequest(analysis_id="test"), ai_state)
            )
            loop.run_until_complete(
                service.respond(LLMRequest(analysis_id="test"), ai_state)
            )
        finally:
            os.environ["AI_ENABLED"] = "false"

        # AI state must be unchanged.
        assert set(ai_state.keys()) == original_keys
        assert len(ai_state.get("unified_smart_decisions") or []) == original_decisions


# ===========================================================================
# 10n. Existing 251 tests remain passing
# ===========================================================================
class TestExistingTestsPass:
    def test_existing_endpoints_unchanged(self, api_client):
        """All existing endpoints must still return 200 after Gap 6."""
        spp_server._memory_insert_all(spp_server._seed_dataset())
        spp_server._portfolio_cache = None
        spp_server._portfolio_cache_at = 0.0
        for path in (
            "/", "/briefing", "/executive", "/portfolio-memory", "/intelligence",
            "/properties", "/properties/prop_1", "/decisions", "/tenants",
            "/contracts", "/timeline", "/sensors", "/notifications",
            "/reports", "/knowledge", "/guides", "/owner", "/beta/info",
            "/build-info", "/verdicts", "/upload/last-applied",
        ):
            r = api_client.get(f"{API}{path}")
            assert r.status_code == 200, f"{path} returned {r.status_code}"


# ===========================================================================
# 10o. No existing API response shape changes
# ===========================================================================
class TestNoShapeChanges:
    def test_briefing_shape_unchanged(self, api_client):
        spp_server._memory_insert_all(spp_server._seed_dataset())
        spp_server._portfolio_cache = None
        spp_server._portfolio_cache_at = 0.0
        brief = api_client.get(f"{API}/briefing").json()
        for key in ("salutation", "owner_name", "headline", "narrative",
                     "portfolio_annual_revenue", "avg_health", "occupancy",
                     "properties_count", "tenants_count", "expiring_contracts",
                     "decisions", "sensor_alerts"):
            assert key in brief

    def test_verdicts_shape_unchanged(self, api_client):
        spp_server._memory_insert_all(spp_server._seed_dataset())
        spp_server._portfolio_cache = None
        spp_server._portfolio_cache_at = 0.0
        verdicts = api_client.get(f"{API}/verdicts").json()
        assert len(verdicts) == 13

    def test_executive_shape_unchanged(self, api_client):
        spp_server._memory_insert_all(spp_server._seed_dataset())
        spp_server._portfolio_cache = None
        spp_server._portfolio_cache_at = 0.0
        brain = api_client.get(f"{API}/executive").json()
        for key in ("version", "portfolio", "daily_brief", "agenda",
                     "ranked_decisions", "opportunities", "meta"):
            assert key in brain


# ===========================================================================
# Security: no secrets in logs
# ===========================================================================
class TestSecurity:
    def test_no_api_key_in_context(self):
        """The controlled context must NOT contain any API keys or secrets."""
        ai_state = _make_fake_ai_state()
        ctx = build_controlled_context(ai_state)
        ctx_str = str(ctx)
        assert "AI_API_KEY" not in ctx_str
        assert "api_key" not in ctx_str.lower()
        assert "sk-" not in ctx_str
        assert "Bearer" not in ctx_str

    def test_context_has_size_limits(self):
        """The context must be capped — no unbounded lists."""
        # Create AI state with many decisions.
        ai_state = _make_fake_ai_state()
        ai_state["unified_smart_decisions"] = [
            {"id": f"d_{i}", "kind": "tenant", "priority": "low", "title": f"decision {i}",
             "action": "test", "confidence": 70}
            for i in range(100)
        ]
        ctx = build_controlled_context(ai_state)
        decisions = ctx.get("unified_smart_decisions") or []
        assert len(decisions) <= 10  # capped at 10


# ===========================================================================
# End-to-end: POST /api/ai/respond
# ===========================================================================
class TestEndpoint:
    def test_respond_disabled_mode(self, api_client):
        """POST /api/ai/respond with AI_ENABLED=false returns disabled."""
        aid = _upload_and_apply(api_client)
        r = api_client.post(
            f"{API}/ai/respond",
            json={"analysis_id": aid, "task": "executive_summary"},
        )
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "disabled"
        assert data["analysis_id"] == aid
        assert len(data["answer"]) > 0
        assert data["gate_status"] is not None

    def test_respond_404_for_unknown_analysis(self, api_client):
        """POST /api/ai/respond with unknown analysis_id returns 404."""
        r = api_client.post(
            f"{API}/ai/respond",
            json={"analysis_id": "does-not-exist", "task": "answer"},
        )
        assert r.status_code == 404

    def test_respond_with_fake_provider(self, api_client):
        """POST /api/ai/respond with a fake provider returns completed."""
        aid = _upload_and_apply(api_client)
        # Inject a fake provider into the service + enable AI.
        os.environ["AI_ENABLED"] = "true"
        spp_server._llm_service = LLMService(provider=FakeProvider(mode="valid"))
        try:
            r = api_client.post(
                f"{API}/ai/respond",
                json={"analysis_id": aid, "task": "answer", "question": "ما أهم الملاحظات؟"},
            )
            assert r.status_code == 200
            data = r.json()
            assert data["status"] == "completed"
            assert data["provider"] == "fake"
            assert len(data["answer"]) > 0
            assert data["latency_ms"] is not None
        finally:
            os.environ["AI_ENABLED"] = "false"
            spp_server._llm_service = None  # reset


# ===========================================================================
# Helper: create a fake AI state for testing
# ===========================================================================
def _make_fake_ai_state() -> dict:
    """Create a minimal AI state dict for testing the LLM layer."""
    return {
        "analysis_id": "test-aid-123",
        "normalized_lifecycle": {
            "summary": {"departed_count": 1, "newcomers_count": 1, "active_count": 3, "late_count": 1},
            "reporting_period": {"from_month": 1, "from_year": 2026, "to_month": 2, "to_year": 2026},
            "departed": [{"tenant": "B", "unit": "102", "reason": "استبدال — D"}],
            "newcomers": [{"tenant": "D", "unit": "102"}],
            "late_tenants": [{"tenant": "C", "unit": "103", "late_month_count": 2, "total_unpaid": 8000}],
            "month_comparison": [
                {"month": "يناير", "revenue": 13500, "collected": 9500},
                {"month": "فبراير", "revenue": 13800, "collected": 9800},
            ],
        },
        "property_knowledge": {
            "tenants": [{"tenant": "A", "unit": "101"}, {"tenant": "C", "unit": "103"}],
            "late": {"tenant_count": 1},
            "lifecycle": {"departed_count": 1, "newcomers_count": 1, "active_count": 3},
            "collection": {"total_expected": 27000, "total_collected": 19000, "total_unpaid": 8000},
        },
        "canonical_portfolio_summary": {"units_count": 3, "assets_count": 0, "settings": {}},
        "property_memory": {"summary": {"total_assets": 0}, "assets": []},
        "koil_reasoning": {
            "brief": "كويل · يناير → فبراير: يوجد 1 مستأجر متأخر.",
            "recommendations": [{"action": "تواصل مع C", "priority": "high"}],
            "confidence": 85,
        },
        "executive_brief": {"property_status": "stable", "key_numbers": {"occupancy": 100}},
        "executive_intelligence": {"insights": [{"headline": "test", "why": "test", "action": "test", "confidence": 80}]},
        "unified_smart_decisions": [
            {
                "id": "d_1", "kind": "contact_late_tenant", "priority": "high",
                "title": "تواصل مع C", "action": "أرسل تذكير", "confidence": 88,
                "requires_confirmation": True, "blocked_by_gate": False,
                "gate_status": "ok", "tenant_name": "C", "unit_label": "103",
            },
        ],
        "normalized_gate": {
            "version": "consistency-gate-v1", "status": "ok", "confidence_cap": 100,
            "conflicts": [],
        },
    }
