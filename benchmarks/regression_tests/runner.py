"""Run SPP benchmark levels 1–3 against portfolio + Koil engines."""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any, Dict, List

_REPO = Path(__file__).resolve().parents[2]
_BACKEND = _REPO / "backend"
if str(_REPO) not in sys.path:
    sys.path.insert(0, str(_REPO))
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

from beta_seed import beta_dataset  # noqa: E402
from adapters.upload_analysis.portfolio_engine import analyze_upload_portfolio  # noqa: E402

from benchmarks.regression_tests.assertions import (  # noqa: E402
    assert_brief,
    assert_koil,
    assert_metrics,
    assert_sections,
)
from benchmarks.regression_tests.loader import (  # noqa: E402
    BENCHMARKS_ROOT,
    files_from_manifest,
    golden_files_dir,
    golden_files_present,
    list_client_variants,
    list_golden_files,
    load_json,
    expected_path,
)


def _analyze(manifest: dict, files_meta: List[dict]) -> dict:
    lang = manifest.get("lang") or "ar"
    # Level-3 client variants must not inherit the demo owner portfolio.
    if manifest.get("use_beta_seed", True):
        ctx = beta_dataset("owner")
    else:
        ctx = {"properties": [], "units": [], "tenants": [], "contracts": [], "payments": []}
    return analyze_upload_portfolio(files_meta, ctx, lang=lang)


def run_suite(manifest_path: Path, expected: dict) -> Dict[str, Any]:
    errors: List[str] = []
    manifest, files_meta = files_from_manifest(manifest_path)
    out = _analyze(manifest, files_meta)

    metrics_rules = expected.get("metrics") or manifest.get("metrics") or {}
    koil_rules = expected.get("koil") or manifest.get("koil") or {}
    section_rules = expected.get("sections") or {}

    assert_metrics(out.get("metrics") or {}, metrics_rules, errors)
    assert_koil(out.get("koil_reasoning") or {}, koil_rules, errors)
    assert_sections(out.get("executive_report") or {}, section_rules.get("required_keys") or [], errors)
    assert_brief(out.get("success_message") or "", koil_rules.get("brief_prefix") or "كويل", errors, lang=manifest.get("lang") or "ar")

    return {
        "name": manifest_path.parent.name,
        "passed": len(errors) == 0,
        "errors": errors,
        "metrics": out.get("metrics"),
        "koil_brief": (out.get("koil_reasoning") or {}).get("brief"),
        "success_message": out.get("success_message"),
    }


def run_level1() -> Dict[str, Any]:
    path = BENCHMARKS_ROOT / "synthetic_benchmark" / "manifest.json"
    manifest = load_json(path)
    return run_suite(path, manifest)


def run_level2() -> Dict[str, Any]:
    if not golden_files_present():
        return {
            "name": "golden_benchmark",
            "passed": False,
            "skipped": False,
            "errors": [
                "Golden library set not ready — upload to benchmarks/library/_staging/ "
                "then say: استبدل Golden Benchmark"
            ],
        }
    expected = load_json(expected_path())
    gdir = golden_files_dir().parent
    sub = golden_files_dir().name
    rel_files = [f"{sub}/{p.name}" for p in list_golden_files()]
    manifest = {**expected, "lang": "ar", "files": rel_files}
    tmp_manifest = gdir / "_runtime_manifest.json"
    import json

    tmp_manifest.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    try:
        return run_suite(tmp_manifest, expected)
    finally:
        if tmp_manifest.exists():
            tmp_manifest.unlink()


def run_level3() -> List[Dict[str, Any]]:
    results = []
    for mp in list_client_variants():
        manifest = load_json(mp)
        results.append(run_suite(mp, manifest))
    return results


def run_all(levels: List[int] | None = None) -> Dict[str, Any]:
    levels = levels or [1, 2, 3]
    report: Dict[str, Any] = {"levels": {}, "passed": True}

    if 1 in levels:
        r1 = run_level1()
        report["levels"]["1_synthetic"] = r1
        report["passed"] = report["passed"] and r1["passed"]

    if 2 in levels:
        r2 = run_level2()
        report["levels"]["2_golden"] = r2
        report["passed"] = report["passed"] and r2["passed"]

    if 3 in levels:
        r3 = run_level3()
        report["levels"]["3_clients"] = r3
        all_ok = all(x["passed"] for x in r3)
        report["passed"] = report["passed"] and all_ok

    return report
