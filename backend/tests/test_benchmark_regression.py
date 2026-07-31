"""Pytest integration for SPP benchmark levels 1–3."""

from __future__ import annotations

import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO))
sys.path.insert(0, str(REPO / "backend"))

import pytest

from benchmarks.regression_tests.loader import golden_files_present
from benchmarks.regression_tests.runner import run_level1, run_level2, run_level3


def test_level1_synthetic_benchmark():
    r = run_level1()
    assert r["passed"], r.get("errors")


def test_level2_golden_benchmark():
    if not golden_files_present():
        pytest.skip(
            "Golden benchmark files not installed — copy 6 files to benchmarks/golden_benchmark/files/"
        )
    r = run_level2()
    assert r["passed"], r.get("errors")


@pytest.mark.parametrize("variant", ["en_columns", "incomplete_data", "messy_headers"])
def test_level3_client_variant(variant: str):
    results = run_level3()
    by_name = {x["name"]: x for x in results}
    r = by_name.get(variant)
    assert r is not None, f"variant {variant} not found"
    assert r["passed"], r.get("errors")
