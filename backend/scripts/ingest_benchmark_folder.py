#!/usr/bin/env python3
"""Copy benchmark files from a local folder into golden or client variant storage."""

from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
BENCHMARKS = REPO / "benchmarks"


def main() -> int:
    p = argparse.ArgumentParser(description="Ingest benchmark files into SPP benchmarks/")
    p.add_argument("--source", required=True, help="Folder containing benchmark files")
    p.add_argument(
        "--target",
        choices=("golden",),
        default="golden",
        help="Benchmark target (golden = your 6 official files)",
    )
    p.add_argument("--clear", action="store_true", help="Clear target files/ before copy")
    args = p.parse_args()

    src = Path(args.source)
    if not src.is_dir():
        print(f"Source not found: {src}", file=sys.stderr)
        return 1

    dst = BENCHMARKS / "golden_benchmark" / "files"
    dst.mkdir(parents=True, exist_ok=True)

    if args.clear:
        for f in dst.glob("*"):
            if f.is_file() and f.name != ".gitkeep":
                f.unlink()

    copied = 0
    for f in sorted(src.iterdir()):
        if f.is_file() and f.suffix.lower() in (".csv", ".xlsx", ".xls", ".txt"):
            shutil.copy2(f, dst / f.name)
            copied += 1
            print(f"  copied: {f.name}")

    print(f"\n{copied} file(s) → {dst}")
    if copied < 6:
        print("Warning: golden benchmark expects 6 files.", file=sys.stderr)
    print("Run: cd backend && python scripts/run_benchmark_gate.py --level 2")
    return 0


if __name__ == "__main__":
    sys.exit(main())
