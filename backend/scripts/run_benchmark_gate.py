#!/usr/bin/env python3
"""Pre-deploy benchmark gate — Levels 1, 2, 3 must pass before Render deploy."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO))
sys.path.insert(0, str(REPO / "backend"))

from benchmarks.regression_tests.runner import run_all  # noqa: E402


def main() -> int:
    p = argparse.ArgumentParser(description="SPP benchmark regression gate")
    p.add_argument("--level", type=int, action="append", help="Run specific level(s) 1, 2, or 3")
    p.add_argument("--json", action="store_true", help="Print JSON report")
    args = p.parse_args()

    levels = args.level or [1, 2, 3]
    report = run_all(levels)

    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        for key, val in report.get("levels", {}).items():
            if isinstance(val, list):
                for item in val:
                    status = "PASS" if item.get("passed") else "FAIL"
                    print(f"[{status}] Level 3 — {item.get('name')}")
                    for e in item.get("errors") or []:
                        print(f"  - {e}")
            else:
                status = "PASS" if val.get("passed") else "FAIL"
                print(f"[{status}] {key}")
                for e in val.get("errors") or []:
                    print(f"  - {e}")
        print(f"\nOverall: {'PASS' if report.get('passed') else 'FAIL'}")

    return 0 if report.get("passed") else 1


if __name__ == "__main__":
    sys.exit(main())
