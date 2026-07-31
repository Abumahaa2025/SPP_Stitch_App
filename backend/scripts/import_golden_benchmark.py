#!/usr/bin/env python3
"""
استورد ملفات Golden Benchmark — نافذة اختيار ملفات أصلية ثم خط الإنتاج.

الاستخدام:
  python backend/scripts/import_golden_benchmark.py
  أو من Cursor: قل «استورد ملفات Golden Benchmark» فيشغّل الوكيل هذا السكربت.

يفتح File Picker → تختار الملفات → يعمل نفس Universal Import Engine.
لا مجلد _staging ولا نسخ يدوي من المستخدم.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO))
sys.path.insert(0, str(REPO / "backend"))
sys.path.insert(0, str(REPO / "backend" / "scripts"))

from adapters.upload_analysis.upload_files_meta import build_upload_files_meta_from_paths  # noqa: E402
from benchmarks.benchmark_manager.file_picker import pick_spreadsheet_files  # noqa: E402
from benchmarks.benchmark_manager.chat_import import import_from_chat  # noqa: E402
from benchmarks.regression_tests.golden_benchmark import (  # noqa: E402
    format_summary_ar,
    run_golden_benchmark,
    save_artifacts,
)
from benchmarks.regression_tests.loader import expected_path, load_json  # noqa: E402
from golden_understanding_report import (  # noqa: E402
    OUTPUT_JSON as UNDERSTANDING_JSON,
    OUTPUT_TXT as UNDERSTANDING_TXT,
    _format_txt,
    run_full_report_from_paths,
)


def main() -> int:
    expected = load_json(expected_path("golden")) if expected_path("golden").is_file() else {}
    need = int(expected.get("required_file_count") or 6)

    print("=" * 50)
    print("استورد ملفات Golden Benchmark")
    print(f"اختر الملفات من النافذة (المطلوب عادةً {need}+ ملف)")
    print("=" * 50)
    sys.stdout.flush()

    try:
        paths = pick_spreadsheet_files(
            title=f"SPP — اختر ملفات Golden Benchmark ({need} ملفات)",
        )
    except RuntimeError as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False, indent=2))
        return 2

    if not paths:
        print(json.dumps({
            "ok": False,
            "status": "cancelled",
            "message_ar": "أُلغيت نافذة الاختيار — لم يُختر أي ملف",
        }, ensure_ascii=False, indent=2))
        return 2

    print(json.dumps({
        "ok": True,
        "step": "picked",
        "count": len(paths),
        "files": [p.name for p in paths],
        "paths": [str(p) for p in paths],
        "pipeline": "production (same as /upload/portfolio-analysis)",
    }, ensure_ascii=False, indent=2))
    sys.stdout.flush()

    if len(paths) < need:
        print(json.dumps({
            "ok": False,
            "status": "insufficient_files",
            "message_ar": f"اخترت {len(paths)} — المطلوب على الأقل {need}",
            "files": [p.name for p in paths],
        }, ensure_ascii=False, indent=2))
        return 2

    files_meta = build_upload_files_meta_from_paths(paths)
    print(json.dumps({
        "ok": True,
        "step": "production_pipeline",
        "payload_shape": "upload/portfolio-analysis",
        "files": [f.get("name") for f in files_meta],
    }, ensure_ascii=False, indent=2))
    sys.stdout.flush()

    report = run_full_report_from_paths(paths)
    UNDERSTANDING_JSON.parent.mkdir(parents=True, exist_ok=True)
    UNDERSTANDING_JSON.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    UNDERSTANDING_TXT.write_text(_format_txt(report), encoding="utf-8")

    # Archive into library for repeat runs (engine already ran on original paths)
    imp = import_from_chat(paths, set_id="golden")
    print(json.dumps(imp, ensure_ascii=False, indent=2))

    bench = run_golden_benchmark("golden")
    save_artifacts(bench)
    print("\n" + format_summary_ar(bench))
    print("\n" + _format_txt(report))

    if report.get("status") in ("awaiting_import", "awaiting_setup"):
        return 2
    return 0 if report.get("benchmark_ok") else 1


if __name__ == "__main__":
    sys.exit(main())
