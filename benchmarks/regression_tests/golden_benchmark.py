"""Golden Benchmark — runs active library set (in-project, no external paths)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List

from beta_seed import beta_dataset
from adapters.upload_analysis.production_pipeline import run_production_portfolio_analysis

from benchmarks.benchmark_manager import get_manager
from .loader import (
    REPO_ROOT,
    expected_path,
    files_from_manifest,
    golden_files_present,
    list_golden_files,
    load_json,
)
from .runner import run_level2

GOLDEN_SET = "golden"


def _set_dir(set_id: str) -> Path:
    return REPO_ROOT / "benchmarks" / "library" / "sets" / set_id


def _runtime_manifest_path(set_id: str) -> Path:
    expected = load_json(expected_path(set_id))
    gdir = _set_dir(set_id)
    files_sub = "files"
    rel_files = [f"{files_sub}/{p.name}" for p in list_golden_files(set_id)]
    manifest = {**expected, "lang": "ar", "files": rel_files}
    tmp = gdir / "_runtime_manifest.json"
    tmp.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return tmp


def _extract_phones(knowledge: dict) -> List[str]:
    phones = set()
    for lt in (knowledge.get("late") or {}).get("tenants") or []:
        p = (lt.get("phone") or "").strip()
        if p:
            phones.add(p)
    return sorted(phones)


def _diff(expected: Any, actual: Any, label: str) -> Dict[str, Any]:
    ok = expected == actual
    return {
        "field": label,
        "expected": expected,
        "actual": actual,
        "match": ok,
        "reason": None if ok else f"المتوقع {expected} — الفعلي {actual}",
    }


def missing_files_status(set_id: str = GOLDEN_SET) -> Dict[str, Any]:
    lib = get_manager().library
    return {
        "ok": False,
        "status": "awaiting_import",
        "set_id": set_id,
        "message_ar": (
            "ارفق الملفات الستة عبر Attach (+) في Cursor ثم قل: شغّل Golden Benchmark"
        ),
        "staging_path": str(REPO_ROOT / "benchmarks" / "library" / "_staging"),
        "library_status": lib.status(),
    }


def run_golden_benchmark(set_id: str | None = None) -> Dict[str, Any]:
    mgr = get_manager()
    sid = set_id or mgr.library.active_set_id()
    prep = mgr.prepare_for_run(sid)
    if not prep.get("ok"):
        out = missing_files_status(sid)
        out["prepare"] = prep
        return out

    if not golden_files_present(sid):
        return missing_files_status(sid)

    expected = load_json(expected_path(sid))
    tmp = _runtime_manifest_path(sid)
    try:
        _, files_meta = files_from_manifest(tmp)
        out = run_production_portfolio_analysis(files_meta, lang="ar")
    finally:
        if tmp.exists():
            tmp.unlink()

    metrics = out.get("metrics") or {}
    knowledge = out.get("property_knowledge") or {}
    koil = out.get("koil_reasoning") or {}
    late = out.get("late_payments") or {}
    exp_m = expected.get("metrics") or {}
    gate = run_level2()

    diffs = [
        _diff(exp_m.get("total_units"), metrics.get("units"), "إجمالي الوحدات"),
        _diff(exp_m.get("apartment_count"), metrics.get("residential_units"), "الشقق"),
        _diff(exp_m.get("shop_count"), metrics.get("commercial_units"), "المحلات"),
        _diff(exp_m.get("min_months_linked"), metrics.get("months_linked"), "الأشهر المربوطة"),
        _diff(exp_m.get("min_files_analyzed"), metrics.get("files_analyzed"), "الملفات المقروءة"),
    ]

    report = {
        "ok": gate.get("passed") and all(d["match"] for d in diffs),
        "status": "completed",
        "set_id": sid,
        "gate_errors": gate.get("errors") or [],
        "files_read": {"count": len(files_meta), "names": [f.get("name") for f in files_meta]},
        "period": {
            "expected": expected.get("period", {}).get("label_ar"),
            "actual_from": (knowledge.get("meta") or {}).get("period_from"),
            "actual_to": (knowledge.get("meta") or {}).get("period_to"),
        },
        "diffs": diffs,
        "metrics_actual": metrics,
        "metrics_expected": exp_m,
        "tenants": {
            "active_count": metrics.get("tenants"),
            "departed_count": metrics.get("departed_count"),
            "newcomers_count": metrics.get("newcomers_count"),
        },
        "contracts": {
            "expired": metrics.get("contracts_expired"),
            "expiring_soon": metrics.get("contracts_expiring_soon"),
        },
        "phones_extracted": _extract_phones(knowledge),
        "tenant_changes": (knowledge.get("lifecycle") or {}).get("tenant_changes") or [],
        "late_payments": late,
        "late_summary": {
            "late_tenants": metrics.get("late_tenants"),
            "late_value": metrics.get("late_value"),
        },
        "review_needed": {
            "units_needs_review": (knowledge.get("units") or {}).get("needs_review_count"),
            "quality_warnings": (knowledge.get("quality") or {}).get("warnings") or [],
            "parse_errors": (knowledge.get("quality") or {}).get("parse_errors") or [],
        },
        "koil": koil,
        "success_message": out.get("success_message"),
        "property_knowledge": knowledge,
        "pipeline": out.get("pipeline") or {"entry": "production", "engine": (out.get("intake_meta") or {}).get("engine")},
    }
    return report


def format_summary_ar(report: Dict[str, Any]) -> str:
    if report.get("status") == "awaiting_import":
        lines = ["⏸ Golden Benchmark — بانتظار الاستيراد", "", report.get("message_ar", "")]
        staging = report.get("staging_path")
        if staging:
            lines.append(f"منطقة الرفع: {staging}")
        return "\n".join(lines)

    ok = report.get("ok")
    lines = [
        f"{'✅' if ok else '❌'} Golden Benchmark [{report.get('set_id')}] — {'نجح' if ok else 'فشل'}",
        "",
        f"الملفات المقروءة: {report.get('files_read', {}).get('count')}",
        f"الفترة المتوقعة: {report.get('period', {}).get('expected')}",
        f"الفترة الفعلية: {report.get('period', {}).get('actual_from')} → {report.get('period', {}).get('actual_to')}",
        "",
        "— مقارنة المرجع —",
    ]
    for d in report.get("diffs") or []:
        mark = "✓" if d.get("match") else "✗"
        lines.append(f"  {mark} {d.get('field')}: متوقع {d.get('expected')} | فعلي {d.get('actual')}")
        if not d.get("match") and d.get("reason"):
            lines.append(f"      سبب: {d['reason']}")
    lines.extend(
        [
            "",
            f"المتأخرون: {report.get('late_summary', {}).get('late_tenants')} — {report.get('late_summary', {}).get('late_value')} ر.س",
            "",
            "— كويل —",
            report.get("koil", {}).get("brief") or "—",
        ]
    )
    return "\n".join(lines)


def save_artifacts(report: Dict[str, Any]) -> None:
    sid = report.get("set_id") or GOLDEN_SET
    gdir = _set_dir(sid)
    gdir.mkdir(parents=True, exist_ok=True)
    (gdir / "latest_report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    (gdir / "latest_summary.txt").write_text(format_summary_ar(report), encoding="utf-8")
