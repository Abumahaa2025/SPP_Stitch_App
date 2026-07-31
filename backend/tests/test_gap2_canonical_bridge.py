"""Gap 2 — Upload analysis → CanonicalPortfolio → Property Memory → Insights.

Verifies the full canonical bridge:
  Upload analysis → CanonicalPortfolio → build_memory_graph() →
  generate_insights() → persisted into ai_state → served by
  /api/portfolio-memory and /api/intelligence.

Covers requirements 11a-11j:
  a. Upload analysis creates a CanonicalPortfolio from imported data.
  b. Imported units preserve stable identities.
  c. Imported maintenance records appear in Property Memory.
  d. Repeat maintenance can produce repeat-repair intelligence.
  e. Warranty data can produce warranty-window intelligence when present.
  f. Unresolved imported records are preserved as warnings.
  g. Apply persists canonical and memory outputs.
  h. After cache clear, GET /api/portfolio-memory returns the imported memory state.
  i. After cache clear, GET /api/intelligence returns insights derived from the imported portfolio.
  j. Existing canonical pipeline tests remain unchanged and passing.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

# Configure before importing server — memory store needs beta mode without Mongo.
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
from adapters.canonical.ingest import (
    assets_from_maintenance_entries,
    life_events_from_maintenance_entries,
    unit_from_tenant_card,
    warnings_from_property_knowledge,
)
from adapters.canonical.pipeline import (
    portfolio_from_bundles,
    legacy_api_payload,
    memory_graph_to_dict,
    insights_to_api,
)
from adapters.canonical.portfolio import build_portfolio_from_upload_analysis
from adapters.portfolio_memory.graph import build_memory_graph
from adapters.executive_intelligence.engine import generate_insights
from adapters.upload_analysis.portfolio_engine import analyze_upload_portfolio

API = "/api"

# Two CSV months with one tenant change (Said → Reem on unit 102).
CSV1 = "وحدة,مستأجر,إيجار,حالة\n101,أحمد العتيبي,5500,مسدد\n102,سعد القحطاني,4800,مسدد\n"
CSV2 = "وحدة,مستأجر,إيجار,حالة\n101,أحمد العتيبي,5500,مسدد\n102,ريم الشمري,5000,متأخر\n"


def _two_month_files():
    return [
        {"name": "كشف_شهر_1_2026.csv", "textSnippet": CSV1, "mimeType": "text/csv"},
        {"name": "كشف_شهر_2_2026.csv", "textSnippet": CSV2, "mimeType": "text/csv"},
    ]


def _property_knowledge_with_maintenance(*, repeat_count: int = 0, with_warranty: bool = False):
    """Build a property_knowledge dict with optional maintenance entries.

    When repeat_count >= 3, produces 3+ maintenance entries on the same
    (unit, description) so the repeat_repair insight can fire.

    When with_warranty=True, adds warranty_end to one asset so the
    warranty_window insight can fire.
    """
    entries = []
    for i in range(repeat_count):
        entry = {
            "description": "تكييف",
            "unit": "101",
            "amount": 500 + i * 100,
            "status": "open",
            "request_id": f"r{i + 1}",
            "file_name": f"كشف شهر {i + 1} 2026.csv",
        }
        if with_warranty and i == 0:
            # Warranty ending in 15 days from now.
            from datetime import date, timedelta
            entry["warranty_end"] = (date.today() + timedelta(days=15)).isoformat()
        entries.append(entry)
    return {
        "meta": {
            "source": "python",
            "batch_id": "test-batch",
            "lang": "ar",
            "month_count": 2,
            "period_from": "يناير",
            "period_to": "فبراير",
            "files_count": 2,
        },
        "units": {"total": 2, "residential": 2, "commercial": 0, "active_count": 2, "needs_review_count": 0},
        "collection": {"by_month": [], "total_expected": 10000, "total_collected": 9500, "total_unpaid": 500},
        "late": {"tenant_count": 1, "tenants": [], "total_unpaid": 500},
        "lifecycle": {
            "departed_count": 0,
            "newcomers_count": 0,
            "tenant_changes": [],
            "departed": [],
            "newcomers": [],
            "active": [],
        },
        "contracts": {"missing_phone": [], "missing_contract": []},
        "quality": {"warnings": [], "parse_errors": [], "files_without_content": [], "merge_count": 0},
        "maintenance": {
            "entries": entries,
            "total": sum(e["amount"] for e in entries),
            "count": len(entries),
        },
        "files": [],
        "tenants": [
            {
                "tenant": "أحمد العتيبي",
                "unit": "101",
                "phone": "0501111111",
                "contract": "C-101",
                "rent": 5500,
                "confirmed_arrears": 0,
                "months": [],
            },
            {
                "tenant": "ريم الشمري",
                "unit": "102",
                "phone": "0502222222",
                "contract": "C-102",
                "rent": 5000,
                "confirmed_arrears": 500,
                "months": [],
            },
        ],
        "ledger_quality": {
            "total_month_rows": 4,
            "unknown_month_count": 0,
            "vacated_month_count": 0,
            "confirmed_late_month_count": 1,
            "paid_month_count": 3,
            "collection_recs_allowed": True,
            "ledger_trust": "ok",
        },
    }


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


# ===========================================================================
# 11a. Upload analysis creates a CanonicalPortfolio from imported data
# ===========================================================================
class TestUploadCreatesCanonicalPortfolio:
    def test_analyze_upload_returns_canonical_outputs(self):
        """The upload analysis response must include the 4 canonical fields."""
        files = _two_month_files()
        ctx = {"settings": {}, "properties": [], "tenants": [], "contracts": [], "decisions": [], "reports": []}
        out = analyze_upload_portfolio(files, ctx, lang="ar")

        # 4 new Gap 2 keys must be present
        assert "canonical_portfolio_summary" in out
        assert "property_memory" in out
        assert "executive_intelligence" in out
        assert "canonical_warnings" in out

        # All existing keys must still be present (backward compat)
        for key in (
            "analysis_id", "success_message", "metrics", "summary",
            "executive_brief", "executive_report", "late_payments",
            "property_knowledge", "koil_understanding", "koil_reasoning",
            "consistency_gate", "month_comparison", "smart_decisions",
            "next_actions", "linked_files", "intake_meta",
        ):
            assert key in out, f"existing key missing: {key}"

    def test_canonical_portfolio_summary_shape(self):
        """canonical_portfolio_summary must have the documented shape."""
        files = _two_month_files()
        ctx = {"settings": {}, "properties": [], "tenants": [], "contracts": [], "decisions": [], "reports": []}
        out = analyze_upload_portfolio(files, ctx, lang="ar")
        summary = out["canonical_portfolio_summary"]

        for key in (
            "version", "source", "analysis_id", "units_count",
            "assets_count", "life_events_count", "maintenance_count",
            "ingest_sources", "settings", "error",
        ):
            assert key in summary, f"summary missing key: {key}"

        assert summary["version"] == "canonical-v1"
        assert summary["source"] == "upload_analysis"
        assert summary["analysis_id"] == out["analysis_id"]
        assert summary["ingest_sources"] == ["upload_analysis"]
        assert summary["error"] is None
        # The CSV has 2 units (101, 102) → 2 tenant cards → 2 CanonicalUnits
        assert summary["units_count"] >= 2
        # Settings must include currency + portfolio_name
        assert "currency" in summary["settings"]
        assert "portfolio_name" in summary["settings"]

    def test_build_portfolio_from_upload_analysis_directly(self):
        """The bridge function builds a CanonicalPortfolio directly from PK."""
        pk = _property_knowledge_with_maintenance(repeat_count=0)
        portfolio = build_portfolio_from_upload_analysis(
            property_knowledge=pk,
            metrics={"units": 2},
            analysis_id="test-direct",
        )
        # Must be a CanonicalPortfolio with 2 units + 0 assets (no maintenance)
        assert len(portfolio.units) == 2
        assert len(portfolio.assets) == 0
        assert len(portfolio.life_events) == 0
        assert len(portfolio.maintenance) == 0
        assert portfolio.ingest_sources == ["upload_analysis"]
        assert portfolio.settings.currency == "SAR"
        assert portfolio.settings.portfolio_name == "Imported Portfolio"


# ===========================================================================
# 11b. Imported units preserve stable identities
# ===========================================================================
class TestImportedUnitsStableIdentities:
    def test_unit_from_tenant_card_has_stable_id(self):
        """Same unit label → same unit_id, regardless of tenant card source."""
        card_a = {"unit": "101", "tenant": "أحمد", "rent": 5000, "contract": "C1"}
        card_b = {"unit": "101", "tenant": "سعد", "rent": 4500, "contract": "C2"}
        u_a = unit_from_tenant_card(card_a, analysis_id="t1")
        u_b = unit_from_tenant_card(card_b, analysis_id="t2")
        # Same unit label → same unit_id (stable identity)
        assert u_a.unit_id == u_b.unit_id
        # But different tenants
        assert u_a.tenant_name == "أحمد"
        assert u_b.tenant_name == "سعد"

    def test_unit_id_matches_normalize_utilities(self):
        """unit_id from upload must match what normalize utilities produce."""
        from adapters.normalize.text import normalize_unit_label, stable_id
        card = {"unit": "Flat 2A", "tenant": "Jane", "rent": 1250}
        u = unit_from_tenant_card(card, analysis_id="t")
        expected_id = stable_id(normalize_unit_label("Flat 2A"), prefix="unit")
        assert u.unit_id == expected_id

    def test_tenant_card_provenance_preserved(self):
        """analysis_id + source must be in unit.raw for provenance."""
        card = {"unit": "101", "tenant": "أحمد", "rent": 5000, "contract": "C1", "confirmed_arrears": 500}
        u = unit_from_tenant_card(card, analysis_id="aid-123")
        assert u.raw["analysis_id"] == "aid-123"
        assert u.raw["source"] == "property_knowledge.tenant_cards"
        assert u.raw["tenant_card"] == card

    def test_arrears_marked_late(self):
        """confirmed_arrears > 0 → payment_status = 'late'."""
        card = {"unit": "101", "tenant": "أحمد", "rent": 5000, "confirmed_arrears": 500}
        u = unit_from_tenant_card(card, analysis_id="t")
        assert u.payment_status == "late"

    def test_contract_no_preserved(self):
        """tenant_card.contract → CanonicalUnit.contract_no."""
        card = {"unit": "101", "tenant": "أحمد", "rent": 5000, "contract": "C-2024-001"}
        u = unit_from_tenant_card(card, analysis_id="t")
        assert u.contract_no == "C-2024-001"


# ===========================================================================
# 11c. Imported maintenance records appear in Property Memory
# ===========================================================================
class TestMaintenanceInPropertyMemory:
    def test_maintenance_entries_become_assets(self):
        """Maintenance entries grouped by (unit, description) → CanonicalAsset."""
        entries = [
            {"description": "تكييف", "unit": "101", "amount": 500, "status": "open"},
            {"description": "تكييف", "unit": "101", "amount": 700, "status": "open"},
            {"description": "سباكة", "unit": "102", "amount": 200, "status": "open"},
        ]
        assets = assets_from_maintenance_entries(entries, analysis_id="t")
        # 2 unique (unit, description) pairs → 2 assets
        assert len(assets) == 2
        # The "تكييف" asset on unit 101 has fault_count=2
        ac_asset = next(a for a in assets if "تكييف" in a.name)
        assert ac_asset.fault_count == 2
        # NOTE: asset.total_cost is 0 by design (avoids double-counting in
        # build_memory_graph). The real cost is in raw["entries_total_cost"].
        assert ac_asset.total_cost == 0.0
        assert ac_asset.raw["entries_total_cost"] == 1200.0
        assert ac_asset.asset_type == "other"

    def test_maintenance_appears_in_memory_graph(self):
        """build_memory_graph() includes imported maintenance as asset profiles."""
        pk = _property_knowledge_with_maintenance(repeat_count=3)
        portfolio = build_portfolio_from_upload_analysis(
            property_knowledge=pk, metrics={"units": 2}, analysis_id="t",
        )
        graph = build_memory_graph(portfolio)
        # Must have at least 1 asset profile (the "تكييف" group on unit 101)
        assert len(graph.profiles) >= 1
        # Find the AC asset profile
        ac_profile = next(p for p in graph.profiles if "تكييف" in p.asset.name)
        assert ac_profile.fault_count == 3
        assert ac_profile.total_cost == 1800.0  # 500 + 600 + 700
        assert ac_profile.risk in ("low", "medium", "high", "critical")

    def test_maintenance_life_events_created(self):
        """Each maintenance entry → one CanonicalLifeEvent of type 'maintenance'."""
        entries = [
            {"description": "تكييف", "unit": "101", "amount": 500, "status": "open", "file_name": "f1.csv"},
            {"description": "تكييف", "unit": "101", "amount": 700, "status": "open", "file_name": "f2.csv"},
        ]
        assets = assets_from_maintenance_entries(entries, analysis_id="t")
        events = life_events_from_maintenance_entries(entries, assets, analysis_id="t")
        assert len(events) == 2
        assert all(e.event_type == "maintenance" for e in events)
        assert all(e.cost > 0 for e in events)


# ===========================================================================
# 11d. Repeat maintenance can produce repeat-repair intelligence
# ===========================================================================
class TestRepeatRepairIntelligence:
    def test_repeat_repair_insight_fires(self):
        """3+ maintenance entries on same (unit, description) → repeat_repair insight."""
        pk = _property_knowledge_with_maintenance(repeat_count=4)
        portfolio = build_portfolio_from_upload_analysis(
            property_knowledge=pk, metrics={"units": 2}, analysis_id="t",
        )
        memory = build_memory_graph(portfolio)
        insights = generate_insights(portfolio, memory)
        scenarios = {i.scenario for i in insights}
        assert "repeat_repair" in scenarios, (
            f"repeat_repair insight should fire with 4 faults on same asset, "
            f"got scenarios: {scenarios}"
        )
        # Verify the insight references the right asset
        rr = next(i for i in insights if i.scenario == "repeat_repair")
        assert rr.confidence >= 80  # 60 + fault_count * 8 = 60 + 32 = 92, capped at 92
        assert "تكييف" in rr.headline or "تكييف" in str(rr.memory_refs)

    def test_no_repeat_repair_below_threshold(self):
        """< 3 entries on same asset → no repeat_repair insight."""
        pk = _property_knowledge_with_maintenance(repeat_count=2)
        portfolio = build_portfolio_from_upload_analysis(
            property_knowledge=pk, metrics={"units": 2}, analysis_id="t",
        )
        memory = build_memory_graph(portfolio)
        insights = generate_insights(portfolio, memory)
        scenarios = {i.scenario for i in insights}
        # 2 faults < 3 threshold → no repeat_repair
        assert "repeat_repair" not in scenarios


# ===========================================================================
# 11e. Warranty data can produce warranty-window intelligence when present
# ===========================================================================
class TestWarrantyWindowIntelligence:
    def test_warranty_window_insight_fires(self):
        """Asset with warranty_end within 30 days → warranty_window insight."""
        pk = _property_knowledge_with_maintenance(repeat_count=1, with_warranty=True)
        portfolio = build_portfolio_from_upload_analysis(
            property_knowledge=pk, metrics={"units": 2}, analysis_id="t",
        )
        # Verify the asset has warranty_end set
        assert len(portfolio.assets) == 1
        assert portfolio.assets[0].warranty_end is not None

        memory = build_memory_graph(portfolio)
        insights = generate_insights(portfolio, memory)
        scenarios = {i.scenario for i in insights}
        assert "warranty_window" in scenarios, (
            f"warranty_window insight should fire when warranty_end is within 30 days, "
            f"got scenarios: {scenarios}"
        )

    def test_no_warranty_insight_when_absent(self):
        """No warranty_end → no warranty_window insight."""
        pk = _property_knowledge_with_maintenance(repeat_count=1, with_warranty=False)
        portfolio = build_portfolio_from_upload_analysis(
            property_knowledge=pk, metrics={"units": 2}, analysis_id="t",
        )
        memory = build_memory_graph(portfolio)
        insights = generate_insights(portfolio, memory)
        scenarios = {i.scenario for i in insights}
        assert "warranty_window" not in scenarios


# ===========================================================================
# 11f. Unresolved imported records are preserved as warnings
# ===========================================================================
class TestUnresolvedRecordsAsWarnings:
    def test_missing_phone_surfaces_as_warning(self):
        """tenant with missing phone → canonical_warnings entry."""
        pk = _property_knowledge_with_maintenance(repeat_count=0)
        pk["contracts"]["missing_phone"] = [
            {"unit": "101", "tenant": "أحمد"},
        ]
        warnings = warnings_from_property_knowledge(pk)
        phone_warnings = [w for w in warnings if w["code"] == "missing_phone"]
        assert len(phone_warnings) == 1
        assert phone_warnings[0]["unit"] == "101"
        assert phone_warnings[0]["tenant"] == "أحمد"

    def test_missing_contract_surfaces_as_warning(self):
        """tenant with missing contract → canonical_warnings entry."""
        pk = _property_knowledge_with_maintenance(repeat_count=0)
        pk["contracts"]["missing_contract"] = [
            {"unit": "102", "tenant": "ريم"},
        ]
        warnings = warnings_from_property_knowledge(pk)
        contract_warnings = [w for w in warnings if w["code"] == "missing_contract"]
        assert len(contract_warnings) == 1

    def test_parse_errors_surface_as_warnings(self):
        """parse_errors in quality → canonical_warnings entries."""
        pk = _property_knowledge_with_maintenance(repeat_count=0)
        pk["quality"]["parse_errors"] = [
            {"file_name": "broken.csv", "error": "invalid CSV"},
        ]
        warnings = warnings_from_property_knowledge(pk)
        pe_warnings = [w for w in warnings if w["code"] == "parse_error"]
        assert len(pe_warnings) == 1
        assert pe_warnings[0]["file"] == "broken.csv"

    def test_files_without_content_surface_as_warnings(self):
        """files_without_content → canonical_warnings entries."""
        pk = _property_knowledge_with_maintenance(repeat_count=0)
        pk["quality"]["files_without_content"] = [
            {"file_name": "empty.xlsx", "reason": "no content"},
        ]
        warnings = warnings_from_property_knowledge(pk)
        fw_warnings = [w for w in warnings if w["code"] == "file_without_content"]
        assert len(fw_warnings) == 1

    def test_upload_response_includes_warnings(self):
        """The upload analysis response surfaces canonical_warnings."""
        files = _two_month_files()
        ctx = {"settings": {}, "properties": [], "tenants": [], "contracts": [], "decisions": [], "reports": []}
        out = analyze_upload_portfolio(files, ctx, lang="ar")
        # The CSVs have no phones → missing_phone warnings should appear
        assert isinstance(out["canonical_warnings"], list)
        # Each warning must have at least a "code" key
        for w in out["canonical_warnings"]:
            assert "code" in w


# ===========================================================================
# 11g. Apply persists canonical and memory outputs
# ===========================================================================
class TestApplyPersistsCanonicalOutputs:
    def _upload_and_apply(self, client):
        r = client.post(
            f"{API}/upload/portfolio-analysis",
            json={"files": _two_month_files(), "lang": "ar"},
        )
        assert r.status_code == 200
        analysis_id = r.json()["analysis_id"]
        r2 = client.post(
            f"{API}/upload/apply-analysis",
            json={"analysis_id": analysis_id, "files": _two_month_files()},
        )
        assert r2.status_code == 200
        return analysis_id, r2.json()

    def test_ai_state_contains_canonical_outputs(self, api_client):
        """After Apply, ai_state must include the 4 canonical fields."""
        aid, apply_resp = self._upload_and_apply(api_client)
        assert apply_resp["ai_state_persisted"] is True

        store = spp_server._memory_db.get(spp_server._AI_STATE_COLLECTION) or {}
        ai_state = store[aid]
        for key in (
            "canonical_portfolio_summary",
            "property_memory",
            "executive_intelligence",
            "canonical_warnings",
        ):
            assert key in ai_state, f"ai_state missing {key}"

        # Verify the canonical_portfolio_summary has the right analysis_id
        assert ai_state["canonical_portfolio_summary"]["analysis_id"] == aid
        # property_memory must have a summary + assets list
        assert "summary" in ai_state["property_memory"]
        assert "assets" in ai_state["property_memory"]
        # executive_intelligence must have insights + count
        assert "insights" in ai_state["executive_intelligence"]
        assert "count" in ai_state["executive_intelligence"]


# ===========================================================================
# 11h. After cache clear, GET /api/portfolio-memory returns imported memory
# ===========================================================================
class TestPortfolioMemoryServesPersistedState:
    def test_portfolio_memory_uses_persisted_state(self, api_client):
        """After Apply + cache clear, /api/portfolio-memory serves the
        persisted property_memory, not a rebuild from demo/GAS data.
        """
        # Upload + Apply
        aid, _ = (
            # Inline the upload+apply to keep test self-contained
            (lambda: (
                api_client.post(f"{API}/upload/portfolio-analysis",
                                json={"files": _two_month_files(), "lang": "ar"}).json()["analysis_id"],
                api_client.post(f"{API}/upload/apply-analysis",
                                json={"analysis_id": "x", "files": _two_month_files()}).json()
            ))()
        ) if False else (None, None)  # placeholder to keep linter happy

        # Do it properly:
        r = api_client.post(
            f"{API}/upload/portfolio-analysis",
            json={"files": _two_month_files(), "lang": "ar"},
        )
        aid = r.json()["analysis_id"]
        r2 = api_client.post(
            f"{API}/upload/apply-analysis",
            json={"analysis_id": aid, "files": _two_month_files()},
        )
        assert r2.status_code == 200

        # Clear cache (simulates TTL expiry / fresh request)
        spp_server._portfolio_cache = None  # type: ignore[assignment]
        spp_server._portfolio_cache_at = 0.0  # type: ignore[assignment]

        # GET /api/portfolio-memory
        r3 = api_client.get(f"{API}/portfolio-memory")
        assert r3.status_code == 200
        data = r3.json()

        # Must serve the persisted state, not a rebuild
        assert data.get("_source") == "ai_state_persisted"
        assert data.get("_analysis_id") == aid
        # Must have summary + assets (matching the persisted shape)
        assert "summary" in data
        assert "assets" in data

    def test_portfolio_memory_falls_back_without_ai_state(self, api_client):
        """When no import has been applied, /api/portfolio-memory falls back
        to the legacy rebuild path (backward compat).
        """
        # Seed demo data so the legacy path has something to rebuild from
        spp_server._memory_insert_all(spp_server._seed_dataset())
        spp_server._portfolio_cache = None  # type: ignore[assignment]
        spp_server._portfolio_cache_at = 0.0  # type: ignore[assignment]

        r = api_client.get(f"{API}/portfolio-memory")
        assert r.status_code == 200
        data = r.json()
        # No ai_state → falls back to rebuild
        assert data.get("_source") == "canonical_rebuild"
        # Legacy shape must still be present
        assert "summary" in data
        assert "assets" in data


# ===========================================================================
# 11i. After cache clear, GET /api/intelligence returns imported insights
# ===========================================================================
class TestIntelligenceServesPersistedState:
    def test_intelligence_uses_persisted_state(self, api_client):
        """After Apply + cache clear, /api/intelligence serves the
        persisted executive_intelligence, not a rebuild.
        """
        # Upload + Apply
        r = api_client.post(
            f"{API}/upload/portfolio-analysis",
            json={"files": _two_month_files(), "lang": "ar"},
        )
        aid = r.json()["analysis_id"]
        r2 = api_client.post(
            f"{API}/upload/apply-analysis",
            json={"analysis_id": aid, "files": _two_month_files()},
        )
        assert r2.status_code == 200

        # Clear cache
        spp_server._portfolio_cache = None  # type: ignore[assignment]
        spp_server._portfolio_cache_at = 0.0  # type: ignore[assignment]

        # GET /api/intelligence
        r3 = api_client.get(f"{API}/intelligence")
        assert r3.status_code == 200
        data = r3.json()

        # Must serve persisted state
        assert data.get("_source") == "ai_state_persisted"
        assert data.get("_analysis_id") == aid
        # Shape must match legacy: insights[] + count
        assert "insights" in data
        assert "count" in data
        assert data["count"] == len(data["insights"])

    def test_intelligence_falls_back_without_ai_state(self, api_client):
        """When no import applied, /api/intelligence falls back to legacy path."""
        spp_server._memory_insert_all(spp_server._seed_dataset())
        spp_server._portfolio_cache = None  # type: ignore[assignment]
        spp_server._portfolio_cache_at = 0.0  # type: ignore[assignment]

        r = api_client.get(f"{API}/intelligence")
        assert r.status_code == 200
        data = r.json()
        # No ai_state → legacy path. Could be "canonical_rebuild" or "no_portfolio"
        assert data.get("_source") in ("canonical_rebuild", "no_portfolio")
        assert "insights" in data
        assert "count" in data


# ===========================================================================
# 11j. Existing canonical pipeline tests remain unchanged and passing
# ===========================================================================
class TestExistingCanonicalTestsUnchanged:
    """Smoke checks that the existing canonical API surface still works.

    The full regression is verified by running test_canonical_pipeline.py
    alongside this file. Here we just smoke-check that:
      - portfolio_from_bundles() still works
      - legacy_api_payload() still works
      - memory_graph_to_dict() still works
      - insights_to_api() still works
    """

    def test_portfolio_from_bundles_still_works(self):
        """The existing GAS-bundle entry point must work unchanged."""
        bundle = {
            "settings": {"portfolioName": "Test", "currency": "USD"},
            "dashboard": {
                "units": [
                    {"unit": "101", "tenant": "Alice", "rent": 1000, "status": "active"},
                ],
            },
        }
        portfolio = portfolio_from_bundles(dashboard=bundle)
        assert portfolio.settings.currency == "USD"
        assert len(portfolio.units) == 1
        assert portfolio.units[0].tenant_name == "Alice"

    def test_legacy_api_payload_still_works(self):
        """legacy_api_payload() must still produce the documented shape."""
        bundle = {
            "settings": {"portfolioName": "Test", "currency": "USD"},
            "dashboard": {
                "units": [
                    {"unit": "101", "tenant": "Alice", "rent": 1000, "status": "active"},
                ],
            },
        }
        portfolio = portfolio_from_bundles(dashboard=bundle)
        payload = legacy_api_payload(portfolio, base_health=80, merge_intelligence=True)
        for key in ("portfolio", "memory", "properties", "tenants", "contracts", "decisions"):
            assert key in payload

    def test_memory_graph_to_dict_still_works(self):
        """memory_graph_to_dict() must still produce the documented shape."""
        bundle = {
            "settings": {"portfolioName": "Test", "currency": "USD"},
            "dashboard": {"units": [{"unit": "101", "tenant": "Alice", "rent": 1000}]},
        }
        portfolio = portfolio_from_bundles(dashboard=bundle)
        graph = build_memory_graph(portfolio)
        d = memory_graph_to_dict(graph)
        assert "summary" in d
        assert "assets" in d

    def test_insights_to_api_still_works(self):
        """insights_to_api() must still produce the documented shape."""
        bundle = {
            "settings": {"portfolioName": "Test", "currency": "USD"},
            "dashboard": {"units": [{"unit": "101", "tenant": "Alice", "rent": 1000}]},
        }
        portfolio = portfolio_from_bundles(dashboard=bundle)
        memory = build_memory_graph(portfolio)
        insights = generate_insights(portfolio, memory)
        api_insights = insights_to_api(insights)
        assert isinstance(api_insights, list)
        for i in api_insights:
            for key in (
                "id", "scenario", "headline", "why", "action", "impact",
                "likely_outcome", "confidence", "priority", "route",
                "unit_id", "property_id",
            ):
                assert key in i
