#!/usr/bin/env python3
"""
Golden Benchmark من مرفقات Cursor — نفس خط الإنتاج (Production Pipeline).

الوكيل يشغّله بعد Attach:
  python backend/scripts/golden_from_chat.py "PATH1" "PATH2" ...
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO))
sys.path.insert(0, str(REPO / "backend"))
sys.path.insert(0, str(REPO / "backend" / "scripts"))

from adapters.upload_analysis.upload_files_meta import build_upload_files_meta_from_paths  # noqa: E402
from benchmarks.benchmark_manager.chat_import import (  # noqa: E402
    chat_import_status,
    collect_paths,
    import_from_chat,
)
from benchmarks.benchmark_manager import get_manager  # noqa: E402
from benchmarks.regression_tests.golden_benchmark import (  # noqa: E402
    format_summary_ar,
    run_golden_benchmark,
    save_artifacts,
)
from golden_understanding_report import (  # noqa: E402
    OUTPUT_JSON as UNDERSTANDING_JSON,
    OUTPUT_TXT as UNDERSTANDING_TXT,
    _format_txt,
    run_full_report,
    run_full_report_from_paths,
)


def main() -> int:
    p = argparse.ArgumentParser(description="Golden Benchmark — production pipeline from chat attachments")
    p.add_argument("files", nargs="*", help="File absolute paths (optional if --pick)")
    p.add_argument("--pick", action="store_true", help="Open native file picker")
    p.add_argument("--manifest", type=Path, help="JSON manifest with paths")
    p.add_argument("--set", default="golden")
    p.add_argument("--check-only", action="store_true")
    p.add_argument("--skip-archive", action="store_true", help="Do not copy files into library")
    args = p.parse_args()

    if args.pick:
        from benchmarks.benchmark_manager.file_picker import pick_spreadsheet_files

        paths = pick_spreadsheet_files()
    else:
        paths = collect_paths(cli_paths=args.files, manifest_path=args.manifest)
    status = chat_import_status(paths)

    if args.check_only:
        print(json.dumps(status, ensure_ascii=False, indent=2))
        return 0 if status.get("ready") else 2

    if not paths:
        print(json.dumps({
            "ok": False,
            "message_ar": "ارفق الملفات الستة عبر Attach (+) ثم قل: شغّل Golden Benchmark",
        }, ensure_ascii=False, indent=2))
        return 2

    files_meta = build_upload_files_meta_from_paths(paths)
    print(json.dumps({
        "ok": True,
        "step": "production_pipeline",
        "files": [f.get("name") for f in files_meta],
        "payload_shape": "upload/portfolio-analysis",
    }, ensure_ascii=False, indent=2))

    report = run_full_report_from_paths(paths)
    UNDERSTANDING_JSON.parent.mkdir(parents=True, exist_ok=True)
    UNDERSTANDING_JSON.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    UNDERSTANDING_TXT.write_text(_format_txt(report), encoding="utf-8")

    if not args.skip_archive:
        imp = import_from_chat(paths, set_id=args.set)
        print(json.dumps(imp, ensure_ascii=False, indent=2))
        bench = run_golden_benchmark(args.set)
        save_artifacts(bench)
        print("\n" + format_summary_ar(bench))

    print("\n" + _format_txt(report))

    if report.get("status") in ("awaiting_import", "awaiting_setup"):
        return 2
    return 0 if report.get("benchmark_ok") else 1


if __name__ == "__main__":
    sys.exit(main())
