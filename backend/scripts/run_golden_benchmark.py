#!/usr/bin/env python3
"""Golden Benchmark — one command via Benchmark Manager (شغّل Golden Benchmark)."""

from __future__ import annotations

import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO))
sys.path.insert(0, str(REPO / "backend"))

from benchmarks.regression_tests.golden_benchmark import (  # noqa: E402
    format_summary_ar,
    run_golden_benchmark,
    save_artifacts,
)


def main() -> int:
    report = run_golden_benchmark()
    save_artifacts(report)
    print(format_summary_ar(report))
    if report.get("status") in ("awaiting_setup", "awaiting_files"):
        return 2
    return 0 if report.get("ok") else 1


if __name__ == "__main__":
    sys.exit(main())
