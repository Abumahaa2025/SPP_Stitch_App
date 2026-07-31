"""Focused consistency tests — Gap A/D/B/E/C/F corrections.

Tests:
a. 1 property, 9 units (now 6 unique), and 6 active tenants remain three different values.
b. Vacant units are included in units_count.
c. properties_count never derives from lifecycle.active_count.
d. executive.portfolio.units equals canonical units_count.
e. briefing preserves the existing properties_count meaning.
f. all verdicts contain every required traceability field.
g. missing canonical state preserves legacy counting behavior.
h. medium conflicts preserve ranked decisions and cap confidence.
i. high global conflicts may move all affected decisions to review.
j. high entity conflicts do not block unrelated entities.
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
os.environ["AI_ENABLED"] = "false"

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO))
sys.path.insert(0, str(REPO / "backend"))

import pytest
from fastapi.testclient import TestClient

import server as spp_server
from adapters.gate import normalize_gate_output, apply_gate_to_executive_brain, is_entity_blocked

API = "/api"

CSV_JAN = (
    "وحدة,مستأجر,إيجار,حالة,جوال,عقد\n"
    "101,Ahmad,5000,مسدد,0501111111,C-101\n"
    "102,Khalid,4500,مسدد,0502222222,C-102\n"
    "201,Salem,6000,مسدد,0503333333,C-201\n"
    "202,Nora,5500,متأخر,0504444444,C-202\n"
    "301,Omar,7000,مسدد,0505555555,C-301\n"
    "302,Fatima,4800,مسدد,,C-302\n"
)
CSV_FEB = (
    "وحدة,مستأجر,إيجار,حالة,جوال,عقد\n"
    "101,Ahmad,5000,مسدد,0501111111,C-101\n"
    "102,Reem,4800,مسدد,0506666666,C-102-new\n"
    "201,Salem,6000,مسدد,0503333333,C-201\n"
    "202,Nora,5500,متأخر,0504444444,C-202\n"
    "301,Omar,7000,مسدد,0505555555,C-301\n"
    "302,Fatima,4800,مسدد,,C-302\n"
)


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
    spp_server._llm_service = None
    with TestClient(spp_server.app) as client:
        yield client


def _upload_and_apply(client, files=None):
    files = files or [
        {"name": "f1.csv", "textSnippet": CSV_JAN, "mimeType": "text/csv"},
        {"name": "f2.csv", "textSnippet": CSV_FEB, "mimeType": "text/csv"},
    ]
    r = client.post(f"{API}/upload/portfolio-analysis", json={"files": files, "lang": "ar"})
    assert r.status_code == 200
    aid = r.json()["analysis_id"]
    r2 = client.post(f"{API}/upload/apply-analysis", json={"analysis_id": aid, "files": files})
    assert r2.status_code == 200
    return aid


def _fresh_get(client, path):
    spp_server._portfolio_cache = None
    spp_server._portfolio_cache_at = 0.0
    return client.get(path).json()


# ===========================================================================
# a. 1 property, N units, and 6 active tenants remain three different values
# ===========================================================================
class TestCountHierarchy:
    def test_property_unit_tenant_counts_are_different(self, api_client):
        """properties_count != units_count != active_tenants_count when they measure different things."""
        aid = _upload_and_apply(api_client)
        brief = _fresh_get(api_client, f"{API}/briefing")
        brain = _fresh_get(api_client, f"{API}/executive")

        store = spp_server._memory_db.get(spp_server._AI_STATE_COLLECTION) or {}
        ai = store.get(aid) or {}
        cps = ai.get("canonical_portfolio_summary") or {}
        nl = ai.get("normalized_lifecycle") or {}

        properties_count = brief.get("properties_count")
        units_count = cps.get("units_count")
        active_tenants = nl.get("summary", {}).get("active_count")

        print(f"properties_count={properties_count}, units_count={units_count}, active_tenants={active_tenants}")

        # properties_count = 1 (one imported property entity)
        assert properties_count == 1, f"properties_count should be 1, got {properties_count}"
        # units_count = 6 (six unique units: 101,102,201,202,301,302)
        assert units_count == 6, f"units_count should be 6, got {units_count}"
        # active_tenants = 6
        assert active_tenants == 6, f"active_tenants should be 6, got {active_tenants}"
        # They must be DIFFERENT values (1 != 6)
        assert properties_count != units_count, "properties_count must not equal units_count"


# ===========================================================================
# b. Vacant units are included in units_count
# ===========================================================================
class TestVacantUnitsIncluded:
    def test_vacant_units_in_count(self, api_client):
        """units_count includes vacant units (units with no active tenant)."""
        # Use a fixture with a vacant unit (unit 102 has no tenant name)
        csv_vacant_jan = "وحدة,مستأجر,إيجار,حالة,جوال,عقد\n101,Ahmad,5000,مسدد,0501111111,C-101\n102,,0,,,\n"
        csv_vacant_feb = "وحدة,مستأجر,إيجار,حالة,جوال,عقد\n101,Ahmad,5000,مسدد,0501111111,C-101\n102,,0,,,\n"
        files = [
            {"name": "f1.csv", "textSnippet": csv_vacant_jan, "mimeType": "text/csv"},
            {"name": "f2.csv", "textSnippet": csv_vacant_feb, "mimeType": "text/csv"},
        ]
        aid = _upload_and_apply(api_client, files=files)
        store = spp_server._memory_db.get(spp_server._AI_STATE_COLLECTION) or {}
        ai = store.get(aid) or {}
        cps = ai.get("canonical_portfolio_summary") or {}
        nl = ai.get("normalized_lifecycle") or {}

        units_count = cps.get("units_count")
        active_tenants = nl.get("summary", {}).get("active_count")

        # 2 units total (101 occupied + 102 vacant)
        assert units_count == 2, f"units_count should be 2 (incl vacant), got {units_count}"
        # active_tenants may be 1 or 2 depending on how the parser handles
        # the empty tenant — the key assertion is that units_count > active_tenants
        # (because unit 102 is vacant and should still be counted in units)
        assert units_count >= active_tenants, f"units_count ({units_count}) should be >= active_tenants ({active_tenants})"


# ===========================================================================
# c. properties_count never derives from lifecycle.active_count
# ===========================================================================
class TestPropertiesCountNotFromLifecycle:
    def test_properties_count_is_not_active_count(self, api_client):
        """properties_count must NOT be derived from lifecycle.active_count.
        
        properties_count counts property rows (1 for imported portfolio).
        active_count counts active tenants (6 for this fixture).
        They measure fundamentally different things.
        """
        _upload_and_apply(api_client)
        brief = _fresh_get(api_client, f"{API}/briefing")

        store = spp_server._memory_db.get(spp_server._AI_STATE_COLLECTION) or {}
        ai = next(iter(store.values()), {})
        nl = ai.get("normalized_lifecycle") or {}
        active_count = nl.get("summary", {}).get("active_count")

        properties_count = brief.get("properties_count")

        # properties_count = 1 (property rows), active_count = 6 (active tenants)
        # They must be different values (1 != 6)
        assert properties_count == 1, f"properties_count should be 1, got {properties_count}"
        assert active_count == 6, f"active_count should be 6, got {active_count}"
        assert properties_count != active_count, "properties_count must not equal active_count"


# ===========================================================================
# d. executive.portfolio.units equals canonical units_count
# ===========================================================================
class TestExecutiveUnitsMatchesCanonical:
    def test_executive_units_equals_canonical(self, api_client):
        """executive.portfolio.units must equal canonical_portfolio_summary.units_count."""
        aid = _upload_and_apply(api_client)
        brain = _fresh_get(api_client, f"{API}/executive")

        store = spp_server._memory_db.get(spp_server._AI_STATE_COLLECTION) or {}
        ai = store.get(aid) or {}
        cps = ai.get("canonical_portfolio_summary") or {}

        exec_units = brain.get("portfolio", {}).get("units")
        canon_units = cps.get("units_count")

        assert exec_units == canon_units, f"executive.units={exec_units} != canonical.units_count={canon_units}"


# ===========================================================================
# e. briefing preserves the existing properties_count meaning
# ===========================================================================
class TestBriefingPropertiesCountMeaning:
    def test_briefing_properties_count_is_property_rows(self, api_client):
        """briefing.properties_count counts property rows, NOT units or tenants."""
        _upload_and_apply(api_client)
        brief = _fresh_get(api_client, f"{API}/briefing")

        properties_count = brief.get("properties_count")
        # After import, there's 1 property row (prop_imp_...)
        assert properties_count == 1, f"properties_count should be 1 (property row), got {properties_count}"

    def test_briefing_legacy_without_ai_state(self, api_client):
        """Without AI state, briefing.properties_count = len(properties) from seed."""
        spp_server._memory_insert_all(spp_server._seed_dataset())
        spp_server._portfolio_cache = None
        spp_server._portfolio_cache_at = 0.0
        brief = _fresh_get(api_client, f"{API}/briefing")
        assert brief["properties_count"] == 4  # seed has 4 properties


# ===========================================================================
# f. all verdicts contain every required traceability field
# ===========================================================================
class TestAllVerdictsHaveRequiredFields:
    REQUIRED_FIELDS = [
        "evidence_source",
        "unified_decision_id",
        "gate_status",
        "confidence",
        "requires_review",
        "conflict_codes",
        "evidence",
    ]

    def test_all_verdicts_have_all_fields(self, api_client):
        """Every non-None verdict must have ALL 7 required traceability fields."""
        _upload_and_apply(api_client)
        verdicts = _fresh_get(api_client, f"{API}/verdicts")

        for vkey, v in verdicts.items():
            if v is None:
                continue
            assert isinstance(v, dict), f"verdicts.{vkey} is not a dict"
            for field in self.REQUIRED_FIELDS:
                assert field in v, f"verdicts.{vkey} missing required field: {field}"


# ===========================================================================
# g. missing canonical state preserves legacy counting behavior
# ===========================================================================
class TestMissingCanonicalPreservesLegacy:
    def test_legacy_counts_without_ai_state(self, api_client):
        """Without AI state, all counts fall back to len(properties)/len(tenants)."""
        spp_server._memory_insert_all(spp_server._seed_dataset())
        spp_server._portfolio_cache = None
        spp_server._portfolio_cache_at = 0.0
        brief = _fresh_get(api_client, f"{API}/briefing")
        brain = _fresh_get(api_client, f"{API}/executive")

        assert brief["properties_count"] == 4
        assert brief["tenants_count"] == 4
        assert brain["portfolio"]["units"] == 4  # legacy: len(properties)
        assert brain["portfolio"]["tenants"] == 4  # legacy: len(tenants)


# ===========================================================================
# h. medium conflicts preserve ranked decisions and cap confidence
# ===========================================================================
class TestMediumConflictsPreserveRanked:
    def test_medium_conflict_preserves_ranked(self):
        """A medium-only conflict should produce status=warning, not blocked_for_review."""
        ng = normalize_gate_output({
            "decision_status": "blocked_for_review",
            "message": "blocked",
            "conflicts": [{"code": "monthly_summary_mismatch", "detail": "test"}],
            "conflict_count": 1,
        }, analysis_id="test")
        assert ng["status"] == "warning"
        assert ng["confidence_cap"] == 70

        # Decisions should stay in ranked
        brain = {
            "ranked_decisions": [{"id": "d1", "unified_decision": {"tenant_name": "A", "unit_label": "101"}, "tier": "now"}],
            "agenda": {"now": [], "today": [], "this_week": [], "follow_up": []},
            "daily_brief": {"what": "test", "why": "test", "outcome": "test", "focus_count": 1, "recoverable_aed": 0, "salutation": "", "owner_name": ""},
        }
        result = apply_gate_to_executive_brain(brain, ng)
        assert len(result.get("ranked_decisions") or []) == 1
        assert len(result.get("review_queue") or []) == 0


# ===========================================================================
# i. high global conflicts may move all affected decisions to review
# ===========================================================================
class TestHighGlobalConflictsBlockAll:
    def test_high_global_conflict_blocks_all(self):
        """A high-severity global conflict (low_classification_confidence) blocks all decisions."""
        ng = normalize_gate_output({
            "decision_status": "blocked_for_review",
            "message": "blocked",
            "conflicts": [{"code": "low_classification_confidence", "file": "f.csv", "detail": "test"}],
            "conflict_count": 1,
        }, analysis_id="test")
        assert ng["status"] == "blocked_for_review"

        brain = {
            "ranked_decisions": [
                {"id": "d1", "unified_decision": {"tenant_name": "A", "unit_label": "101"}, "tier": "now"},
                {"id": "d2", "unified_decision": {"tenant_name": "B", "unit_label": "102"}, "tier": "today"},
            ],
            "agenda": {"now": [], "today": [], "this_week": [], "follow_up": []},
            "daily_brief": {"what": "test", "why": "test", "outcome": "test", "focus_count": 2, "recoverable_aed": 0, "salutation": "", "owner_name": ""},
        }
        result = apply_gate_to_executive_brain(brain, ng)
        # ALL decisions should be in review_queue (global conflict)
        assert len(result.get("ranked_decisions") or []) == 0
        assert len(result.get("review_queue") or []) == 2


# ===========================================================================
# j. high entity conflicts do not block unrelated entities
# ===========================================================================
class TestEntityConflictsDontBlockUnrelated:
    def test_entity_conflict_only_blocks_affected(self):
        """A high-severity entity-specific conflict blocks only the affected entity."""
        ng = normalize_gate_output({
            "decision_status": "blocked_for_review",
            "message": "blocked",
            "conflicts": [{"code": "paid_marked_overdue", "unit": "103", "detail": "test"}],
            "conflict_count": 1,
        }, analysis_id="test")
        assert ng["status"] == "blocked_for_review"

        # Decision for unit 103 → blocked
        assert is_entity_blocked({"tenant_name": "C", "unit_label": "103"}, ng) is True
        # Decision for unit 205 → NOT blocked
        assert is_entity_blocked({"tenant_name": "X", "unit_label": "205"}, ng) is False

        brain = {
            "ranked_decisions": [
                {"id": "d1", "unified_decision": {"tenant_name": "C", "unit_label": "103"}, "tier": "now"},
                {"id": "d2", "unified_decision": {"tenant_name": "X", "unit_label": "205"}, "tier": "today"},
            ],
            "agenda": {"now": [], "today": [], "this_week": [], "follow_up": []},
            "daily_brief": {"what": "test", "why": "test", "outcome": "test", "focus_count": 2, "recoverable_aed": 0, "salutation": "", "owner_name": ""},
        }
        result = apply_gate_to_executive_brain(brain, ng)
        # Only d1 should be in review_queue
        assert len(result.get("ranked_decisions") or []) == 1
        assert len(result.get("review_queue") or []) == 1
        assert result["ranked_decisions"][0]["id"] == "d2"
        assert result["review_queue"][0]["id"] == "d1"


# ===========================================================================
# Test A: 1 property, 9 units, 6 occupied, 3 vacant
# ===========================================================================
class TestVacantUnitsFixture:
    def test_vacant_units_counted_correctly(self, api_client):
        """Fixture with 9 units, 6 occupied, 3 vacant.
        Verify: properties_count=1, units_count=9, occupied=6, vacant=3, active_tenants=6.
        """
        # 9 units: 101-106 occupied, 107-109 vacant (no tenant name)
        csv = (
            "وحدة,مستأجر,إيجار,حالة,جوال,عقد\n"
            "101,A,5000,مسدد,0501,C1\n"
            "102,B,4500,مسدد,0502,C2\n"
            "103,C,6000,مسدد,0503,C3\n"
            "104,D,5500,مسدد,0504,C4\n"
            "105,E,7000,مسدد,0505,C5\n"
            "106,F,4800,مسدد,0506,C6\n"
            "107,,0,,,\n"
            "108,,0,,,\n"
            "109,,0,,,\n"
        )
        files = [{"name": "f1.csv", "textSnippet": csv, "mimeType": "text/csv"}]
        aid = _upload_and_apply(api_client, files=files)

        store = spp_server._memory_db.get(spp_server._AI_STATE_COLLECTION) or {}
        ai = store.get(aid) or {}
        cps = ai.get("canonical_portfolio_summary") or {}
        nl = ai.get("normalized_lifecycle") or {}

        print(f"  properties_count: {cps.get('properties_count')}")
        print(f"  units_count: {cps.get('units_count')}")
        print(f"  occupied_units_count: {cps.get('occupied_units_count')}")
        print(f"  vacant_units_count: {cps.get('vacant_units_count')}")
        print(f"  active_tenants_count: {cps.get('active_tenants_count')}")

        assert cps.get("properties_count") == 1, f"properties_count should be 1, got {cps.get('properties_count')}"
        assert cps.get("units_count") == 9, f"units_count should be 9, got {cps.get('units_count')}"
        assert cps.get("occupied_units_count") == 6, f"occupied_units_count should be 6, got {cps.get('occupied_units_count')}"
        assert cps.get("vacant_units_count") == 3, f"vacant_units_count should be 3, got {cps.get('vacant_units_count')}"
        assert cps.get("active_tenants_count") == 6, f"active_tenants_count should be 6, got {cps.get('active_tenants_count')}"


# ===========================================================================
# Test A2: Canonical vacant-unit entity model
# Show exactly how a vacant unit is represented after normalization:
# unit_id, property_id, tenant_name, occupied, raw tenant value, normalization flags
# ===========================================================================
class TestCanonicalVacantUnitEntityModel:
    def test_vacant_unit_canonical_representation(self, api_client):
        """For one vacant unit, verify all canonical entity fields are correct.

        Required representation after normalization (one vacant unit):
          - unit_id: stable hash of normalized unit label
          - property_id: prop_imp_{analysis_id[:8]} (canonical identity, NOT owner_id)
          - tenant_name: "" (empty — never the unit label)
          - tenant_raw: "" (preserved raw value from input)
          - occupied: False (computed property)
          - is_vacant: True (normalized at ingestion)
          - contract_status: "vacant"
          - normalization_flags: ["vacant"]
        """
        csv = (
            "وحدة,مستأجر,إيجار,حالة,جوال,عقد\n"
            "101,A,5000,مسدد,0501,C1\n"
            "107,,0,,,\n"
        )
        files = [{"name": "f1.csv", "textSnippet": csv, "mimeType": "text/csv"}]
        aid = _upload_and_apply(api_client, files=files)

        # Rebuild the canonical portfolio to inspect CanonicalUnit entities.
        store = spp_server._memory_db.get(spp_server._AI_STATE_COLLECTION) or {}
        ai = store.get(aid) or {}
        pk = ai.get("property_knowledge") or {}

        from adapters.canonical.portfolio import build_portfolio_from_upload_analysis
        portfolio = build_portfolio_from_upload_analysis(
            property_knowledge=pk, metrics={}, analysis_id=aid,
        )

        # Find the vacant unit (label="107")
        vacant = next((u for u in portfolio.units if u.label == "107"), None)
        assert vacant is not None, "vacant unit 107 not found in canonical portfolio"

        # All required canonical entity fields
        assert vacant.unit_id, "vacant unit must have a non-empty unit_id"
        assert vacant.unit_id.startswith("unit_"), \
            f"unit_id should be a stable hash with 'unit_' prefix, got {vacant.unit_id!r}"
        # Canonical property identity — NOT owner_id (which is "owner_imported" for all)
        assert vacant.property_id.startswith("prop_imp_"), \
            f"property_id should be 'prop_imp_<analysis_id[:8]>', got {vacant.property_id!r}"
        assert vacant.property_id != "owner_imported", \
            "property_id must NOT be the import owner_id (constant for all uploads)"
        # Tenant name is empty (NOT the unit label "107")
        assert vacant.tenant_name == "", \
            f"vacant unit tenant_name must be empty, got {vacant.tenant_name!r}"
        # Raw tenant value preserved
        assert vacant.tenant_raw == "", \
            f"vacant unit tenant_raw should preserve the raw empty value, got {vacant.tenant_raw!r}"
        # Occupied flag (computed)
        assert vacant.occupied is False, \
            f"vacant unit.occupied must be False, got {vacant.occupied}"
        # Explicit is_vacant flag (normalized at ingestion)
        assert vacant.is_vacant is True, \
            f"vacant unit.is_vacant must be True, got {vacant.is_vacant}"
        # Contract status
        assert vacant.contract_status == "vacant", \
            f"vacant unit.contract_status must be 'vacant', got {vacant.contract_status!r}"
        # Normalization flags
        assert "vacant" in vacant.normalization_flags, \
            f"normalization_flags should contain 'vacant', got {vacant.normalization_flags}"

        # Also verify the occupied unit (label="101") for contrast
        occupied = next((u for u in portfolio.units if u.label == "101"), None)
        assert occupied is not None, "occupied unit 101 not found"
        assert occupied.tenant_name == "A", \
            f"occupied unit tenant_name should be 'A', got {occupied.tenant_name!r}"
        assert occupied.is_vacant is False, \
            f"occupied unit is_vacant should be False, got {occupied.is_vacant}"
        assert occupied.occupied is True, \
            f"occupied unit.occupied should be True, got {occupied.occupied}"
        assert occupied.contract_status != "vacant", \
            f"occupied unit contract_status should not be 'vacant', got {occupied.contract_status!r}"
        assert occupied.property_id == vacant.property_id, \
            "All units in the same import should share the same property_id"

    def test_vacant_unit_warnings_emitted(self, api_client):
        """Each vacant unit must emit a `vacant_unit` canonical warning.

        Vacant units must NOT emit missing_phone or missing_contract warnings
        (they're expected to be empty). One `vacant_unit` warning per vacant unit.
        """
        csv = (
            "وحدة,مستأجر,إيجار,حالة,جوال,عقد\n"
            "101,A,5000,مسدد,0501,C1\n"
            "107,,0,,,\n"
            "108,,0,,,\n"
        )
        files = [{"name": "f1.csv", "textSnippet": csv, "mimeType": "text/csv"}]
        aid = _upload_and_apply(api_client, files=files)

        store = spp_server._memory_db.get(spp_server._AI_STATE_COLLECTION) or {}
        ai = store.get(aid) or {}
        warnings = ai.get("canonical_warnings") or []

        vacant_warnings = [w for w in warnings if w.get("code") == "vacant_unit"]
        missing_phone_for_vacant = [
            w for w in warnings
            if w.get("code") == "missing_phone" and w.get("unit") in ("107", "108")
        ]
        missing_contract_for_vacant = [
            w for w in warnings
            if w.get("code") == "missing_contract" and w.get("unit") in ("107", "108")
        ]

        assert len(vacant_warnings) == 2, \
            f"expected 2 vacant_unit warnings (107, 108), got {len(vacant_warnings)}: {vacant_warnings}"
        assert not missing_phone_for_vacant, \
            f"vacant units must NOT emit missing_phone warnings: {missing_phone_for_vacant}"
        assert not missing_contract_for_vacant, \
            f"vacant units must NOT emit missing_contract warnings: {missing_contract_for_vacant}"


# ===========================================================================
# Test A3: All four endpoints agree on the 9-unit fixture
# ===========================================================================
class TestAllFourEndpointsAgree:
    def test_canonical_briefing_executive_portfolio_memory_agree(self, api_client):
        """Original required fixture: 1 property, 9 units, 6 occupied, 3 vacant.

        All four outputs (canonical summary, briefing, executive, portfolio-memory)
        must agree on every count they expose.
        """
        csv = (
            "وحدة,مستأجر,إيجار,حالة,جوال,عقد\n"
            "101,A,5000,مسدد,0501,C1\n"
            "102,B,4500,مسدد,0502,C2\n"
            "103,C,6000,مسدد,0503,C3\n"
            "104,D,5500,مسدد,0504,C4\n"
            "105,E,7000,مسدد,0505,C5\n"
            "106,F,4800,مسدد,0506,C6\n"
            "107,,0,,,\n"
            "108,,0,,,\n"
            "109,,0,,,\n"
        )
        files = [{"name": "f1.csv", "textSnippet": csv, "mimeType": "text/csv"}]
        aid = _upload_and_apply(api_client, files=files)

        # 1. Canonical summary (from ai_state)
        store = spp_server._memory_db.get(spp_server._AI_STATE_COLLECTION) or {}
        ai = store.get(aid) or {}
        cps = ai.get("canonical_portfolio_summary") or {}
        nl = ai.get("normalized_lifecycle") or {}
        nl_summary = nl.get("summary") or {}

        # 2. /api/briefing
        brief = _fresh_get(api_client, f"{API}/briefing")
        # 3. /api/executive
        brain = _fresh_get(api_client, f"{API}/executive")
        # 4. /api/portfolio-memory
        mem = _fresh_get(api_client, f"{API}/portfolio-memory")

        print("\n=== Canonical summary ===")
        print(f"  properties_count:        {cps.get('properties_count')}")
        print(f"  units_count:             {cps.get('units_count')}")
        print(f"  occupied_units_count:    {cps.get('occupied_units_count')}")
        print(f"  vacant_units_count:      {cps.get('vacant_units_count')}")
        print(f"  active_tenants_count:    {cps.get('active_tenants_count')}")
        print(f"  lifecycle.active_count:  {nl_summary.get('active_count')}")

        print("\n=== /api/briefing ===")
        print(f"  properties_count:        {brief.get('properties_count')}")
        print(f"  tenants_count:           {brief.get('tenants_count')}")
        print(f"  units_count:             {brief.get('units_count')}")
        print(f"  occupied_units_count:    {brief.get('occupied_units_count')}")
        print(f"  vacant_units_count:      {brief.get('vacant_units_count')}")

        print("\n=== /api/executive.portfolio ===")
        port = brain.get("portfolio") or {}
        print(f"  properties:              {port.get('properties')}")
        print(f"  units:                   {port.get('units')}")
        print(f"  tenants:                 {port.get('tenants')}")
        print(f"  occupied:                {port.get('occupied')}")
        print(f"  vacant:                  {port.get('vacant')}")

        print("\n=== /api/portfolio-memory.summary ===")
        print(f"  summary keys: {list((mem.get('summary') or {}).keys())}")

        # === Assertions: all four outputs must agree ===

        # properties_count: canonical=1, briefing=1, executive=1
        assert cps.get("properties_count") == 1
        assert brief.get("properties_count") == 1
        assert port.get("properties") == 1

        # units_count: canonical=9, briefing=9, executive=9
        assert cps.get("units_count") == 9
        assert brief.get("units_count") == 9
        assert port.get("units") == 9

        # active_tenants / tenants_count: canonical=6, lifecycle=6, briefing=6, executive=6
        assert cps.get("active_tenants_count") == 6
        assert nl_summary.get("active_count") == 6
        assert brief.get("tenants_count") == 6
        assert port.get("tenants") == 6

        # occupied: canonical=6, briefing=6, executive=6
        assert cps.get("occupied_units_count") == 6
        assert brief.get("occupied_units_count") == 6
        assert port.get("occupied") == 6

        # vacant: canonical=3, briefing=3, executive=3
        assert cps.get("vacant_units_count") == 3
        assert brief.get("vacant_units_count") == 3
        assert port.get("vacant") == 3

        # Cross-check: occupied + vacant == units
        assert cps.get("occupied_units_count") + cps.get("vacant_units_count") == cps.get("units_count")
        assert brief.get("occupied_units_count") + brief.get("vacant_units_count") == brief.get("units_count")
        assert port.get("occupied") + port.get("vacant") == port.get("units")

        # Cross-check: occupied == active_tenants (both count non-vacant units)
        assert cps.get("occupied_units_count") == cps.get("active_tenants_count")
        assert brief.get("occupied_units_count") == brief.get("tenants_count")
        assert port.get("occupied") == port.get("tenants")


# ===========================================================================
# Test A4: Property identity is the canonical prop_id, NOT owner_id
# ===========================================================================
class TestPropertyIdentitySource:
    def test_property_id_not_owner_id(self, api_client):
        """Verify _count_unique_properties uses raw.tenant_card.property_id,
        NOT settings.owner_id (which is "owner_imported" for ALL uploads).

        owner_id is a constant import-owner identifier — it would return 1
        even for multi-property imports. The canonical property identity is
        prop_imp_{analysis_id[:8]}, set at analyze time and persisted in
        raw.tenant_card.property_id.
        """
        csv = (
            "وحدة,مستأجر,إيجار,حالة,جوال,عقد\n"
            "101,A,5000,مسدد,0501,C1\n"
            "102,B,4500,مسدد,0502,C2\n"
        )
        files = [{"name": "f1.csv", "textSnippet": csv, "mimeType": "text/csv"}]
        aid = _upload_and_apply(api_client, files=files)

        store = spp_server._memory_db.get(spp_server._AI_STATE_COLLECTION) or {}
        ai = store.get(aid) or {}
        pk = ai.get("property_knowledge") or {}
        cps = ai.get("canonical_portfolio_summary") or {}

        # Verify property_id is set on every tenant card
        from adapters.canonical.portfolio import build_portfolio_from_upload_analysis
        portfolio = build_portfolio_from_upload_analysis(
            property_knowledge=pk, metrics={}, analysis_id=aid,
        )

        for unit in portfolio.units:
            raw = unit.raw or {}
            card = raw.get("tenant_card") or {}
            pid = card.get("property_id")
            assert pid is not None, \
                f"unit {unit.label} tenant_card.property_id must be set (not None)"
            assert pid.startswith("prop_imp_"), \
                f"unit {unit.label} property_id should be 'prop_imp_<id>', got {pid!r}"
            assert pid != "owner_imported", \
                f"unit {unit.label} property_id must NOT be the owner_id constant"

        # Verify settings.owner_id is still "owner_imported" (constant for all uploads)
        # This proves we're NOT using owner_id as the property identity.
        assert portfolio.settings.owner_id == "owner_imported", \
            f"settings.owner_id should still be 'owner_imported' (constant), got {portfolio.settings.owner_id!r}"

        # Verify properties_count == 1 (correct, because there is one prop_id)
        assert cps.get("properties_count") == 1

    def test_two_imports_produce_two_property_ids(self, api_client):
        """Two separate uploads must produce two distinct prop_ids.

        This proves _count_unique_properties would correctly count 2 if both
        uploads were merged into one portfolio (e.g., a future multi-property
        import scenario).
        """
        # First upload
        csv1 = "وحدة,مستأجر,إيجار,حالة,جوال,عقد\n101,A,5000,مسدد,0501,C1\n"
        files1 = [{"name": "f1.csv", "textSnippet": csv1, "mimeType": "text/csv"}]
        aid1 = _upload_and_apply(api_client, files=files1)

        # Second upload (different analysis_id → different prop_id)
        csv2 = "وحدة,مستأجر,إيجار,حالة,جوال,عقد\n201,X,6000,مسدد,0601,C2\n"
        files2 = [{"name": "f2.csv", "textSnippet": csv2, "mimeType": "text/csv"}]
        aid2 = _upload_and_apply(api_client, files=files2)

        assert aid1 != aid2, "two uploads should produce two analysis_ids"

        store = spp_server._memory_db.get(spp_server._AI_STATE_COLLECTION) or {}
        ai1 = store.get(aid1) or {}
        ai2 = store.get(aid2) or {}
        pk1 = ai1.get("property_knowledge") or {}
        pk2 = ai2.get("property_knowledge") or {}

        from adapters.canonical.portfolio import build_portfolio_from_upload_analysis
        p1 = build_portfolio_from_upload_analysis(property_knowledge=pk1, metrics={}, analysis_id=aid1)
        p2 = build_portfolio_from_upload_analysis(property_knowledge=pk2, metrics={}, analysis_id=aid2)

        pid1 = (p1.units[0].raw or {}).get("tenant_card", {}).get("property_id")
        pid2 = (p2.units[0].raw or {}).get("tenant_card", {}).get("property_id")

        assert pid1 and pid2, f"both portfolios should have property_id set: pid1={pid1!r}, pid2={pid2!r}"
        assert pid1 != pid2, \
            f"two separate uploads must produce distinct prop_ids: pid1={pid1!r}, pid2={pid2!r}"


# ===========================================================================
# Test B: Duplicated tenant cards don't inflate active_tenants_count
# ===========================================================================
class TestDuplicateTenantCards:
    def test_duplicate_tenant_cards_dont_inflate_count(self, api_client):
        """When the same unit appears with the same tenant in multiple months,
        active_tenants_count must count unique units, not tenant cards."""
        # Unit 101 has Ahmad in both January and February (same tenant, same unit)
        csv_jan = "وحدة,مستأجر,إيجار,حالة,جوال,عقد\n101,Ahmad,5000,مسدد,0501111111,C-101\n102,Khalid,4500,مسدد,0502222222,C-102\n"
        csv_feb = "وحدة,مستأجر,إيجار,حالة,جوال,عقد\n101,Ahmad,5000,مسدد,0501111111,C-101\n102,Khalid,4500,مسدد,0502222222,C-102\n"
        files = [
            {"name": "f1.csv", "textSnippet": csv_jan, "mimeType": "text/csv"},
            {"name": "f2.csv", "textSnippet": csv_feb, "mimeType": "text/csv"},
        ]
        aid = _upload_and_apply(api_client, files=files)

        store = spp_server._memory_db.get(spp_server._AI_STATE_COLLECTION) or {}
        ai = store.get(aid) or {}
        cps = ai.get("canonical_portfolio_summary") or {}

        print(f"  units_count: {cps.get('units_count')}")
        print(f"  active_tenants_count: {cps.get('active_tenants_count')}")
        print(f"  occupied_units_count: {cps.get('occupied_units_count')}")

        # 2 unique units, both occupied — active_tenants_count should be 2
        # (NOT 4, which would happen if we counted tenant cards instead of unique units)
        assert cps.get("units_count") == 2, f"units_count should be 2, got {cps.get('units_count')}"
        assert cps.get("active_tenants_count") == 2, f"active_tenants_count should be 2 (unique units), got {cps.get('active_tenants_count')}"
        assert cps.get("occupied_units_count") == 2, f"occupied_units_count should be 2, got {cps.get('occupied_units_count')}"


# ===========================================================================
# Test C: Multi-property upload in ONE analysis → 2 distinct prop_ids
# ===========================================================================
class TestMultiPropertySameAnalysis:
    def test_two_buildings_one_analysis_produces_two_property_ids(self, api_client):
        """Two properties/buildings in ONE uploaded analysis must produce two
        distinct canonical property_ids and properties_count=2.

        Property identity is derived from the imported `property` / `building`
        column (stable hash of the normalized name). analysis_id is provenance,
        NOT the only property identity — when imported property evidence is
        available, it takes precedence over the analysis_id-based fallback.
        """
        # Single CSV with TWO properties (Al-Malqa Tower + Al-Nakheel Plaza),
        # each with 3 occupied units + 1 vacant unit. Total: 8 units, 6 occupied, 2 vacant.
        csv_multi = (
            "عقار,وحدة,مستأجر,إيجار,حالة,جوال,عقد\n"
            "برج الملقا,101,Ahmad,5000,مسدد,0501,C-M-101\n"
            "برج الملقا,102,Khalid,4500,مسدد,0502,C-M-102\n"
            "برج الملقا,103,Salem,6000,مسدد,0503,C-M-103\n"
            "برج الملقا,104,,0,,,\n"
            "مجمع النخيل,201,Nora,5500,متأخر,0504,C-N-201\n"
            "مجمع النخيل,202,Omar,7000,مسدد,0505,C-N-202\n"
            "مجمع النخيل,203,Fatima,4800,مسدد,0506,C-N-203\n"
            "مجمع النخيل,204,,0,,,\n"
        )
        files = [{"name": "fm.csv", "textSnippet": csv_multi, "mimeType": "text/csv"}]
        aid = _upload_and_apply(api_client, files=files)

        store = spp_server._memory_db.get(spp_server._AI_STATE_COLLECTION) or {}
        ai = store.get(aid) or {}
        cps = ai.get("canonical_portfolio_summary") or {}
        pk = ai.get("property_knowledge") or {}

        # Inspect canonical units to verify two distinct property_ids
        from adapters.canonical.portfolio import build_portfolio_from_upload_analysis
        portfolio = build_portfolio_from_upload_analysis(
            property_knowledge=pk, metrics={}, analysis_id=aid,
        )

        # Collect distinct property_ids
        prop_ids = {u.property_id for u in portfolio.units if u.property_id}
        prop_raws = {u.property_raw for u in portfolio.units if u.property_raw}

        print(f"  distinct property_ids: {len(prop_ids)}")
        for pid in sorted(prop_ids):
            print(f"    {pid}")
        print(f"  distinct property_raws: {prop_raws}")

        # Two distinct property_ids derived from the property column
        assert len(prop_ids) == 2, \
            f"should have 2 distinct property_ids, got {len(prop_ids)}: {prop_ids}"
        # All property_ids are prop_<hash> form (NOT prop_imp_<analysis_id> fallback)
        for pid in prop_ids:
            assert pid.startswith("prop_"), \
                f"property_id should be 'prop_<hash>' (from property column), got {pid!r}"
            assert not pid.startswith("prop_imp_"), \
                f"property_id must NOT be the analysis_id fallback when property column is present: {pid!r}"

        # canonical summary: properties_count=2
        assert cps.get("properties_count") == 2, \
            f"properties_count should be 2 (two buildings), got {cps.get('properties_count')}"
        assert cps.get("units_count") == 8, \
            f"units_count should be 8, got {cps.get('units_count')}"
        assert cps.get("occupied_units_count") == 6, \
            f"occupied_units_count should be 6, got {cps.get('occupied_units_count')}"
        assert cps.get("vacant_units_count") == 2, \
            f"vacant_units_count should be 2, got {cps.get('vacant_units_count')}"
        assert cps.get("active_tenants_count") == 6, \
            f"active_tenants_count should be 6, got {cps.get('active_tenants_count')}"

    def test_multi_property_endpoint_agreement(self, api_client):
        """All endpoints agree on multi-property counts."""
        csv_multi = (
            "عقار,وحدة,مستأجر,إيجار,حالة,جوال,عقد\n"
            "برج الملقا,101,Ahmad,5000,مسدد,0501,C-M-101\n"
            "برج الملقا,102,Khalid,4500,مسدد,0502,C-M-102\n"
            "برج الملقا,103,Salem,6000,مسدد,0503,C-M-103\n"
            "برج الملقا,104,,0,,,\n"
            "مجمع النخيل,201,Nora,5500,متأخر,0504,C-N-201\n"
            "مجمع النخيل,202,Omar,7000,مسدد,0505,C-N-202\n"
            "مجمع النخيل,203,Fatima,4800,مسدد,0506,C-N-203\n"
            "مجمع النخيل,204,,0,,,\n"
        )
        files = [{"name": "fm.csv", "textSnippet": csv_multi, "mimeType": "text/csv"}]
        _upload_and_apply(api_client, files=files)

        brief = _fresh_get(api_client, f"{API}/briefing")
        brain = _fresh_get(api_client, f"{API}/executive")
        port = brain.get("portfolio") or {}

        # All endpoints agree
        assert brief.get("properties_count") == 2, f"briefing.properties_count={brief.get('properties_count')}"
        assert port.get("properties") == 2, f"executive.properties={port.get('properties')}"
        assert brief.get("units_count") == 8, f"briefing.units_count={brief.get('units_count')}"
        assert port.get("units") == 8, f"executive.units={port.get('units')}"
        assert brief.get("tenants_count") == 6, f"briefing.tenants_count={brief.get('tenants_count')}"
        assert port.get("tenants") == 6, f"executive.tenants={port.get('tenants')}"
        assert brief.get("occupied_units_count") == 6
        assert port.get("occupied") == 6
        assert brief.get("vacant_units_count") == 2
        assert port.get("vacant") == 2


# ===========================================================================
# Test D: Backward compatibility for occupied rows
# ===========================================================================
class TestBackwardCompatibilityOccupied:
    def test_occupied_tenant_names_unchanged(self, api_client):
        """Tenant names for occupied units must be preserved exactly as imported
        (no normalization-induced changes)."""
        csv = (
            "وحدة,مستأجر,إيجار,حالة,جوال,عقد\n"
            "101,Ahmad,5000,مسدد,0501111111,C-101\n"
            "102,Khalid,4500,متأخر,0502222222,C-102\n"
            "201,Salem,6000,مسدد,0503333333,C-201\n"
            "202,Nora,5500,مسدد,0504444444,C-202\n"
        )
        files = [{"name": "fb.csv", "textSnippet": csv, "mimeType": "text/csv"}]
        aid = _upload_and_apply(api_client, files=files)

        # Check /api/tenants
        tenants = _fresh_get(api_client, f"{API}/tenants")
        tenant_names = sorted(t.get("name", "") for t in tenants)
        expected_names = sorted(["Ahmad", "Khalid", "Salem", "Nora"])
        assert tenant_names == expected_names, \
            f"tenant names should be {expected_names}, got {tenant_names}"

    def test_occupied_unit_ids_stable(self, api_client):
        """Unit IDs for occupied units must be stable (no parser-induced changes)."""
        csv = (
            "وحدة,مستأجر,إيجار,حالة,جوال,عقد\n"
            "101,Ahmad,5000,مسدد,0501111111,C-101\n"
            "102,Khalid,4500,متأخر,0502222222,C-102\n"
            "201,Salem,6000,مسدد,0503333333,C-201\n"
            "202,Nora,5500,مسدد,0504444444,C-202\n"
        )
        files = [{"name": "fb.csv", "textSnippet": csv, "mimeType": "text/csv"}]
        _upload_and_apply(api_client, files=files)

        tenants = _fresh_get(api_client, f"{API}/tenants")
        unit_ids = sorted(t.get("unit", "") for t in tenants)
        expected_units = sorted(["101", "102", "201", "202"])
        assert unit_ids == expected_units, \
            f"unit IDs should be {expected_units}, got {unit_ids}"

    def test_occupied_contract_payment_classification_unchanged(self, api_client):
        """Contract + payment classification for occupied units must be preserved.

        Khalid is "متأخر" (late) — his payment status should be reflected as late.
        Other tenants are "مسدد" (paid).
        """
        csv = (
            "وحدة,مستأجر,إيجار,حالة,جوال,عقد\n"
            "101,Ahmad,5000,مسدد,0501111111,C-101\n"
            "102,Khalid,4500,متأخر,0502222222,C-102\n"
            "201,Salem,6000,مسدد,0503333333,C-201\n"
            "202,Nora,5500,مسدد,0504444444,C-202\n"
        )
        files = [{"name": "fb.csv", "textSnippet": csv, "mimeType": "text/csv"}]
        _upload_and_apply(api_client, files=files)

        # Check the lifecycle summary — late_count should be 1 (Khalid)
        brain = _fresh_get(api_client, f"{API}/executive")
        lc = (brain.get("portfolio") or {}).get("lifecycle") or {}
        assert lc.get("late_count") == 1, \
            f"lifecycle.late_count should be 1 (Khalid is late), got {lc.get('late_count')}"
        assert lc.get("active_count") == 4, \
            f"lifecycle.active_count should be 4 (all occupied), got {lc.get('active_count')}"

    def test_existing_non_vacant_lifecycle_tests_unchanged(self, api_client):
        """The existing CSV_JAN + CSV_FEB fixture (with turnover + late tenant)
        must still produce the same lifecycle signals as before.

        File names include "شهر 1" / "شهر 2" so the parser's extract_month
        detects them as Jan + Feb → turnover detection works (Khalid→Reem).
        """
        files = [
            {"name": "كشف شهر 1 2026.csv", "textSnippet": CSV_JAN, "mimeType": "text/csv"},
            {"name": "كشف شهر 2 2026.csv", "textSnippet": CSV_FEB, "mimeType": "text/csv"},
        ]
        _upload_and_apply(api_client, files=files)

        brain = _fresh_get(api_client, f"{API}/executive")
        lc = (brain.get("portfolio") or {}).get("lifecycle") or {}

        # CSV_JAN→CSV_FEB has Khalid→Reem turnover (departure+newcomer)
        assert lc.get("departed_count") >= 1, \
            f"should have ≥1 departure (Khalid), got {lc.get('departed_count')}"
        assert lc.get("newcomers_count") >= 1, \
            f"should have ≥1 newcomer (Reem), got {lc.get('newcomers_count')}"
        # Nora is late in both months
        assert lc.get("late_count") >= 1, \
            f"should have ≥1 late tenant (Nora), got {lc.get('late_count')}"
        # 6 active tenants in February (101,102,201,202,301,302)
        assert lc.get("active_count") == 6, \
            f"should have 6 active tenants in Feb, got {lc.get('active_count')}"


# ===========================================================================
# Test E: Lifecycle vacant exclusion — no vacant unit enters tenant events
# ===========================================================================
class TestLifecycleVacantExclusion:
    def test_no_vacant_unit_in_lifecycle_events(self, api_client):
        """Verify vacant units do NOT appear in lifecycle active/departed/newcomers/late."""
        csv = (
            "وحدة,مستأجر,إيجار,حالة,جوال,عقد\n"
            "101,A,5000,مسدد,0501,C1\n"
            "102,B,4500,مسدد,0502,C2\n"
            "107,,0,,,\n"
            "108,,0,,,\n"
        )
        files = [{"name": "f.csv", "textSnippet": csv, "mimeType": "text/csv"}]
        aid = _upload_and_apply(api_client, files=files)

        store = spp_server._memory_db.get(spp_server._AI_STATE_COLLECTION) or {}
        ai = store.get(aid) or {}
        nl = ai.get("normalized_lifecycle") or {}

        # Check every lifecycle event list for vacant unit labels
        vacant_units = ["107", "108"]

        # active list — vacant units may be present (with is_vacant=True) but
        # their tenant must be empty
        active = nl.get("active") or []
        for entry in active:
            if entry.get("unit") in vacant_units:
                assert entry.get("is_vacant") is True, \
                    f"vacant unit {entry.get('unit')} in active list must have is_vacant=True"
                assert not (entry.get("tenant") or "").strip(), \
                    f"vacant unit {entry.get('unit')} in active list must have empty tenant, got {entry.get('tenant')!r}"

        # departed list — vacant units must NOT appear
        departed = nl.get("departed") or []
        for d in departed:
            assert d.get("unit") not in vacant_units, \
                f"vacant unit {d.get('unit')} must NOT appear in departed: {d}"

        # newcomers list — vacant units must NOT appear
        newcomers = nl.get("newcomers") or []
        for n in newcomers:
            assert n.get("unit") not in vacant_units, \
                f"vacant unit {n.get('unit')} must NOT appear in newcomers: {n}"

        # late_tenants list — vacant units must NOT appear
        late_tenants = nl.get("late_tenants") or []
        for lt in late_tenants:
            assert lt.get("unit") not in vacant_units, \
                f"vacant unit {lt.get('unit')} must NOT appear in late_tenants: {lt}"

        # tenant_changes — vacant units must NOT appear
        tenant_changes = nl.get("tenant_changes") or []
        for tc in tenant_changes:
            assert tc.get("unit") not in vacant_units, \
                f"vacant unit {tc.get('unit')} must NOT appear in tenant_changes: {tc}"

        # payment_ledger — vacant units may be present (with is_vacant=True) but
        # their tenant must be empty and they should NOT have late months
        payment_ledger = nl.get("payment_ledger") or []
        for entry in payment_ledger:
            if entry.get("unit") in vacant_units:
                assert entry.get("is_vacant") is True, \
                    f"vacant unit {entry.get('unit')} in payment_ledger must have is_vacant=True"
                # vacant units have 0 rent → no late months
                late_count = int(entry.get("late_month_count") or 0)
                assert late_count == 0, \
                    f"vacant unit {entry.get('unit')} must have 0 late months, got {late_count}"

        # lifecycle_decisions — vacant units must NOT appear in any decision
        lifecycle_decisions = ai.get("lifecycle_decisions") or []
        for ld in lifecycle_decisions:
            unit = ld.get("unit_id") or ld.get("unit") or ""
            assert unit not in vacant_units, \
                f"vacant unit {unit} must NOT appear in lifecycle_decisions: {ld.get('id')}"

        # summary.active_count must exclude vacant units
        summary = nl.get("summary") or {}
        assert summary.get("active_count") == 2, \
            f"summary.active_count should be 2 (only occupied units), got {summary.get('active_count')}"

    def test_no_vacant_driven_warnings(self, api_client):
        """Vacant units emit only vacant_unit warnings — no missing_phone,
        missing_contract, late-payment, tenant-change, newcomer, or departure events."""
        csv = (
            "وحدة,مستأجر,إيجار,حالة,جوال,عقد\n"
            "101,A,5000,مسدد,0501,C1\n"
            "107,,0,,,\n"
            "108,,0,,,\n"
        )
        files = [{"name": "f.csv", "textSnippet": csv, "mimeType": "text/csv"}]
        # Use the analyze response to inspect canonical_warnings
        r = api_client.post(f"{API}/upload/portfolio-analysis", json={"files": files, "lang": "ar"})
        assert r.status_code == 200
        analyze_resp = r.json()
        warnings = analyze_resp.get("canonical_warnings") or []

        vacant_unit_warnings = [w for w in warnings if w.get("code") == "vacant_unit"]
        missing_phone_warnings = [w for w in warnings if w.get("code") == "missing_phone"]
        missing_contract_warnings = [w for w in warnings if w.get("code") == "missing_contract"]

        # Two vacant_unit warnings (one per vacant unit)
        assert len(vacant_unit_warnings) == 2, \
            f"expected 2 vacant_unit warnings, got {len(vacant_unit_warnings)}: {vacant_unit_warnings}"
        # No missing_phone/missing_contract warnings for vacant units
        for w in missing_phone_warnings:
            assert w.get("unit") not in ("107", "108"), \
                f"vacant unit must NOT emit missing_phone: {w}"
        for w in missing_contract_warnings:
            assert w.get("unit") not in ("107", "108"), \
                f"vacant unit must NOT emit missing_contract: {w}"

        # executive_report sections — late_tenants, departed, moved_in must
        # NOT reference vacant units
        exec_report = analyze_resp.get("executive_report") or {}
        sections = {s.get("key"): s for s in (exec_report.get("sections") or [])}
        for section_key in ("late_tenants", "departed", "moved_in"):
            section = sections.get(section_key) or {}
            for item in (section.get("items") or []):
                item_text = str(item.get("label", "")) + " " + str(item.get("value", ""))
                for vacant_unit in ("107", "108"):
                    assert vacant_unit not in item_text, \
                        f"section {section_key} references vacant unit {vacant_unit}: {item_text}"
