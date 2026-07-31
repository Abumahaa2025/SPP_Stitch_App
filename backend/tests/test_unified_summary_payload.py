"""Unified summary payload — official OS-foundation contract + Apply consistency."""

from __future__ import annotations

import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO))
sys.path.insert(0, str(REPO / "backend"))

from adapters.koil.koil_report_bridge import build_unified_summary, enrich_metrics_for_summary
from adapters.upload_analysis.portfolio_engine import analyze_upload_portfolio
from beta_seed import beta_dataset


REQUIRED_SUMMARY_KEYS = {
    "properties",
    "units",
    "tenants",
    "contracts",
    "rents",
    "collected",
    "remaining",
    "late_tenants",
    "contracts_expired",
    "contracts_expiring_soon",
    "gaps",
    "missing_phone",
    "missing_contract",
    "payments",
    "arrears",
    "maintenance",
    "reports",
    "gaps_detail",
    "data_status",
}

DATA_STATUS_VALUES = {"confirmed", "needs_review", "incomplete", "conflicting"}


CSV1 = "وحدة,مستأجر,إيجار,حالة,جوال\n101,أحمد,5500,مسدد,0501111111\n102,سعد,4800,مسدد,\n"
CSV2 = "وحدة,مستأجر,إيجار,حالة,جوال\n101,أحمد,5500,مسدد,0501111111\n102,ريم,5000,متأخر,0503333333\n"


def _files():
    return [
        {"name": "كشف_شهر_1_2026.csv", "textSnippet": CSV1, "mimeType": "text/csv"},
        {"name": "كشف_شهر_2_2026.csv", "textSnippet": CSV2, "mimeType": "text/csv"},
    ]


def test_unified_summary_has_all_core_numbers():
    out = analyze_upload_portfolio(_files(), {"properties": [], "tenants": [], "contracts": [], "decisions": [], "reports": []}, lang="ar")
    summary = out.get("summary") or {}
    assert REQUIRED_SUMMARY_KEYS.issubset(summary.keys()), summary

    metrics = out["metrics"]
    assert summary["units"] == metrics["units"]
    assert summary["tenants"] == metrics["tenants"]
    assert summary["collected"] == metrics["collected"]
    assert summary["remaining"] == metrics["remaining"]
    assert summary["late_tenants"] == metrics["late_tenants"]
    assert summary["rents"] == (metrics.get("rents") or metrics["total_revenue_annual"])
    assert summary["contracts"] >= 1
    assert "gaps" in metrics
    assert summary["payments"]["collected"] == summary["collected"]
    assert summary["arrears"]["late_tenants"] == summary["late_tenants"]
    assert summary["data_status"]["overall"] in DATA_STATUS_VALUES
    assert summary["reports"]["executive_ready"] is True
    assert summary["reports"]["section_count"] >= 1


def test_key_numbers_include_owner_core_labels():
    out = analyze_upload_portfolio(_files(), beta_dataset("owner"), lang="ar")
    labels = [k["label"] for k in ((out.get("executive_brief") or {}).get("key_numbers") or [])]
    for needed in ("العقارات", "الوحدات", "المستأجرون", "العقود", "الإيجارات", "المحصل", "المتبقي", "المتأخرون", "النواقص"):
        assert needed in labels, labels


def test_summary_matches_brief_engines_and_apply_session_shape():
    out = analyze_upload_portfolio(_files(), {"properties": [], "tenants": [], "contracts": [], "decisions": [], "reports": []}, lang="ar")
    summary = out["summary"]
    brief = out["executive_brief"]
    eng = brief.get("engines") or {}

    assert summary["late_tenants"] == eng["late"]["tenant_count"]
    assert summary["collected"] == eng["collection"]["collected"]
    assert summary["missing_phone"] == eng["contracts"]["missing_phone"]
    assert summary["gaps"] == eng["gaps"]["total"]
    assert summary["maintenance"]["count"] == eng["maintenance"]["count"]

    from adapters.gas_import_bridge import _import_sessions, analyze_upload_with_gas_fallback, build_local_apply_commit

    empty = {"properties": [], "tenants": [], "contracts": [], "decisions": [], "reports": []}
    payload = analyze_upload_with_gas_fallback(_files(), empty, lang="ar")
    aid = payload["analysis_id"]
    assert (_import_sessions.get(aid) or {}).get("summary")
    commit = build_local_apply_commit(aid)
    assert commit["tenant_count"] == payload["summary"]["tenants"] or commit["tenant_count"] == len(
        ((payload.get("property_knowledge") or {}).get("lifecycle") or {}).get("active") or []
    )
    assert commit["units"] == payload["summary"]["units"] or commit["units"] == payload["metrics"]["units"]
    assert commit.get("summary"), "Apply commit must carry unified summary"
    assert (commit.get("summary") or {}).get("units") == payload["summary"]["units"]
    assert (commit.get("summary") or {}).get("data_status")
    assert commit["reports"][0].get("summary") is not None


def test_enrich_metrics_for_summary_additive():
    m = enrich_metrics_for_summary(
        {"properties": 1, "units": 2, "tenants": 2, "total_revenue_annual": 1000, "collected": 800, "remaining": 200},
        {
            "lifecycle": {"active": [{"unit": "1"}, {"unit": "2"}]},
            "contracts": {"missing_phone": [{"unit": "2"}], "missing_contract": []},
            "ledger_quality": {"unknown_month_count": 1},
            "tenants": [{"unit": "1"}, {"unit": "2"}],
            "maintenance": {"count": 2, "total": 450},
        },
    )
    assert m["contracts"] == 2
    assert m["rents"] == 1000
    assert m["missing_phone"] == 1
    assert m["gaps"] == 2
    assert m["maintenance_count"] == 2

    s = build_unified_summary(m, None, {"engines": {}, "meta": {}, "period": "x", "title": "t"})
    assert s["gaps"] == 2
    assert s["contracts"] == 2
    assert s["data_status"]["overall"] in DATA_STATUS_VALUES


def test_upload_analysis_report_apply_have_summary_contract():
    """Regression gate: Upload → Analysis → Executive Report → Apply all carry real summary."""
    from adapters.gas_import_bridge import analyze_upload_with_gas_fallback, build_local_apply_commit

    empty = {"properties": [], "tenants": [], "contracts": [], "decisions": [], "reports": []}
    out = analyze_upload_with_gas_fallback(_files(), empty, lang="ar")

    # Upload/Analysis
    assert out.get("analysis_id")
    assert out.get("metrics")
    assert out.get("summary")
    assert REQUIRED_SUMMARY_KEYS.issubset(out["summary"].keys())

    # Executive Report
    assert out.get("executive_report", {}).get("sections")
    assert out.get("executive_brief", {}).get("key_numbers")
    assert out["summary"]["reports"]["section_count"] == len(out["executive_report"]["sections"])

    # Apply
    commit = build_local_apply_commit(out["analysis_id"])
    assert commit["ok"] is True
    assert commit["summary"]["data_status"]["overall"] in DATA_STATUS_VALUES
    assert commit["reports"][0]["summary"]["payments"]["collected"] == out["summary"]["collected"]
