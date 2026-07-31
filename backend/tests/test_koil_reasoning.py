"""Koil tests — Golden Benchmark only (real owner files). No mock data."""

from __future__ import annotations

import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO))
sys.path.insert(0, str(REPO / "backend"))

import pytest

from benchmarks.regression_tests.golden_benchmark import run_golden_benchmark
from benchmarks.regression_tests.loader import golden_files_present


@pytest.mark.skipif(not golden_files_present(), reason="Golden files not in benchmarks/golden_benchmark/files/")
def test_koil_on_golden_benchmark():
    report = run_golden_benchmark()
    assert report.get("status") == "completed", report
    koil = report.get("koil") or {}
    assert koil.get("version") == "koil-reasoning-v1"
    assert len(koil.get("what_happened") or []) >= 1
    assert any((w.get("evidence") or []) for w in koil.get("what_happened") or [])
    assert (report.get("success_message") or "").startswith("كويل")
    assert report.get("ok"), report.get("diffs") or report.get("gate_errors")


@pytest.mark.skipif(not golden_files_present(), reason="Golden files not in benchmarks/golden_benchmark/files/")
def test_golden_unit_counts():
    report = run_golden_benchmark()
    diffs = {d["field"]: d for d in report.get("diffs") or []}
    assert diffs["إجمالي الوحدات"]["match"], diffs["إجمالي الوحدات"]
    assert diffs["الشقق"]["match"], diffs["الشقق"]
    assert diffs["المحلات"]["match"], diffs["المحلات"]
