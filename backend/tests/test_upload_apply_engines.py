"""Upload engines → executive brief.engines → local Apply materialisation.

Protects the non-UI engineering contract used by the current Expo client:
- analysis returns executive_brief.engines (additive)
- apply without GAS materialises Property Knowledge into portfolio rows
- existing portfolio-analysis / apply-analysis shapes stay compatible
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO))
sys.path.insert(0, str(REPO / "backend"))

os.environ.setdefault("SPP_BETA_MODE", "true")
os.environ.setdefault("SPP_DEMO_MODE", "true")
os.environ.pop("GAS_WEB_APP_URL", None)
os.environ.pop("GAS_DEPLOYMENT_URL", None)

import pytest
from fastapi.testclient import TestClient

from adapters.gas_import_bridge import (
    _import_sessions,
    analyze_upload_with_gas_fallback,
    build_local_apply_commit,
)
from adapters.upload_analysis.portfolio_engine import analyze_upload_portfolio
from beta_seed import beta_dataset
import server as spp_server

API = "/api"

CSV1 = "وحدة,مستأجر,إيجار,حالة\n101,أحمد العتيبي,5500,مسدد\n102,سعد القحطاني,4800,مسدد\n"
CSV2 = "وحدة,مستأجر,إيجار,حالة\n101,أحمد العتيبي,5500,مسدد\n102,ريم الشمري,5000,متأخر\n"


def _two_month_files():
    return [
        {"name": "كشف_شهر_1_2026.csv", "textSnippet": CSV1, "mimeType": "text/csv"},
        {"name": "كشف_شهر_2_2026.csv", "textSnippet": CSV2, "mimeType": "text/csv"},
    ]


def test_executive_brief_exposes_engines_from_upload():
    out = analyze_upload_portfolio(_two_month_files(), beta_dataset("owner"), lang="ar")
    brief = out.get("executive_brief") or {}
    engines = brief.get("engines") or {}

    assert engines, "executive_brief.engines must be present (additive API field)"
    assert "collection" in engines
    assert "late" in engines
    assert "lifecycle" in engines
    assert "tenant_cards" in engines
    assert engines["tenant_cards"]["count"] >= 1 or out["metrics"]["tenants"] >= 1
    assert engines["lifecycle"]["departed_count"] is not None
    assert engines["lifecycle"]["newcomers_count"] is not None

    # Compatibility: prior brief fields remain
    for key in ("property_status", "key_numbers", "confidence", "title"):
        assert key in brief


def test_koil_sections_and_success_message_still_present():
    out = analyze_upload_portfolio(_two_month_files(), {"properties": [], "tenants": [], "contracts": [], "decisions": [], "reports": []}, lang="ar")
    keys = [s["key"] for s in (out.get("executive_report") or {}).get("sections") or []]
    for required in ("koil_brief", "koil_what", "koil_why", "koil_risks", "koil_recommendations"):
        assert required in keys
    assert (out.get("success_message") or "").startswith("كويل")
    assert out.get("property_knowledge")


def test_local_apply_commit_links_tenants_to_imported_property():
    aid = "apply-test-aaaaaaaa"
    _import_sessions[aid] = {
        "source": "python",
        "success_message": "كويل · اختبار",
        "metrics": {"units": 2, "occupancy_pct": 100, "collected": 10000, "months_linked": 2},
        "executive_brief": {"title": "تقرير كويل التنفيذي", "period": "يناير → فبراير"},
        "property_knowledge": {
            "meta": {"period_from": "يناير", "period_to": "فبراير"},
            "lifecycle": {
                "active": [
                    {"tenant": "أحمد", "unit": "101", "phone": "0500000001", "rent": 5500},
                    {"tenant": "ريم", "unit": "102", "phone": "", "rent": 5000},
                ]
            },
            "tenants": [
                {"tenant": "أحمد", "unit": "101", "phone": "0500000001", "rent": 5500},
                {"tenant": "ريم", "unit": "102", "phone": "0500000002", "rent": 5000},
            ],
        },
    }
    commit = build_local_apply_commit(aid)
    assert commit["ok"] is True
    assert len(commit["properties"]) == 1
    assert commit["tenant_count"] == 2
    prop = commit["properties"][0]
    assert prop["id"].startswith("prop_imp_")
    assert all(t["property_id"] == prop["id"] for t in commit["tenants"])
    assert all(t["source"] == "property_knowledge" for t in commit["tenants"])
    # Phone fallback from Property Knowledge tenant cards when lifecycle row lacks phone
    rem = next(t for t in commit["tenants"] if t["unit"] == "102")
    assert rem["phone"] == "0500000002"
    assert commit["reports"][0]["id"] == aid
    assert "كويل" in (commit["reports"][0]["highlight"] or "")


def test_analyze_fallback_stores_session_for_apply():
    empty = {"properties": [], "tenants": [], "contracts": [], "decisions": [], "reports": []}
    out = analyze_upload_with_gas_fallback(_two_month_files(), empty, lang="ar")
    aid = out["analysis_id"]
    session = _import_sessions.get(aid) or {}
    assert session.get("source") == "python"
    assert session.get("property_knowledge")
    assert session.get("metrics")
    commit = build_local_apply_commit(aid)
    assert commit["tenant_count"] >= 1
    assert commit["properties"][0]["source"] == "upload_apply"


@pytest.fixture()
def api_client():
    spp_server._mongo_available = False
    spp_server._memory_clear()
    spp_server._portfolio_cache = None
    spp_server._portfolio_cache_at = 0.0
    with TestClient(spp_server.app) as client:
        yield client


def test_apply_analysis_api_updates_portfolio_memory(api_client):
    """End-to-end API: portfolio-analysis → apply-analysis → /tenants linked to /properties."""
    analysis = api_client.post(
        f"{API}/upload/portfolio-analysis",
        json={"files": _two_month_files(), "lang": "ar"},
    )
    assert analysis.status_code == 200, analysis.text
    body = analysis.json()
    aid = body["analysis_id"]
    assert body.get("executive_brief", {}).get("engines")

    applied = api_client.post(
        f"{API}/upload/apply-analysis",
        json={"analysis_id": aid, "files": _two_month_files()},
    )
    assert applied.status_code == 200, applied.text
    payload = applied.json()
    assert payload["ok"] is True
    assert payload.get("gas") is False
    assert (payload.get("commit") or {}).get("tenants", 0) >= 1

    props = api_client.get(f"{API}/properties").json()
    tenants = api_client.get(f"{API}/tenants").json()
    reports = api_client.get(f"{API}/reports").json()
    assert len(props) >= 1
    assert props[0]["id"].startswith("prop_imp_")
    assert len(tenants) >= 1
    assert all(t.get("property_id") == props[0]["id"] for t in tenants)
    assert any(r.get("id") == aid for r in reports)
