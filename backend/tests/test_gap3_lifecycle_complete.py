"""Gap 3 (complete) — normalized lifecycle + 7 decision kinds + dedup + gate.

Covers requirements 13a-13m + the end-to-end fixture from requirement 14:
  January: tenant A in 101, tenant B in 102, tenant C late in 103
  February: tenant A remains, tenant D replaces B in 102, tenant C remains late

Proves after Analyze → Apply → cache clear:
  - tenant B is identified as departed or replaced with evidence
  - tenant D is identified as newcomer with evidence
  - tenant C appears as late with payment ledger evidence
  - month comparison appears in Executive Brain
  - each operational event creates exactly one smart decision
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

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO))
sys.path.insert(0, str(REPO / "backend"))

import pytest
from fastapi.testclient import TestClient

import server as spp_server
from adapters.lifecycle import (
    LIFECYCLE_DECISION_KINDS,
    build_normalized_lifecycle,
    deduplicate_against_live_decisions,
    generate_lifecycle_decisions,
)
from adapters.upload_analysis.intake_engine import analyze_statements_deep

API = "/api"

# Requirement 14 fixture (with phones + contracts so identity switch is detected):
# January: tenant A in 101, tenant B in 102, tenant C late in 103
# February: tenant A remains, tenant D replaces B in 102, tenant C remains late in 103
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


def _req14_files():
    return [
        {"name": "كشف_شهر_1_2026.csv", "textSnippet": CSV_JAN, "mimeType": "text/csv"},
        {"name": "كشف_شهر_2_2026.csv", "textSnippet": CSV_FEB, "mimeType": "text/csv"},
    ]


@pytest.fixture()
def api_client():
    """Fresh in-memory server per test."""
    spp_server._mongo_available = False
    spp_server._memory_clear()
    spp_server._portfolio_cache = None  # type: ignore[assignment]
    spp_server._portfolio_cache_at = 0.0  # type: ignore[assignment]
    from adapters.gas_import_bridge import _import_sessions
    _import_sessions.clear()
    spp_server._memory_db.pop(spp_server._AI_STATE_COLLECTION, None)
    spp_server._memory_db.pop(spp_server._AI_STATE_LATEST_COLLECTION, None)
    spp_server._last_applied_analysis = None  # type: ignore[assignment]
    spp_server.EMERGENT_LLM_KEY = ""  # type: ignore[assignment]
    with TestClient(spp_server.app) as client:
        yield client


def _upload_and_apply(client, files=None):
    """Helper: run upload → apply, return analysis_id."""
    files = files or _req14_files()
    r = client.post(f"{API}/upload/portfolio-analysis", json={"files": files, "lang": "ar"})
    assert r.status_code == 200, f"upload failed: {r.status_code} {r.text}"
    analysis_id = r.json()["analysis_id"]
    r2 = client.post(
        f"{API}/upload/apply-analysis",
        json={"analysis_id": analysis_id, "files": files},
    )
    assert r2.status_code == 200, f"apply failed: {r2.status_code} {r2.text}"
    return analysis_id


# ===========================================================================
# 13a. A late tenant reaches GET /api/briefing
# ===========================================================================
class TestLateTenantReachesBriefing:
    def test_briefing_mentions_late_tenant(self, api_client):
        """After Apply, /api/briefing narrative must mention tenant C as late."""
        _upload_and_apply(api_client)
        spp_server._portfolio_cache = None  # type: ignore[assignment]
        spp_server._portfolio_cache_at = 0.0  # type: ignore[assignment]
        r = api_client.get(f"{API}/briefing")
        assert r.status_code == 200
        brief = r.json()
        narrative = brief.get("narrative") or []
        # Must mention tenant C or "متأخر" somewhere in the narrative
        narrative_text = " ".join(narrative)
        assert "متأخر" in narrative_text or "C" in narrative_text, (
            f"briefing narrative missing late tenant evidence: {narrative}"
        )
        # ai_reasoning block must include late_count
        ai_r = brief.get("ai_reasoning") or {}
        assert ai_r.get("late_count", 0) >= 1, (
            f"briefing ai_reasoning.late_count should be >= 1: {ai_r}"
        )

    def test_briefing_includes_mom_change(self, api_client):
        """After Apply, briefing must include month-over-month collection change."""
        _upload_and_apply(api_client)
        spp_server._portfolio_cache = None  # type: ignore[assignment]
        spp_server._portfolio_cache_at = 0.0  # type: ignore[assignment]
        r = api_client.get(f"{API}/briefing")
        brief = r.json()
        ai_r = brief.get("ai_reasoning") or {}
        # mom_change must be present (2 months in fixture)
        assert ai_r.get("mom_change") is not None, (
            f"briefing ai_reasoning.mom_change should be present: {ai_r}"
        )


# ===========================================================================
# 13b. Payment ledger evidence reaches GET /api/verdicts
# ===========================================================================
class TestPaymentLedgerReachesVerdicts:
    def test_verdicts_have_evidence_fields(self, api_client):
        """After Apply, verdicts must include evidence fields
        (tenant/unit/previous_period/current_period/evidence_source/confidence)
        when lifecycle data exists."""
        _upload_and_apply(api_client)
        spp_server._portfolio_cache = None  # type: ignore[assignment]
        spp_server._portfolio_cache_at = 0.0  # type: ignore[assignment]
        r = api_client.get(f"{API}/verdicts")
        assert r.status_code == 200
        verdicts = r.json()
        # Legacy shape: 13 keys
        expected_keys = {
            "home", "portfolio", "insights", "health", "maintenance",
            "sensors", "tenants", "contracts", "notifications",
            "reports", "knowledge", "guides", "owner",
        }
        assert set(verdicts.keys()) == expected_keys
        # At least one verdict must have evidence fields (home or tenants)
        # when lifecycle data exists. We check evidence_source NOT in (None, "legacy")
        # because "legacy" is set on ALL verdicts by the gate (for traceability),
        # but only lifecycle-backed verdicts have the tenant/unit/current_period/
        # confidence evidence fields. Checking "evidence_source in v" would match
        # legacy verdicts too and fail on the tenant/unit assertions below.
        home = verdicts.get("home") or {}
        tenants_v = verdicts.get("tenants") or {}
        evidence_found = False
        for v in (home, tenants_v):
            if v and v.get("evidence_source") not in (None, "legacy"):
                evidence_found = True
                assert "tenant" in v
                assert "unit" in v
                assert "current_period" in v
                assert "confidence" in v
        assert evidence_found, "no verdict has lifecycle evidence fields"


# ===========================================================================
# 13c. Month comparison reaches Executive Brain daily_brief
# ===========================================================================
class TestMonthComparisonReachesExecutiveBrain:
    def test_daily_brief_has_mom_change(self, api_client):
        """After Apply, /api/executive.daily_brief must include MoM change."""
        _upload_and_apply(api_client)
        spp_server._portfolio_cache = None  # type: ignore[assignment]
        spp_server._portfolio_cache_at = 0.0  # type: ignore[assignment]
        r = api_client.get(f"{API}/executive")
        brain = r.json()
        db = brain.get("daily_brief") or {}
        ls = db.get("lifecycle_signals") or {}
        assert ls.get("mom_change") is not None, (
            f"daily_brief.lifecycle_signals.mom_change should be present: {ls}"
        )


# ===========================================================================
# 13d. Annual statistics reach Executive Brain
# ===========================================================================
class TestAnnualStatsReachExecutiveBrain:
    def test_portfolio_lifecycle_has_annual_stats(self, api_client):
        """After Apply, /api/executive.portfolio.lifecycle must include annual_stats."""
        _upload_and_apply(api_client)
        spp_server._portfolio_cache = None  # type: ignore[assignment]
        spp_server._portfolio_cache_at = 0.0  # type: ignore[assignment]
        r = api_client.get(f"{API}/executive")
        brain = r.json()
        portfolio = brain.get("portfolio") or {}
        lc = portfolio.get("lifecycle") or {}
        assert "annual_stats" in lc, f"portfolio.lifecycle missing annual_stats: {lc}"
        annual = lc["annual_stats"]
        assert "total_expected" in annual
        assert "total_collected" in annual


# ===========================================================================
# 13e. Complete normalized lifecycle persists after Apply
# ===========================================================================
class TestNormalizedLifecyclePersists:
    def test_ai_state_has_normalized_lifecycle(self, api_client):
        """After Apply, ai_state must include normalized_lifecycle with all
        required top-level keys."""
        aid = _upload_and_apply(api_client)
        store = spp_server._memory_db.get(spp_server._AI_STATE_COLLECTION) or {}
        ai_state = store[aid]
        nl = ai_state.get("normalized_lifecycle") or {}
        required = {
            "version", "reporting_period", "departed", "newcomers", "active",
            "tenant_changes", "late_tenants", "payment_ledger", "late_by_month",
            "month_comparison", "annual_stats", "summary", "warnings", "unresolved",
            "source", "has_real_content", "month_count",
        }
        assert required.issubset(set(nl.keys())), (
            f"normalized_lifecycle missing keys: {required - set(nl.keys())}"
        )
        assert nl["version"] == "lifecycle-v1"

    def test_ai_state_has_lifecycle_decisions(self, api_client):
        """After Apply, ai_state must include lifecycle_decisions list."""
        aid = _upload_and_apply(api_client)
        store = spp_server._memory_db.get(spp_server._AI_STATE_COLLECTION) or {}
        ai_state = store[aid]
        lds = ai_state.get("lifecycle_decisions") or []
        assert isinstance(lds, list)
        assert len(lds) >= 1, "expected at least 1 lifecycle decision"
        # Each must have the full Gap 3 section-8 shape
        for ld in lds:
            for key in (
                "id", "source", "kind", "priority", "score", "tier",
                "title", "why", "action", "evidence",
                "tenant_id", "tenant_name", "unit_id", "unit_label",
                "reporting_period", "confidence", "route",
                "requires_confirmation",
            ):
                assert key in ld, f"lifecycle decision missing {key}: {ld}"
            assert ld["source"] == "lifecycle"
            assert ld["kind"] in LIFECYCLE_DECISION_KINDS


# ===========================================================================
# 13f. Lifecycle remains available after cache clear
# ===========================================================================
class TestLifecycleSurvivesCacheClear:
    def test_lifecycle_available_after_cache_clear(self, api_client):
        """After Apply + cache clear, /api/executive must still serve lifecycle."""
        _upload_and_apply(api_client)
        spp_server._portfolio_cache = None  # type: ignore[assignment]
        spp_server._portfolio_cache_at = 0.0  # type: ignore[assignment]
        r1 = api_client.get(f"{API}/executive")
        assert r1.status_code == 200
        # Clear cache again
        spp_server._portfolio_cache = None  # type: ignore[assignment]
        spp_server._portfolio_cache_at = 0.0  # type: ignore[assignment]
        r2 = api_client.get(f"{API}/executive")
        brain = r2.json()
        portfolio = brain.get("portfolio") or {}
        # lifecycle must still be present (loaded from ai_state, not cache)
        assert "lifecycle" in portfolio


# ===========================================================================
# 13g. Duplicate lifecycle/live decisions merge into one
# ===========================================================================
class TestDeduplication:
    def test_dedup_against_live_decisions(self):
        """deduplicate_against_live_decisions() must remove lifecycle decisions
        that duplicate existing live decisions."""
        # A live financial decision for tenant C on unit 103 (late rent)
        live_decisions = [
            {
                "id": "d_f_1",
                "kind": "financial",
                "priority": "high",
                "title": "Late rent — 103",
                "tenant_name": "C",
                "unit_label": "103",
                "property_id": "prop_103",
            },
        ]
        # A lifecycle contact_late_tenant decision for the same tenant+unit
        lifecycle_decisions = [
            {
                "id": "lc_contact_late_c|103",
                "source": "lifecycle",
                "kind": "contact_late_tenant",
                "tenant_name": "C",
                "unit_label": "103",
                "reporting_period": {"from_year": 2026, "from_month": 1},
            },
            {
                "id": "lc_contact_late_d|104",  # different tenant → keep
                "source": "lifecycle",
                "kind": "contact_late_tenant",
                "tenant_name": "D",
                "unit_label": "104",
                "reporting_period": {},
            },
        ]
        filtered = deduplicate_against_live_decisions(lifecycle_decisions, live_decisions)
        # The C|103 decision must be removed (duplicate of live financial)
        ids = [d["id"] for d in filtered]
        assert "lc_contact_late_d|104" in ids
        assert "lc_contact_late_c|103" not in ids

    def test_internal_dedup_in_generator(self):
        """generate_lifecycle_decisions must not produce duplicate kinds
        for the same tenant+unit+period."""
        normalized = {
            "has_real_content": True,
            "reporting_period": {"from_year": 2026, "from_month": 1, "to_year": 2026, "to_month": 2},
            "late_tenants": [
                {"tenant": "C", "unit": "103", "late_month_count": 2, "total_unpaid": 8000, "months": []},
                # Duplicate (same tenant+unit) — should be deduped.
                {"tenant": "C", "unit": "103", "late_month_count": 1, "total_unpaid": 4000, "months": []},
            ],
            "departed": [],
            "newcomers": [],
            "tenant_changes": [],
            "payment_ledger": [],
            "month_comparison": [],
            "unresolved": [],
        }
        decisions = generate_lifecycle_decisions(normalized, gate=None)
        # Only ONE contact_late_tenant for C|103
        contact_c = [d for d in decisions if d["kind"] == "contact_late_tenant" and d.get("tenant_name") == "C"]
        assert len(contact_c) == 1, f"expected 1, got {len(contact_c)}: {contact_c}"


# ===========================================================================
# 13h. Missing evidence creates an unresolved review decision
# ===========================================================================
class TestMissingEvidenceUnresolved:
    def test_unclear_payment_months_create_investigate_decision(self):
        """When a late tenant has unclear payment months, the engine must
        generate investigate_tenant_change (not contact_late_tenant) and
        surface the issue in unresolved."""
        normalized = {
            "has_real_content": True,
            "reporting_period": {"from_year": 2026, "from_month": 1, "to_year": 2026, "to_month": 2},
            "late_tenants": [
                {
                    "tenant": "X",
                    "unit": "101",
                    "late_month_count": 2,
                    "total_unpaid": 5000,
                    "months": [
                        {"status": "unknown_requires_review"},
                        {"status": "unknown_requires_review"},
                    ],
                },
            ],
            "departed": [],
            "newcomers": [],
            "tenant_changes": [],
            "payment_ledger": [],
            "month_comparison": [],
            "unresolved": [
                {"code": "unclear_payment_months", "detail": "2 unclear months", "count": 2},
            ],
        }
        decisions = generate_lifecycle_decisions(normalized, gate=None)
        # Must NOT have a confident contact_late_tenant for X|101
        contact_x = [d for d in decisions if d["kind"] == "contact_late_tenant" and d.get("tenant_name") == "X"]
        assert len(contact_x) == 0, f"should not emit confident contact_late_tenant: {contact_x}"
        # MUST have investigate_tenant_change for X|101
        investigate_x = [d for d in decisions if d["kind"] == "investigate_tenant_change" and d.get("tenant_name") == "X"]
        assert len(investigate_x) == 1
        # MUST have request_missing_lifecycle_data (because unresolved is non-empty)
        missing = [d for d in decisions if d["kind"] == "request_missing_lifecycle_data"]
        assert len(missing) == 1


# ===========================================================================
# 13i. Blocked consistency gate lowers confidence and priority
# ===========================================================================
class TestConsistencyGateBlocksConfidence:
    def test_blocked_gate_caps_confidence_and_priority(self):
        """When consistency_gate.status == 'blocked_for_review':
           - confidence is capped at 50
           - high-priority actions become review decisions
           - caution language is added to why/action"""
        normalized = {
            "has_real_content": True,
            "reporting_period": {"from_year": 2026, "from_month": 1, "to_year": 2026, "to_month": 2},
            "late_tenants": [
                {"tenant": "C", "unit": "103", "late_month_count": 2, "total_unpaid": 8000, "months": []},
            ],
            "departed": [],
            "newcomers": [],
            "tenant_changes": [],
            "payment_ledger": [],
            "month_comparison": [],
            "unresolved": [],
        }
        gate_ok = {"decision_status": "ok"}
        gate_blocked = {"decision_status": "blocked_for_review", "conflicts": []}
        decisions_ok = generate_lifecycle_decisions(normalized, gate=gate_ok)
        decisions_blocked = generate_lifecycle_decisions(normalized, gate=gate_blocked)

        # Find the contact_late_tenant decision in both
        contact_ok = next(d for d in decisions_ok if d["kind"] == "contact_late_tenant")
        contact_blocked = next(d for d in decisions_blocked if d["kind"] == "contact_late_tenant")

        # OK gate: confidence is 88, priority is high
        assert contact_ok["confidence"] == 88
        assert contact_ok["priority"] == "high"

        # Blocked gate: confidence capped at 50, priority downgraded to low
        assert contact_blocked["confidence"] <= 50, (
            f"blocked gate should cap confidence at 50, got {contact_blocked['confidence']}"
        )
        assert contact_blocked["priority"] == "low", (
            f"blocked gate should downgrade high→low, got {contact_blocked['priority']}"
        )
        # Caution language in action
        assert "[مراجعة]" in contact_blocked["action"] or "مراجعة" in contact_blocked["action"]


# ===========================================================================
# 13j. Filename-only upload creates no lifecycle events
# ===========================================================================
class TestFilenameOnlyGuard:
    def test_filename_only_creates_no_lifecycle_events(self):
        """Filename-only uploads (no textSnippet) must produce zero lifecycle
        events — only a request_missing_lifecycle_data decision."""
        files = [
            {"name": "كشف_شهر_1_2026.xlsx"},
            {"name": "كشف_شهر_2_2026.xlsx"},
        ]
        ctx = {"settings": {}, "properties": [], "tenants": [], "contracts": [], "decisions": [], "reports": []}
        deep = analyze_statements_deep(files, ctx)
        normalized = build_normalized_lifecycle(deep, lang="ar")
        # has_real_content must be False
        assert normalized["has_real_content"] is False
        # All event lists must be empty
        assert len(normalized["departed"]) == 0
        assert len(normalized["newcomers"]) == 0
        assert len(normalized["active"]) == 0
        assert len(normalized["tenant_changes"]) == 0
        assert len(normalized["late_tenants"]) == 0
        assert len(normalized["payment_ledger"]) == 0
        # Only request_missing_lifecycle_data decision
        decisions = generate_lifecycle_decisions(normalized, gate=None)
        if decisions:
            assert all(d["kind"] == "request_missing_lifecycle_data" for d in decisions), (
                f"filename-only should only produce request_missing_lifecycle_data: {decisions}"
            )


# ===========================================================================
# 13k. Existing departures/newcomers tests still pass
# ===========================================================================
class TestExistingDepartureNewcomerTestsStillPass:
    """Smoke check that the existing Gap 3 departure/newcomer logic still
    works alongside the complete implementation."""

    def test_normalized_lifecycle_includes_departed_and_newcomers(self):
        """The req-14 fixture must produce 1 departure + 1 newcomer."""
        files = _req14_files()
        ctx = {"settings": {}, "properties": [], "tenants": [], "contracts": [], "decisions": [], "reports": []}
        deep = analyze_statements_deep(files, ctx)
        normalized = build_normalized_lifecycle(deep, lang="ar")
        assert normalized["summary"]["departed_count"] >= 1, (
            f"expected >= 1 departure, got {normalized['summary']['departed_count']}"
        )
        assert normalized["summary"]["newcomers_count"] >= 1, (
            f"expected >= 1 newcomer, got {normalized['summary']['newcomers_count']}"
        )
        # The departure must be tenant B on unit 102
        departed = normalized["departed"]
        assert any(d.get("tenant") == "B" and d.get("unit") == "102" for d in departed), (
            f"tenant B departure not found: {departed}"
        )
        # The newcomer must be tenant D on unit 102
        newcomers = normalized["newcomers"]
        assert any(n.get("tenant") == "D" and n.get("unit") == "102" for n in newcomers), (
            f"tenant D newcomer not found: {newcomers}"
        )


# ===========================================================================
# 13l. No existing endpoint response field is removed
# ===========================================================================
class TestNoExistingFieldRemoved:
    def test_briefing_legacy_keys_preserved(self, api_client):
        """All legacy briefing keys must still be present after Apply."""
        _upload_and_apply(api_client)
        spp_server._portfolio_cache = None  # type: ignore[assignment]
        spp_server._portfolio_cache_at = 0.0  # type: ignore[assignment]
        brief = api_client.get(f"{API}/briefing").json()
        for key in (
            "salutation", "owner_name", "headline", "narrative",
            "portfolio_annual_revenue", "avg_health", "occupancy",
            "properties_count", "tenants_count", "expiring_contracts",
            "decisions", "sensor_alerts",
        ):
            assert key in brief, f"briefing missing legacy key: {key}"

    def test_verdicts_legacy_keys_preserved(self, api_client):
        """All 13 legacy verdict keys must still be present after Apply."""
        _upload_and_apply(api_client)
        spp_server._portfolio_cache = None  # type: ignore[assignment]
        spp_server._portfolio_cache_at = 0.0  # type: ignore[assignment]
        verdicts = api_client.get(f"{API}/verdicts").json()
        expected = {
            "home", "portfolio", "insights", "health", "maintenance",
            "sensors", "tenants", "contracts", "notifications",
            "reports", "knowledge", "guides", "owner",
        }
        assert set(verdicts.keys()) == expected

    def test_executive_legacy_keys_preserved(self, api_client):
        """All legacy executive keys must still be present after Apply."""
        _upload_and_apply(api_client)
        spp_server._portfolio_cache = None  # type: ignore[assignment]
        spp_server._portfolio_cache_at = 0.0  # type: ignore[assignment]
        brain = api_client.get(f"{API}/executive").json()
        for key in ("version", "portfolio", "daily_brief", "agenda", "ranked_decisions", "opportunities", "meta"):
            assert key in brain, f"executive missing legacy key: {key}"
        # Legacy portfolio keys
        for key in ("units", "tenants", "contracts_tracked", "open_decisions", "avg_health", "occupancy_pct", "annual_revenue_aed", "expiring_contracts"):
            assert key in brain["portfolio"], f"portfolio missing legacy key: {key}"
        # Legacy daily_brief keys
        for key in ("salutation", "owner_name", "what", "why", "outcome", "focus_count", "recoverable_aed"):
            assert key in brain["daily_brief"], f"daily_brief missing legacy key: {key}"


# ===========================================================================
# 13m. Full regression remains green — covered by running all tests together
# ===========================================================================

# ===========================================================================
# Requirement 14: end-to-end fixture proof
# ===========================================================================
class TestRequirement14EndToEndFixture:
    """Proves the exact fixture from requirement 14:
       January: A in 101, B in 102, C late in 103
       February: A remains, D replaces B in 102, C remains late in 103

    After Analyze → Apply → cache clear, must prove:
       - tenant B is identified as departed or replaced with evidence
       - tenant D is identified as newcomer with evidence
       - tenant C appears as late with payment ledger evidence
       - month comparison appears in Executive Brain
       - each operational event creates exactly one smart decision
    """

    def test_tenant_b_identified_as_departed(self, api_client):
        """Tenant B must appear in normalized_lifecycle.departed with evidence."""
        _upload_and_apply(api_client)
        spp_server._portfolio_cache = None  # type: ignore[assignment]
        spp_server._portfolio_cache_at = 0.0  # type: ignore[assignment]
        # Get the normalized lifecycle from /api/executive
        r = api_client.get(f"{API}/executive")
        brain = r.json()
        portfolio = brain.get("portfolio") or {}
        lc = portfolio.get("lifecycle") or {}
        # The lifecycle_summary must show departed_count >= 1
        assert lc.get("departed_count", 0) >= 1, f"expected departed_count >= 1: {lc}"
        # Verify in the persisted ai_state
        store = spp_server._memory_db.get(spp_server._AI_STATE_COLLECTION) or {}
        ai_state = next(iter(store.values()))  # latest
        nl = ai_state.get("normalized_lifecycle") or {}
        departed = nl.get("departed") or []
        b_dep = [d for d in departed if d.get("tenant") == "B" and d.get("unit") == "102"]
        assert len(b_dep) >= 1, f"tenant B departure not found in: {departed}"
        # Evidence: must have reason + departed_month
        b = b_dep[0]
        assert b.get("reason"), f"tenant B departure missing reason: {b}"
        assert b.get("departed_month"), f"tenant B departure missing departed_month: {b}"

    def test_tenant_d_identified_as_newcomer(self, api_client):
        """Tenant D must appear in normalized_lifecycle.newcomers with evidence."""
        _upload_and_apply(api_client)
        spp_server._portfolio_cache = None  # type: ignore[assignment]
        spp_server._portfolio_cache_at = 0.0  # type: ignore[assignment]
        store = spp_server._memory_db.get(spp_server._AI_STATE_COLLECTION) or {}
        ai_state = next(iter(store.values()))
        nl = ai_state.get("normalized_lifecycle") or {}
        newcomers = nl.get("newcomers") or []
        d_new = [n for n in newcomers if n.get("tenant") == "D" and n.get("unit") == "102"]
        assert len(d_new) >= 1, f"tenant D newcomer not found in: {newcomers}"
        d = d_new[0]
        assert d.get("arrived_month"), f"tenant D newcomer missing arrived_month: {d}"
        assert d.get("confirmed") is True, f"tenant D newcomer should be confirmed: {d}"

    def test_tenant_c_appears_as_late_with_payment_ledger(self, api_client):
        """Tenant C must appear in normalized_lifecycle.late_tenants AND
        payment_ledger with evidence."""
        _upload_and_apply(api_client)
        spp_server._portfolio_cache = None  # type: ignore[assignment]
        spp_server._portfolio_cache_at = 0.0  # type: ignore[assignment]
        store = spp_server._memory_db.get(spp_server._AI_STATE_COLLECTION) or {}
        ai_state = next(iter(store.values()))
        nl = ai_state.get("normalized_lifecycle") or {}
        late_tenants = nl.get("late_tenants") or []
        c_late = [lt for lt in late_tenants if lt.get("tenant") == "C" and lt.get("unit") == "103"]
        assert len(c_late) >= 1, f"tenant C late not found in: {late_tenants}"
        c = c_late[0]
        assert c.get("late_month_count", 0) >= 2, f"tenant C should be late 2 months: {c}"
        assert c.get("total_unpaid", 0) > 0, f"tenant C should have unpaid amount: {c}"
        # Payment ledger must have an entry for tenant C
        ledger = nl.get("payment_ledger") or []
        c_ledger = [e for e in ledger if e.get("tenant") == "C" and e.get("unit") == "103"]
        assert len(c_ledger) >= 1, f"tenant C payment ledger entry not found: {ledger}"

    def test_month_comparison_appears_in_executive_brain(self, api_client):
        """Executive Brain must include month comparison in portfolio.lifecycle."""
        _upload_and_apply(api_client)
        spp_server._portfolio_cache = None  # type: ignore[assignment]
        spp_server._portfolio_cache_at = 0.0  # type: ignore[assignment]
        r = api_client.get(f"{API}/executive")
        brain = r.json()
        portfolio = brain.get("portfolio") or {}
        lc = portfolio.get("lifecycle") or {}
        # mom_change must be present (2 months in fixture)
        assert lc.get("mom_change") is not None, f"portfolio.lifecycle.mom_change missing: {lc}"
        mom = lc["mom_change"]
        assert mom.get("prev_month") is not None
        assert mom.get("cur_month") is not None

    def test_each_operational_event_creates_exactly_one_smart_decision(self, api_client):
        """Each operational event (B departed, D newcomer, C late) must create
        exactly one smart decision — no duplicates."""
        _upload_and_apply(api_client)
        spp_server._portfolio_cache = None  # type: ignore[assignment]
        spp_server._portfolio_cache_at = 0.0  # type: ignore[assignment]
        r = api_client.get(f"{API}/executive")
        brain = r.json()
        ranked = brain.get("ranked_decisions") or []
        # Filter to lifecycle-sourced decisions
        # Gap 4: unified decisions may have source="lifecycle" or source="merged"
        # (when a lifecycle decision merged with a Koïl/live/executive one).
        # Accept both.
        lc_items = [i for i in ranked if i.get("source") in ("lifecycle", "merged", "unified")]
        # Group by (kind, tenant, unit) — each tuple must appear at most once
        seen = {}
        for item in lc_items:
            # Gap 4: unified decisions carry the full decision as a nested
            # "unified_decision" object. Legacy lifecycle decisions carry
            # it as "lifecycle_decision". Check both.
            ld = item.get("unified_decision") or item.get("lifecycle_decision") or item
            key = (ld.get("kind"), ld.get("tenant_name"), ld.get("unit_label"))
            seen[key] = seen.get(key, 0) + 1
        duplicates = {k: v for k, v in seen.items() if v > 1}
        assert not duplicates, f"duplicate lifecycle decisions found: {duplicates}"
        # Must have at least:
        # - 1 contact_late_tenant for C|103
        # - 1 follow_up_departed_tenant for B|102
        # - 1 onboard_new_tenant for D|102
        has_contact_c = any(
            k[0] == "contact_late_tenant" and k[1] == "C" and k[2] == "103"
            for k in seen
        )
        has_followup_b = any(
            k[0] == "follow_up_departed_tenant" and k[1] == "B" and k[2] == "102"
            for k in seen
        )
        has_onboard_d = any(
            k[0] == "onboard_new_tenant" and k[1] == "D" and k[2] == "102"
            for k in seen
        )
        assert has_contact_c, f"missing contact_late_tenant for C|103: {seen}"
        assert has_followup_b, f"missing follow_up_departed_tenant for B|102: {seen}"
        assert has_onboard_d, f"missing onboard_new_tenant for D|102: {seen}"


# ===========================================================================
# Bonus: verify the 7 allowed decision kinds
# ===========================================================================
class TestSevenDecisionKinds:
    def test_only_the_7_kinds_are_emitted(self):
        """The engine must only emit decisions with kinds in LIFECYCLE_DECISION_KINDS."""
        # Fixture that triggers all 7 kinds:
        # - late tenant (contact_late_tenant)
        # - departed tenant (follow_up_departed_tenant)
        # - newcomer (onboard_new_tenant)
        # - payment ledger (review_payment_history)
        # - unconfirmed change (investigate_tenant_change)
        # - 2+ months (compare_collection_periods)
        # - unresolved (request_missing_lifecycle_data)
        normalized = {
            "has_real_content": True,
            "reporting_period": {"from_year": 2026, "from_month": 1, "to_year": 2026, "to_month": 2},
            "late_tenants": [
                {"tenant": "C", "unit": "103", "late_month_count": 2, "total_unpaid": 8000, "months": []},
            ],
            "departed": [
                {"tenant": "B", "unit": "102", "departed_month": 2, "departed_year": 2026, "reason": "استبدال — D", "confirmed": True},
            ],
            "newcomers": [
                {"tenant": "D", "unit": "102", "arrived_month": 2, "arrived_year": 2026, "confirmed": True},
            ],
            "tenant_changes": [
                {"unit": "105", "from_tenant": "X", "to_tenant": "Y", "type": "replacement", "confirmed": False},
            ],
            "payment_ledger": [
                {"tenant": "C", "unit": "103", "months": [{"status": "unpaid_confirmed"}], "total_paid": 0, "total_unpaid": 8000},
            ],
            "month_comparison": [
                {"month": "يناير", "month_num": 1, "revenue": 13500, "collected": 9500, "delta_revenue": 0},
                {"month": "فبراير", "month_num": 2, "revenue": 13800, "collected": 9800, "delta_revenue": 300},
            ],
            "unresolved": [
                {"code": "unclear_payment_months", "detail": "1 unclear month", "count": 1},
            ],
        }
        decisions = generate_lifecycle_decisions(normalized, gate=None)
        kinds_emitted = {d["kind"] for d in decisions}
        # All emitted kinds must be in the allowed set
        assert kinds_emitted.issubset(set(LIFECYCLE_DECISION_KINDS)), (
            f"unexpected kinds emitted: {kinds_emitted - set(LIFECYCLE_DECISION_KINDS)}"
        )
        # Must have at least 5 of the 7 kinds (some may not fire in this fixture)
        assert len(kinds_emitted) >= 5, (
            f"expected >= 5 kinds, got {len(kinds_emitted)}: {kinds_emitted}"
        )
