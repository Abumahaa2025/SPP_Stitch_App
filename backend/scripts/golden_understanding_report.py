#!/usr/bin/env python3
"""Golden Understanding Report — 6-part verification before deploy."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any, Dict, List

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO))
sys.path.insert(0, str(REPO / "backend"))

from adapters.upload_analysis.production_pipeline import run_production_portfolio_analysis  # noqa: E402
from benchmarks.regression_tests.golden_benchmark import (  # noqa: E402
    GOLDEN_SET,
    missing_files_status,
    run_golden_benchmark,
)
from benchmarks.regression_tests.loader import (  # noqa: E402
    expected_path,
    files_from_manifest,
    golden_files_present,
    list_golden_files,
    load_json,
)
from benchmarks.regression_tests.golden_benchmark import _runtime_manifest_path  # noqa: E402

OUTPUT_JSON = REPO / "benchmarks" / "library" / "sets" / "golden" / "understanding_report.json"
OUTPUT_TXT = REPO / "benchmarks" / "library" / "sets" / "golden" / "understanding_report.txt"

FIELD_CONF_BASE = {
    "unit": 88,
    "tenant": 85,
    "rent": 80,
    "phone": 82,
    "contract": 78,
    "pay_status": 75,
    "paid": 72,
    "late": 70,
}


def _per_column_confidence(col_labels: dict, col_map: dict) -> List[dict]:
    out = []
    for key in ("unit", "tenant", "rent", "phone", "contract", "pay_status", "paid", "late"):
        label = col_labels.get(key)
        idx = col_map.get(key)
        if label is None and idx is None:
            out.append(
                {
                    "field": key,
                    "header": None,
                    "mapped": False,
                    "confidence": 0.0,
                    "status": "missing",
                }
            )
            continue
        conf = float(FIELD_CONF_BASE.get(key, 70))
        if not label:
            conf *= 0.5
        out.append(
            {
                "field": key,
                "header": label or f"col_{idx}",
                "mapped": True,
                "confidence": round(conf, 1),
                "status": "ok" if conf >= 70 else "weak",
            }
        )
    return out


def _file_understanding(deep: dict, understanding: dict) -> List[dict]:
    rolls = {(pr.get("file_name") or ""): pr for pr in deep.get("parsed_rolls") or []}
    by_name = {f.get("name"): f for f in understanding.get("files") or []}
    rows = []
    for fc in deep.get("file_classifications") or []:
        name = fc.get("name") or ""
        pr = rolls.get(name) or {}
        u = by_name.get(name) or {}
        rows.append(
            {
                "file": name,
                "classified_as": fc.get("category_ar") or fc.get("category"),
                "month_detected": fc.get("month"),
                "year_detected": fc.get("year"),
                "month_detection_reason": (fc.get("reasons") or ["من اسم الملف"])[0],
                "understood_as": u.get("understood_as"),
                "confidence": u.get("confidence") or fc.get("confidence"),
                "success": bool(pr.get("ok")),
                "row_count": pr.get("row_count") or 0,
                "notes": u.get("notes") or [],
            }
        )
    return rows


def _column_understanding(deep: dict) -> List[dict]:
    out = []
    for pr in deep.get("parsed_rolls") or []:
        col_labels = pr.get("column_labels") or {}
        col_map = pr.get("column_map") or {}
        cols = _per_column_confidence(col_labels, col_map)
        out.append(
            {
                "file": pr.get("file_name"),
                "month": pr.get("month"),
                "overall_column_confidence": pr.get("column_confidence"),
                "headers_detected": pr.get("headers") or [],
                "columns": cols,
                "mapped_count": sum(1 for c in cols if c.get("mapped")),
                "missing_count": sum(1 for c in cols if not c.get("mapped")),
            }
        )
    return out


def _timeline_understanding(deep: dict, understanding: dict, metrics: dict) -> dict:
    months = sorted(
        {
            (int(pr.get("year") or 0), int(pr.get("month") or 0))
            for pr in deep.get("parsed_rolls") or []
            if pr.get("month")
        }
    )
    rels = understanding.get("relationships") or []
    lc = deep.get("lifecycle") or {}
    return {
        "months_linked": metrics.get("months_linked"),
        "months_sequence": [f"{y}-{m:02d}" for y, m in months],
        "departed_count": len(lc.get("departed") or []),
        "newcomers_count": len(lc.get("newcomers") or []),
        "tenant_changes_detected": [
            r.get("text") for r in rels if "غيّرت" in (r.get("text") or "") or "change" in (r.get("text") or "").lower()
        ],
        "stability_detected": [
            r.get("text") for r in rels if "استمر" in (r.get("text") or "") or "kept" in (r.get("text") or "").lower()
        ],
        "gaps_detected": [r.get("text") for r in rels if "مفقود" in (r.get("text") or "") or "Missing" in (r.get("text") or "")],
        "all_relationships": rels,
    }


def _relationship_understanding(deep: dict, knowledge: dict) -> dict:
    ledger = deep.get("payment_ledger") or {}
    late = knowledge.get("late") or {}
    units_sample = []
    for pr in (deep.get("parsed_rolls") or [])[:2]:
        for row in (pr.get("rows") or [])[:5]:
            units_sample.append(
                {
                    "unit": row.get("unit"),
                    "tenant": row.get("tenant"),
                    "contract": row.get("contract"),
                    "phone": row.get("phone"),
                    "rent": row.get("rent"),
                    "is_paid": row.get("is_paid"),
                    "is_late": row.get("is_late"),
                    "pay_status": row.get("pay_status"),
                    "file": pr.get("file_name"),
                    "month": pr.get("month"),
                }
            )

    phones_found = sorted({s.get("phone") for s in units_sample if s.get("phone")})
    contracts_found = sorted({s.get("contract") for s in units_sample if s.get("contract")})

    return {
        "unit_tenant_links": len(ledger.get("ledger") or {}),
        "late_tenants_with_phones": sum(1 for t in (late.get("tenants") or []) if (t.get("phone") or "").strip()),
        "late_tenants_with_contracts": sum(1 for t in (late.get("tenants") or []) if (t.get("contract") or "").strip()),
        "phones_extracted_sample": phones_found[:12],
        "contracts_extracted_sample": contracts_found[:12],
        "payment_states_in_sample": {
            "paid": sum(1 for s in units_sample if s.get("is_paid")),
            "late": sum(1 for s in units_sample if s.get("is_late")),
            "rows": len(units_sample),
        },
        "tenant_changes_from_knowledge": (knowledge.get("lifecycle") or {}).get("tenant_changes") or [],
        "sample_rows": units_sample[:15],
    }


def _confidence_report(
    deep: dict,
    understanding: dict,
    knowledge: dict,
    koil: dict,
    metrics: dict,
) -> dict:
    col_confs = [float(c.get("overall_column_confidence") or 0) for c in _column_understanding(deep)]
    file_confs = [float(f.get("confidence") or 0) for f in understanding.get("files") or []]

    return {
        "layer_1_deterministic_import": {
            "files_read": metrics.get("files_analyzed"),
            "months_linked": metrics.get("months_linked"),
            "units": metrics.get("units"),
            "confidence": round(
                (sum(1 for d in (deep.get("parsed_rolls") or []) if d.get("ok")) / max(1, len(deep.get("parsed_rolls") or [1])))
                * 100,
                1,
            ),
        },
        "layer_2_file_classification": {
            "confidence": round(sum(file_confs) / len(file_confs), 1) if file_confs else 0,
            "mode": understanding.get("mode"),
            "per_file": {f.get("name"): f.get("confidence") for f in understanding.get("files") or []},
        },
        "layer_2_column_mapping": {
            "confidence": round(sum(col_confs) / len(col_confs), 1) if col_confs else 0,
            "per_file": {
                pr.get("file_name"): pr.get("column_confidence") for pr in deep.get("parsed_rolls") or []
            },
        },
        "layer_2_timeline": {
            "confidence": 90.0 if (metrics.get("months_linked") or 0) >= 6 else 55.0,
            "months_linked": metrics.get("months_linked"),
        },
        "layer_3_property_knowledge": {
            "confidence": (knowledge.get("meta") or {}).get("confidence") or 75,
        },
        "layer_3_koil_reasoning": {
            "confidence": koil.get("confidence"),
            "version": koil.get("version"),
        },
        "overall_understanding": {
            "confidence": understanding.get("confidence"),
            "version": understanding.get("version"),
        },
    }


def _failure_report(deep: dict, understanding: dict, knowledge: dict, gate: dict, diffs: List[dict]) -> dict:
    failures = []
    for pe in deep.get("parse_errors") or []:
        failures.append({"kind": "parse_error", "file": pe.get("file_name"), "message": pe.get("error")})
    for fw in deep.get("files_without_content") or []:
        failures.append({"kind": "no_content", "file": fw.get("file_name"), "message": fw.get("reason")})
    for amb in understanding.get("ambiguities") or []:
        failures.append({"kind": "ambiguity", "message": amb.get("text"), "needs_review": amb.get("needs_review")})
    for w in (knowledge.get("quality") or {}).get("warnings") or []:
        failures.append({"kind": "quality_warning", "message": str(w)})
    for d in diffs or []:
        if not d.get("match"):
            failures.append(
                {
                    "kind": "benchmark_mismatch",
                    "field": d.get("field"),
                    "expected": d.get("expected"),
                    "actual": d.get("actual"),
                }
            )
    for err in gate.get("errors") or []:
        failures.append({"kind": "gate_error", "message": str(err)})

    review_units = (knowledge.get("units") or {}).get("needs_review_count") or 0
    if review_units:
        failures.append({"kind": "unit_identity", "message": f"{review_units} وحدة تحتاج تأكيد هوية", "needs_review": True})

    return {
        "count": len(failures),
        "needs_human_review": [f for f in failures if f.get("needs_review") or f.get("kind") in ("ambiguity", "parse_error", "benchmark_mismatch", "no_content")],
        "all": failures,
    }


def _production_view_from_analysis(analysis: dict) -> dict:
    """Read-only view of intake — from production API output, not a second parse."""
    meta = analysis.get("intake_meta") or {}
    knowledge = analysis.get("property_knowledge") or {}
    linked = analysis.get("linked_files") or []
    classifications = []
    for lf in linked:
        classifications.append(
            {
                "name": lf.get("name"),
                "category": lf.get("category"),
                "category_ar": lf.get("category_label"),
                "month": lf.get("month"),
                "year": analysis.get("executive_report", {}).get("year"),
                "confidence": lf.get("confidence"),
                "reasons": ["من خط الإنتاج"],
            }
        )
    parsed_rolls = []
    for p in meta.get("parse_by_file") or []:
        parsed_rolls.append(
            {
                "file_name": p.get("file_name"),
                "month": p.get("month"),
                "year": p.get("year"),
                "row_count": p.get("row_count"),
                "ok": p.get("ok"),
                "column_labels": p.get("column_labels") or {},
                "column_map": p.get("column_map") or {},
                "column_confidence": p.get("column_confidence"),
                "rows": [],
            }
        )
    return {
        "parsed_rolls": parsed_rolls,
        "file_classifications": classifications,
        "parse_errors": meta.get("parse_errors") or [],
        "files_without_content": meta.get("files_without_content") or [],
        "lifecycle": knowledge.get("lifecycle") or {},
    }


def build_understanding_report(analysis: dict, gate: dict, diffs: List[dict], files_meta: List[dict]) -> dict:
    deep = _production_view_from_analysis(analysis)
    understanding = analysis.get("koil_understanding") or {}
    knowledge = analysis.get("property_knowledge") or {}
    koil = analysis.get("koil_reasoning") or {}
    metrics = analysis.get("metrics") or {}

    return {
        "status": "completed",
        "files_count": len(files_meta),
        "file_names": [f.get("name") for f in files_meta],
        "1_file_understanding": _file_understanding(deep, understanding),
        "2_column_understanding": _column_understanding(deep),
        "3_timeline_understanding": _timeline_understanding(deep, understanding, metrics),
        "4_relationship_understanding": _relationship_understanding(deep, knowledge),
        "5_confidence_report": _confidence_report(deep, understanding, knowledge, koil, metrics),
        "6_failure_report": _failure_report(deep, understanding, knowledge, gate, diffs),
        "benchmark_ok": gate.get("passed") and all(d.get("match") for d in diffs),
        "pipeline": analysis.get("pipeline") or {"engine": (analysis.get("intake_meta") or {}).get("engine")},
        "koil_understanding": understanding,
        "koil_reasoning": koil,
        "metrics": metrics,
    }


def _format_txt(report: dict) -> str:
    if report.get("status") != "completed":
        return report.get("message_ar", "تقرير غير متاح")

    lines = [
        "═" * 60,
        "Golden Understanding Report — تقرير التحقق قبل النشر",
        "═" * 60,
        f"الملفات: {report.get('files_count')} | Benchmark: {'✅ نجح' if report.get('benchmark_ok') else '❌ فشل'}",
        "",
        "── 1. File Understanding ──",
    ]
    for f in report.get("1_file_understanding") or []:
        mark = "✓" if f.get("success") else "✗"
        lines.append(
            f"  {mark} {f.get('file')}\n"
            f"      شهر {f.get('month_detected')} / {f.get('year_detected')} — {f.get('month_detection_reason')}\n"
            f"      فهم: {f.get('understood_as')} | ثقة {f.get('confidence')}% | صفوف {f.get('row_count')}"
        )
        for n in f.get("notes") or []:
            lines.append(f"      · {n}")

    lines.extend(["", "── 2. Column Understanding ──"])
    for c in report.get("2_column_understanding") or []:
        lines.append(f"  {c.get('file')} (شهر {c.get('month')}) — ثقة عامة {c.get('overall_column_confidence')}%")
        for col in c.get("columns") or []:
            st = col.get("status")
            if col.get("mapped"):
                lines.append(f"      {col.get('field')} ← {col.get('header')} | {col.get('confidence')}% ({st})")
            else:
                lines.append(f"      {col.get('field')} | غير مكتشف")

    lines.extend(["", "── 3. Timeline Understanding ──"])
    tl = report.get("3_timeline_understanding") or {}
    lines.append(f"  الأشهر المربوطة: {tl.get('months_linked')} — {', '.join(tl.get('months_sequence') or [])}")
    lines.append(f"  مغادرون: {tl.get('departed_count')} | داخلون: {tl.get('newcomers_count')}")
    for t in (tl.get("tenant_changes_detected") or [])[:6]:
        lines.append(f"  · {t}")

    lines.extend(["", "── 4. Relationship Understanding ──"])
    rel = report.get("4_relationship_understanding") or {}
    ps = rel.get("payment_states_in_sample") or {}
    lines.append(f"  عينة: {ps.get('rows')} صف — مسدد {ps.get('paid')} | متأخر {ps.get('late')}")
    lines.append(f"  جوالات مستخرجة: {len(rel.get('phones_extracted_sample') or [])}")
    lines.append(f"  عقود مستخرجة: {len(rel.get('contracts_extracted_sample') or [])}")

    lines.extend(["", "── 5. Confidence Report ──"])
    conf = report.get("5_confidence_report") or {}
    for layer, data in conf.items():
        if isinstance(data, dict) and "confidence" in data:
            lines.append(f"  {layer}: {data.get('confidence')}%")

    lines.extend(["", "── 6. Failure Report ──"])
    fail = report.get("6_failure_report") or {}
    lines.append(f"  إجمالي المشاكل: {fail.get('count')}")
    for f in (fail.get("needs_human_review") or [])[:15]:
        lines.append(f"  ! [{f.get('kind')}] {f.get('message') or f.get('file')}")

    return "\n".join(lines)


def run_full_report(files_meta: List[dict] | None = None) -> dict:
    if files_meta is None:
        if not golden_files_present(GOLDEN_SET):
            return missing_files_status(GOLDEN_SET)
        tmp = _runtime_manifest_path(GOLDEN_SET)
        try:
            _, files_meta = files_from_manifest(tmp)
        finally:
            if tmp.exists():
                tmp.unlink()

    from benchmarks.regression_tests.runner import run_level2

    expected = load_json(expected_path(GOLDEN_SET))
    analysis = run_production_portfolio_analysis(files_meta, lang="ar")

    gate = run_level2()
    exp_m = expected.get("metrics") or {}
    metrics = analysis.get("metrics") or {}
    diffs = [
        {
            "field": "إجمالي الوحدات",
            "expected": exp_m.get("total_units"),
            "actual": metrics.get("units"),
            "match": exp_m.get("total_units") == metrics.get("units"),
        },
        {
            "field": "الشقق",
            "expected": exp_m.get("apartment_count"),
            "actual": metrics.get("residential_units"),
            "match": exp_m.get("apartment_count") == metrics.get("residential_units"),
        },
        {
            "field": "المحلات",
            "expected": exp_m.get("shop_count"),
            "actual": metrics.get("commercial_units"),
            "match": exp_m.get("shop_count") == metrics.get("commercial_units"),
        },
        {
            "field": "الأشهر المربوطة",
            "expected": exp_m.get("min_months_linked"),
            "actual": metrics.get("months_linked"),
            "match": (metrics.get("months_linked") or 0) >= (exp_m.get("min_months_linked") or 0),
        },
    ]

    return build_understanding_report(analysis, gate, diffs, files_meta)


def run_full_report_from_paths(paths: List[Path]) -> dict:
    from benchmarks.regression_tests.loader import files_from_paths

    return run_full_report(files_from_paths(paths))


def main() -> int:
    report = run_full_report()
    OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_JSON.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    OUTPUT_TXT.write_text(_format_txt(report), encoding="utf-8")
    print(_format_txt(report))
    if report.get("status") in ("awaiting_import", "awaiting_setup", "awaiting_files"):
        return 2
    return 0 if report.get("benchmark_ok") else 1


if __name__ == "__main__":
    sys.exit(main())
