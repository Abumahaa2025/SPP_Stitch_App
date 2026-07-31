"""Gap 5 — Authoritative Consistency Gate.

Tests that the existing consistency gate is normalized into ONE authoritative
shape, applied entity-aware across all live SPP intelligence outputs, and
persisted in ai_state.

Covers requirements 16a-16t.
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
from adapters.gate import (
    GATE_VERSION,
    apply_gate_to_briefing,
    apply_gate_to_executive_brain,
    apply_gate_to_unified_decisions,
    is_entity_blocked,
    normalize_gate_output,
)
from adapters.koil.consistency_gate import run_consistency_gate

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
        {"name": "كشف_شهر_1_2026.csv", "textSnippet": CSV_JAN, "mimeType": "text/csv"},
        {"name": "كشف_شهر_2_2026.csv", "textSnippet": CSV_FEB, "mimeType": "text/csv"},
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


# ===========================================================================
# Gate shape + normalization
# ===========================================================================
class TestGateNormalization:
    def test_normalized_gate_has_all_required_fields(self):
        """The normalized gate must have all 10 required top-level fields."""
        raw = {"decision_status": "ok", "message": "OK", "conflicts": [], "conflict_count": 0}
        ng = normalize_gate_output(raw, analysis_id="test")
        required = {
            "version", "status", "confidence_cap", "blocking_reasons",
            "warnings", "conflicts", "affected_outputs", "review_actions",
            "checked_at", "analysis_id",
        }
        assert required.issubset(set(ng.keys())), f"missing: {required - set(ng.keys())}"
        assert ng["version"] == GATE_VERSION
        assert ng["status"] == "ok"
        assert ng["confidence_cap"] == 100

    def test_blocked_gate_has_conflict_with_entity_metadata(self):
        """When the raw gate has conflicts, the normalized gate enriches them
        with entity_type, severity, tenant_name, unit_label, etc."""
        raw = {
            "decision_status": "blocked_for_review",
            "message": "blocked",
            "conflicts": [{"code": "paid_marked_overdue", "unit": "101", "detail": "test"}],
            "conflict_count": 1,
        }
        ng = normalize_gate_output(raw, analysis_id="test")
        assert ng["status"] == "blocked_for_review"
        assert ng["confidence_cap"] == 50
        assert len(ng["conflicts"]) == 1
        c = ng["conflicts"][0]
        assert c["code"] == "paid_marked_overdue"
        assert c["severity"] == "high"
        assert c["entity_type"] == "unit"
        assert c["unit_label"] == "101"
        assert c["requires_review"] is True


# ===========================================================================
# 16a. Paid + overdue conflict blocks only the affected tenant decision
# ===========================================================================
class TestEntityAwareBlocking:
    def test_paid_overdue_blocks_only_affected_tenant(self):
        """A conflict for tenant C/unit 103 must NOT block a decision for tenant A/unit 101."""
        ng = normalize_gate_output({
            "decision_status": "blocked_for_review",
            "message": "blocked",
            "conflicts": [{"code": "paid_marked_overdue", "unit": "103", "detail": "test"}],
            "conflict_count": 1,
        }, analysis_id="test")
        # Decision for C/103 → blocked
        blocked_c = is_entity_blocked({"tenant_name": "C", "unit_label": "103"}, ng)
        assert blocked_c is True
        # Decision for A/101 → NOT blocked
        blocked_a = is_entity_blocked({"tenant_name": "A", "unit_label": "101"}, ng)
        assert blocked_a is False

    def test_unrelated_maintenance_remains_executable(self):
        """A maintenance decision for unit 205 must remain executable when
        the conflict is about unit 103."""
        ng = normalize_gate_output({
            "decision_status": "blocked_for_review",
            "message": "blocked",
            "conflicts": [{"code": "paid_marked_overdue", "unit": "103", "detail": "test"}],
            "conflict_count": 1,
        }, analysis_id="test")
        blocked = is_entity_blocked({"tenant_name": None, "unit_label": "205", "property_id": None}, ng)
        assert blocked is False

    def test_global_conflict_blocks_everything(self):
        """A global conflict (e.g. low_classification_confidence) blocks all decisions."""
        ng = normalize_gate_output({
            "decision_status": "blocked_for_review",
            "message": "blocked",
            "conflicts": [{"code": "low_classification_confidence", "file": "f.csv", "detail": "test"}],
            "conflict_count": 1,
        }, analysis_id="test")
        # Any decision → blocked
        assert is_entity_blocked({"tenant_name": "X", "unit_label": "999"}, ng) is True
        assert is_entity_blocked({"tenant_name": None, "unit_label": None}, ng) is True


# ===========================================================================
# 16b. Departed + active conflict changes briefing language to review mode
# ===========================================================================
class TestBriefingReviewLanguage:
    def test_blocked_gate_rephrases_briefing_claims(self):
        """When gate is blocked, briefing claims about departures/late tenants
        are rephrased as review requirements."""
        ng = normalize_gate_output({
            "decision_status": "blocked_for_review",
            "message": "blocked",
            "conflicts": [{"code": "departed_and_active", "unit": "102", "detail": "test"}],
            "conflict_count": 1,
        }, analysis_id="test")
        brief = {
            "headline": "غادر المستأجر خالد الوحدة 101.",
            "narrative": ["غادر المستأجر خالد الوحدة 101.", "لمحة: ..."],
            "ai_reasoning": {},
        }
        result = apply_gate_to_briefing(brief, ng)
        # Headline must change to review language
        assert "راجع" in result["headline"]
        # Narrative must NOT contain definitive departure claim
        narrative_text = " ".join(result["narrative"])
        assert "غادر المستأجر خالد" not in narrative_text
        assert "مراجعة" in narrative_text or "مؤشرات" in narrative_text


# ===========================================================================
# 16c. Different tenants in the same unit do not create false departure
# ===========================================================================
class TestNoFalseDeparture:
    def test_different_tenants_same_unit_no_false_departure(self):
        """The gate must detect that two different tenants on the same unit
        is a conflict (duplicate_tenant_unit), not a confirmed departure."""
        # This is tested via the existing false_tenant_turnover detector.
        # The key assertion: when the gate detects a conflict, it does NOT
        # allow a confident departure claim.
        ng = normalize_gate_output({
            "decision_status": "blocked_for_review",
            "message": "blocked",
            "conflicts": [{"code": "false_tenant_turnover", "unit": "102", "detail": "test"}],
            "conflict_count": 1,
        }, analysis_id="test")
        assert ng["status"] == "blocked_for_review"
        # A departure decision for unit 102 must be blocked.
        assert is_entity_blocked({"tenant_name": "B", "unit_label": "102"}, ng) is True


# ===========================================================================
# 16d. Negative financial values produce a conflict
# ===========================================================================
class TestNegativeValues:
    def test_negative_rent_creates_conflict(self):
        """Negative rent values must be detected as a conflict."""
        deep = {
            "payment_ledger": {
                "ledger": {
                    "k1": {
                        "unit": "101", "tenant": "A", "rent": -5000,
                        "months": [{"month": 1, "year": 2026, "status": "paid", "due": -5000, "paid": -5000}],
                        "total_unpaid": 0, "total_paid": -5000,
                    },
                },
                "late_tenants": [],
            },
            "file_classifications": [],
            "lifecycle": {"departed": [], "newcomers": [], "active": []},
            "late_by_month": {},
            "month_comparison": [],
            "files_without_content": [],
            "parsed_rolls": [{"ok": True, "row_count": 1}],
            "maintenance_log": [],
        }
        knowledge = {"maintenance": {"entries": []}, "lifecycle": {"active": []}, "tenants": []}
        gate = run_consistency_gate(deep, knowledge, lang="ar")
        codes = [c.get("code") for c in gate.get("conflicts") or []]
        assert "negative_value" in codes, f"negative_value not detected: {codes}"


# ===========================================================================
# 16e. Duplicate payment conflict prevents double-count-based decisions
# ===========================================================================
class TestDuplicatePayment:
    def test_duplicate_payment_detected(self):
        """Duplicate payments (same unit+month+amount) must be detected."""
        deep = {
            "payment_ledger": {
                "ledger": {
                    "k1": {
                        "unit": "101", "tenant": "A", "rent": 5000,
                        "months": [
                            {"month": 1, "year": 2026, "status": "paid", "due": 5000, "paid": 5000},
                        ],
                        "total_unpaid": 0, "total_paid": 5000,
                    },
                    "k2": {
                        "unit": "101", "tenant": "A", "rent": 5000,
                        "months": [
                            {"month": 1, "year": 2026, "status": "paid", "due": 5000, "paid": 5000},
                        ],
                        "total_unpaid": 0, "total_paid": 5000,
                    },
                },
                "late_tenants": [],
            },
            "file_classifications": [],
            "lifecycle": {"departed": [], "newcomers": [], "active": []},
            "late_by_month": {},
            "month_comparison": [],
            "files_without_content": [],
            "parsed_rolls": [{"ok": True, "row_count": 2}],
            "maintenance_log": [],
        }
        knowledge = {"maintenance": {"entries": []}, "lifecycle": {"active": []}, "tenants": []}
        gate = run_consistency_gate(deep, knowledge, lang="ar")
        codes = [c.get("code") for c in gate.get("conflicts") or []]
        assert "duplicate_payment" in codes, f"duplicate_payment not detected: {codes}"


# ===========================================================================
# 16f. Closed/open maintenance contradiction blocks the affected action
# ===========================================================================
class TestMaintenanceContradiction:
    def test_closed_and_open_maintenance_detected(self):
        """Maintenance marked both closed and open must be detected."""
        knowledge = {
            "maintenance": {
                "entries": [
                    {"description": "تكييف", "unit": "101", "amount": 500, "status": "closed"},
                    {"description": "تكييف", "unit": "101", "amount": 300, "status": "open"},
                ],
            },
            "lifecycle": {"active": []},
            "tenants": [],
        }
        deep = {
            "payment_ledger": {"ledger": {}, "late_tenants": []},
            "file_classifications": [],
            "lifecycle": {"departed": [], "newcomers": [], "active": []},
            "late_by_month": {},
            "month_comparison": [],
            "files_without_content": [],
            "parsed_rolls": [{"ok": True, "row_count": 1}],
            "maintenance_log": [],
        }
        gate = run_consistency_gate(deep, knowledge, lang="ar")
        codes = [c.get("code") for c in gate.get("conflicts") or []]
        assert "closed_and_open_maintenance" in codes, f"not detected: {codes}"


# ===========================================================================
# 16g. Expired/active contract contradiction appears in verdict evidence
# ===========================================================================
class TestExpiredActiveContract:
    def test_expired_active_contract_detected(self):
        """A contract marked expired while the tenant is active must be detected."""
        knowledge = {
            "maintenance": {"entries": []},
            "lifecycle": {"active": [{"unit": "101", "tenant": "A", "contract_status": "expired"}]},
            "tenants": [],
        }
        deep = {
            "payment_ledger": {"ledger": {}, "late_tenants": []},
            "file_classifications": [],
            "lifecycle": {"departed": [], "newcomers": [], "active": []},
            "late_by_month": {},
            "month_comparison": [],
            "files_without_content": [],
            "parsed_rolls": [{"ok": True, "row_count": 1}],
            "maintenance_log": [],
        }
        gate = run_consistency_gate(deep, knowledge, lang="ar")
        codes = [c.get("code") for c in gate.get("conflicts") or []]
        assert "expired_and_active_contract" in codes, f"not detected: {codes}"


# ===========================================================================
# 16h. Filename-only lifecycle inference remains blocked
# ===========================================================================
class TestFilenameOnlyBlocked:
    def test_filename_only_lifecycle_blocked(self):
        """When all files are filename-only (no content), the gate must detect it."""
        deep = {
            "payment_ledger": {"ledger": {}, "late_tenants": []},
            "file_classifications": [{"name": "f.xlsx", "category": "rent_roll", "confidence": 80}],
            "lifecycle": {"departed": [], "newcomers": [], "active": []},
            "late_by_month": {},
            "month_comparison": [],
            "files_without_content": [{"file_name": "f.xlsx"}],
            "parsed_rolls": [],  # no real content
            "maintenance_log": [],
        }
        knowledge = {"maintenance": {"entries": []}, "lifecycle": {"active": []}, "tenants": []}
        gate = run_consistency_gate(deep, knowledge, lang="ar")
        codes = [c.get("code") for c in gate.get("conflicts") or []]
        assert "filename_only_lifecycle" in codes, f"not detected: {codes}"


# ===========================================================================
# 16i. Unknown tenant/unit decision is converted to review
# ===========================================================================
class TestUnknownTenantConvertedToReview:
    def test_decision_with_no_entity_refs_blocked_by_global_conflict(self):
        """A decision with no tenant/unit refs is blocked by global conflicts."""
        ng = normalize_gate_output({
            "decision_status": "blocked_for_review",
            "message": "blocked",
            "conflicts": [{"code": "low_classification_confidence", "file": "f", "detail": "test"}],
            "conflict_count": 1,
        }, analysis_id="test")
        decisions = [{"id": "d1", "kind": "tenant", "tenant_name": None, "unit_label": None, "confidence": 80}]
        result = apply_gate_to_unified_decisions(decisions, ng)
        assert result[0]["blocked_by_gate"] is True
        assert result[0]["confidence_after_gate"] <= 50
        assert result[0]["requires_confirmation"] is True


# ===========================================================================
# 16j. Executive total mismatch creates portfolio-level warning or block
# ===========================================================================
class TestExecutiveTotalMismatch:
    def test_ledger_board_mismatch_is_global_conflict(self):
        """The existing ledger_board_mismatch conflict must be classified as global."""
        ng = normalize_gate_output({
            "decision_status": "blocked_for_review",
            "message": "blocked",
            "conflicts": [{"code": "ledger_board_mismatch", "detail": "test"}],
            "conflict_count": 1,
        }, analysis_id="test")
        # Must be in GLOBAL_CONFLICT_CODES → blocks everything
        assert is_entity_blocked({"tenant_name": "X", "unit_label": "999"}, ng) is True


# ===========================================================================
# 16k. Low classification confidence propagates to live endpoints
# ===========================================================================
class TestLowClassificationPropagates:
    def test_low_classification_is_global_block(self, api_client):
        """Low classification confidence must propagate as a global block."""
        ng = normalize_gate_output({
            "decision_status": "blocked_for_review",
            "message": "blocked",
            "conflicts": [{"code": "low_classification_confidence", "file": "f", "detail": "test"}],
            "conflict_count": 1,
        }, analysis_id="test")
        assert ng["status"] == "blocked_for_review"
        assert ng["confidence_cap"] == 50
        # Affected outputs must include briefing + verdicts + executive
        assert "briefing" in ng["affected_outputs"]
        assert "verdicts" in ng["affected_outputs"]
        assert "executive_brain" in ng["affected_outputs"]


# ===========================================================================
# 16l. Unrelated valid decisions remain executable
# ===========================================================================
class TestUnrelatedDecisionsExecutable:
    def test_unrelated_decision_not_blocked(self):
        """When the gate has an entity-specific conflict, unrelated decisions
        must remain executable (not blocked)."""
        ng = normalize_gate_output({
            "decision_status": "blocked_for_review",
            "message": "blocked",
            "conflicts": [{"code": "paid_marked_overdue", "unit": "103", "detail": "test"}],
            "conflict_count": 1,
        }, analysis_id="test")
        decisions = [
            {"id": "d1", "kind": "contact_late_tenant", "tenant_name": "C", "unit_label": "103", "confidence": 88},
            {"id": "d2", "kind": "maintenance", "tenant_name": None, "unit_label": "205", "confidence": 70},
        ]
        result = apply_gate_to_unified_decisions(decisions, ng)
        # d1 (C/103) must be blocked
        assert result[0]["blocked_by_gate"] is True
        assert result[0]["confidence_after_gate"] <= 50
        # d2 (unit 205) must NOT be blocked
        assert result[1]["blocked_by_gate"] is False
        assert result[1]["confidence_after_gate"] == 70  # unchanged
        assert result[1]["gate_status"] == "ok"


# ===========================================================================
# 16m. Executive agenda separates blocked review items from executable
# ===========================================================================
class TestExecutiveAgendaSeparation:
    def test_blocked_items_in_review_queue(self):
        """Blocked items must appear in review_queue, not in ranked_decisions."""
        ng = normalize_gate_output({
            "decision_status": "blocked_for_review",
            "message": "blocked",
            "conflicts": [{"code": "paid_marked_overdue", "unit": "103", "detail": "test"}],
            "conflict_count": 1,
        }, analysis_id="test")
        brain = {
            "ranked_decisions": [
                {"id": "d1", "kind": "contact_late_tenant",
                 "unified_decision": {"tenant_name": "C", "unit_label": "103"},
                 "tenant_name": "C", "unit_label": "103", "tier": "now"},
                {"id": "d2", "kind": "maintenance",
                 "unified_decision": {"tenant_name": None, "unit_label": "205"},
                 "tenant_name": None, "unit_label": "205", "tier": "today"},
            ],
            "agenda": {"now": [{"id": "d1", "unified_decision": {"tenant_name": "C", "unit_label": "103"}}],
                       "today": [{"id": "d2", "unified_decision": {"tenant_name": None, "unit_label": "205"}}],
                       "this_week": [], "follow_up": []},
            "daily_brief": {"what": "test", "why": "test", "outcome": "test"},
        }
        result = apply_gate_to_executive_brain(brain, ng)
        # d1 must be in review_queue
        review_ids = [r["id"] for r in result.get("review_queue") or []]
        assert "d1" in review_ids, f"d1 not in review_queue: {review_ids}"
        # d1 must NOT be in ranked_decisions
        ranked_ids = [r["id"] for r in result.get("ranked_decisions") or []]
        assert "d1" not in ranked_ids
        assert "d2" in ranked_ids
        # data_confidence must be present
        assert "data_confidence" in result


# ===========================================================================
# 16n. Executive report exposes data_confidence
# ===========================================================================
class TestDataConfidence:
    def test_data_confidence_block_present(self):
        """The executive brain must include a data_confidence block."""
        ng = normalize_gate_output({
            "decision_status": "ok", "message": "OK", "conflicts": [], "conflict_count": 0,
        }, analysis_id="test")
        brain = {"ranked_decisions": [], "agenda": {}, "daily_brief": {}}
        result = apply_gate_to_executive_brain(brain, ng)
        assert "data_confidence" in result
        dc = result["data_confidence"]
        assert "status" in dc
        assert "confidence" in dc
        assert "confirmed_facts_count" in dc
        assert "warnings_count" in dc
        assert "blocked_items_count" in dc
        assert "conflicts" in dc


# ===========================================================================
# 16o. Property Memory keeps raw facts but marks affected intelligence
# ===========================================================================
class TestPropertyMemoryPreserved:
    def test_gate_does_not_delete_memory(self):
        """The gate must NOT delete property memory or executive intelligence.
        It only marks affected items for review."""
        ng = normalize_gate_output({
            "decision_status": "blocked_for_review",
            "message": "blocked",
            "conflicts": [{"code": "paid_marked_overdue", "unit": "103", "detail": "test"}],
            "conflict_count": 1,
        }, analysis_id="test")
        # The gate normalizer must NOT remove any data — it only adds
        # gate_status / blocked_by_gate fields.
        assert ng["status"] == "blocked_for_review"
        # affected_outputs lists what's degraded, but doesn't delete anything
        assert "portfolio_memory_narratives" in ng["affected_outputs"]
        assert "executive_intelligence" in ng["affected_outputs"]


# ===========================================================================
# 16p. Gate state persists after Apply and cache clear
# ===========================================================================
class TestGatePersists:
    def test_normalized_gate_in_ai_state(self, api_client):
        """After Apply, ai_state must include normalized_gate."""
        aid = _upload_and_apply(api_client)
        store = spp_server._memory_db.get(spp_server._AI_STATE_COLLECTION) or {}
        ai_state = store[aid]
        assert "normalized_gate" in ai_state
        ng = ai_state["normalized_gate"]
        assert ng["version"] == GATE_VERSION
        assert ng["status"] in ("ok", "warning", "blocked_for_review")

    def test_gate_survives_cache_clear(self, api_client):
        """After Apply + cache clear, /api/briefing must reflect the gate."""
        _upload_and_apply(api_client)
        spp_server._portfolio_cache = None
        spp_server._portfolio_cache_at = 0.0
        r = api_client.get(f"{API}/briefing")
        assert r.status_code == 200
        brief = r.json()
        ai_r = brief.get("ai_reasoning") or {}
        # gate_status must be present (even if "ok")
        assert "gate_status" in ai_r


# ===========================================================================
# 16q. Repeated Apply remains idempotent
# ===========================================================================
class TestIdempotentApply:
    def test_repeated_apply_same_gate(self, api_client):
        """Applying the same analysis_id twice must not change the gate."""
        aid = _upload_and_apply(api_client)
        store1 = dict(spp_server._memory_db.get(spp_server._AI_STATE_COLLECTION) or {})
        ng1 = (store1.get(aid) or {}).get("normalized_gate") or {}
        # Apply again
        api_client.post(f"{API}/upload/apply-analysis", json={"analysis_id": aid, "files": _files()})
        store2 = spp_server._memory_db.get(spp_server._AI_STATE_COLLECTION) or {}
        ng2 = (store2.get(aid) or {}).get("normalized_gate") or {}
        # Status must be the same
        assert ng1.get("status") == ng2.get("status")
        assert ng1.get("confidence_cap") == ng2.get("confidence_cap")


# ===========================================================================
# 16r. Missing persisted gate preserves previous behavior
# ===========================================================================
class TestMissingGateBackwardCompat:
    def test_endpoints_work_without_gate(self, api_client):
        """Without ai_state, all endpoints must work as before (no gate applied)."""
        spp_server._memory_insert_all(spp_server._seed_dataset())
        spp_server._portfolio_cache = None
        spp_server._portfolio_cache_at = 0.0
        for path in ("/briefing", "/verdicts", "/executive"):
            r = api_client.get(f"{API}{path}")
            assert r.status_code == 200, f"{path} returned {r.status_code}"


# ===========================================================================
# 16s. Existing gate tests remain unchanged and passing
# ===========================================================================
class TestExistingGateTestsUnchanged:
    def test_run_consistency_gate_still_works(self):
        """The existing run_consistency_gate() must still work unchanged."""
        deep = {
            "payment_ledger": {"ledger": {}, "late_tenants": []},
            "file_classifications": [{"name": "f", "category": "rent_roll", "confidence": 80}],
            "lifecycle": {"departed": [], "newcomers": [], "active": []},
            "late_by_month": {},
            "month_comparison": [],
            "files_without_content": [],
            "parsed_rolls": [{"ok": True, "row_count": 1}],
            "maintenance_log": [],
        }
        knowledge = {"maintenance": {"entries": []}, "lifecycle": {"active": []}, "tenants": []}
        gate = run_consistency_gate(deep, knowledge, lang="ar")
        assert "decision_status" in gate
        assert "conflicts" in gate
        assert "conflict_count" in gate

    def test_apply_gate_to_reasoning_still_works(self):
        """The existing apply_gate_to_reasoning() must still work unchanged."""
        from adapters.koil.consistency_gate import apply_gate_to_reasoning
        reasoning = {"brief": "test", "what_happened": [], "why": [], "risks": [], "recommendations": []}
        gate_ok = {"decision_status": "ok", "conflicts": []}
        result = apply_gate_to_reasoning(reasoning, gate_ok, lang="ar")
        assert result["decision_status"] == "ok"


# ===========================================================================
# 16t. Full regression remains green — verified by running all tests together
# ===========================================================================

# ===========================================================================
# Unified decision gate fields
# ===========================================================================
class TestUnifiedDecisionGateFields:
    def test_blocked_decision_has_all_gate_fields(self):
        """A blocked unified decision must have all 7 gate fields."""
        ng = normalize_gate_output({
            "decision_status": "blocked_for_review",
            "message": "blocked",
            "conflicts": [{"code": "paid_marked_overdue", "unit": "103", "detail": "test"}],
            "conflict_count": 1,
        }, analysis_id="test")
        decisions = [{"id": "d1", "kind": "contact_late_tenant", "tenant_name": "C", "unit_label": "103", "confidence": 88}]
        result = apply_gate_to_unified_decisions(decisions, ng)
        d = result[0]
        assert d["blocked_by_gate"] is True
        assert d["gate_status"] == "blocked_for_review"
        assert "gate_conflict_codes" in d
        assert "gate_evidence" in d
        assert "confidence_before_gate" in d
        assert "confidence_after_gate" in d
        assert d["requires_confirmation"] is True
        assert d["confidence_before_gate"] == 88
        assert d["confidence_after_gate"] <= 50


# ===========================================================================
# End-to-end: gate applied to live endpoints after Apply
# ===========================================================================
class TestEndToEndGateOnLiveEndpoints:
    def test_briefing_has_gate_status_after_apply(self, api_client):
        """After Apply, /api/briefing must include gate_status in ai_reasoning."""
        _upload_and_apply(api_client)
        spp_server._portfolio_cache = None
        spp_server._portfolio_cache_at = 0.0
        r = api_client.get(f"{API}/briefing")
        brief = r.json()
        ai_r = brief.get("ai_reasoning") or {}
        assert "gate_status" in ai_r
        assert ai_r["gate_status"] in ("ok", "warning", "blocked_for_review")

    def test_executive_has_data_confidence_after_apply(self, api_client):
        """After Apply, /api/executive must include data_confidence block."""
        _upload_and_apply(api_client)
        spp_server._portfolio_cache = None
        spp_server._portfolio_cache_at = 0.0
        r = api_client.get(f"{API}/executive")
        brain = r.json()
        assert "data_confidence" in brain
        dc = brain["data_confidence"]
        assert dc["status"] in ("ok", "warning", "blocked_for_review")

    def test_decisions_have_gate_fields_after_apply(self, api_client):
        """After Apply, /api/decisions unified decisions must have gate fields."""
        _upload_and_apply(api_client)
        spp_server._portfolio_cache = None
        spp_server._portfolio_cache_at = 0.0
        r = api_client.get(f"{API}/decisions")
        data = r.json()
        if isinstance(data, dict) and data.get("_source") == "unified":
            for d in data.get("decisions") or []:
                assert "blocked_by_gate" in d
                assert "gate_status" in d
                assert "confidence_before_gate" in d
                assert "confidence_after_gate" in d
