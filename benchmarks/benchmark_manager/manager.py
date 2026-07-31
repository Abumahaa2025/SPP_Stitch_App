"""Benchmark Manager — facade over in-project Benchmark Library."""

from __future__ import annotations

from typing import Any, Dict, Optional

from .library import BenchmarkLibrary


class BenchmarkManager:
    """SPP Benchmark Manager — no external paths, library-backed."""

    def __init__(self) -> None:
        self._lib = BenchmarkLibrary()

    @property
    def library(self) -> BenchmarkLibrary:
        return self._lib

    def status(self) -> Dict[str, Any]:
        return self._lib.status()

    def prepare_for_run(self, set_id: Optional[str] = None) -> Dict[str, Any]:
        sid = set_id or self._lib.active_set_id()
        if not self._lib.is_ready(sid):
            return {
                "ok": False,
                "status": "not_ready",
                "set_id": sid,
                "message_ar": (
                    f"مجموعة {sid} غير جاهزة. ارفق الملفات عبر Attach في Cursor "
                    "ثم قل: شغّل Golden Benchmark"
                ),
            }
        return {
            "ok": True,
            "status": "ready",
            "set_id": sid,
            "files": [p.name for p in self._lib.files_dir(sid).iterdir() if p.is_file()],
        }

    def replace(self, set_id: str = "golden") -> Dict[str, Any]:
        return self._lib.replace_set(set_id)

    def import_staging(self, set_id: str = "golden") -> Dict[str, Any]:
        return self._lib.import_from_staging(set_id)

    def run_set(self, set_id: Optional[str] = None) -> str:
        sid = set_id or self._lib.active_set_id()
        self._lib.set_active(sid)
        return sid


def get_manager() -> BenchmarkManager:
    return BenchmarkManager()
