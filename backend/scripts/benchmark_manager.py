#!/usr/bin/env python3
"""
SPP Benchmark Manager — مكتبة داخل المشروع (بدون مسارات Windows).

أوامر Cursor:
  استورد ملفات Golden Benchmark   ← يفتح File Picker ثم خط الإنتاج
  شغّل Golden Benchmark             ← نفس الأمر إن كانت الملفات محفوظة

CLI:
  python backend/scripts/import_golden_benchmark.py
  python backend/scripts/benchmark_manager.py status
  python backend/scripts/benchmark_manager.py replace golden
  python backend/scripts/benchmark_manager.py run
  python backend/scripts/benchmark_manager.py run --set client_2
  python backend/scripts/benchmark_manager.py list
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO))
sys.path.insert(0, str(REPO / "backend"))

from benchmarks.benchmark_manager import get_manager  # noqa: E402
from benchmarks.regression_tests.golden_benchmark import (  # noqa: E402
    format_summary_ar,
    run_golden_benchmark,
    save_artifacts,
)


def main() -> int:
    p = argparse.ArgumentParser(description="SPP Benchmark Manager")
    sub = p.add_subparsers(dest="cmd", required=True)

    sub.add_parser("status", help="Library status")
    sub.add_parser("list", help="List benchmark sets")
    r = sub.add_parser("replace", help="Import from _staging into set")
    r.add_argument("set_id", nargs="?", default="golden")
    imp = sub.add_parser("import", help="Alias for replace")
    imp.add_argument("set_id", nargs="?", default="golden")
    run = sub.add_parser("run", help="Run benchmark on set")
    run.add_argument("--set", default=None)
    chat = sub.add_parser("from-chat", help="Import from attachment paths and run")
    chat.add_argument("files", nargs="*", help="Attached file paths")
    chat.add_argument("--set", default="golden")

    args = p.parse_args()
    mgr = get_manager()

    if args.cmd == "status":
        print(json.dumps(mgr.status(), ensure_ascii=False, indent=2))
        return 0

    if args.cmd == "list":
        print(json.dumps(mgr.library.list_sets_status(), ensure_ascii=False, indent=2))
        return 0

    if args.cmd in ("replace", "import"):
        set_id = getattr(args, "set_id", "golden")
        result = mgr.replace(set_id)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0 if result.get("ok") else 1

    if args.cmd == "run":
        set_id = args.set or mgr.library.active_set_id()
        mgr.run_set(set_id)
        report = run_golden_benchmark(set_id)
        save_artifacts(report)
        print(format_summary_ar(report))
        if report.get("status") == "awaiting_import":
            return 2
        return 0 if report.get("ok") else 1

    if args.cmd == "from-chat":
        from subprocess import run as subprocess_run

        cmd = [sys.executable, str(REPO / "backend" / "scripts" / "golden_from_chat.py"), *args.files]
        if args.set:
            cmd.extend(["--set", args.set])
        return subprocess_run(cmd, cwd=str(REPO)).returncode

    return 1


if __name__ == "__main__":
    sys.exit(main())
