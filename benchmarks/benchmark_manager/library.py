"""SPP Benchmark Library — managed in-project test sets (device-independent)."""

from __future__ import annotations

import hashlib
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

from benchmarks.regression_tests.loader import BENCHMARKS_ROOT, load_json, save_json

LIBRARY_ROOT = BENCHMARKS_ROOT / "library"
REGISTRY_PATH = LIBRARY_ROOT / "registry.json"
ACTIVE_PATH = LIBRARY_ROOT / "active.json"
STAGING_DIR = LIBRARY_ROOT / "_staging"
SETS_DIR = LIBRARY_ROOT / "sets"

SPREADSHEET_EXT = {".csv", ".xlsx", ".xls", ".xlsm"}


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _fingerprint(path: Path) -> dict:
    st = path.stat()
    h = hashlib.sha256()
    h.update(path.read_bytes())
    return {"name": path.name, "size": st.st_size, "mtime": int(st.st_mtime), "sha256": h.hexdigest()}


def list_spreadsheets(folder: Path) -> List[Path]:
    if not folder.is_dir():
        return []
    return sorted(p for p in folder.iterdir() if p.is_file() and p.suffix.lower() in SPREADSHEET_EXT)


class BenchmarkLibrary:
    """In-project benchmark library — no external Windows paths."""

    def __init__(self) -> None:
        self._registry = load_json(REGISTRY_PATH) if REGISTRY_PATH.is_file() else {"sets": {}}
        self._active = load_json(ACTIVE_PATH) if ACTIVE_PATH.is_file() else {"active_set": "golden"}

    def _save_active(self) -> None:
        save_json(ACTIVE_PATH, self._active)

    def registry_sets(self) -> Dict[str, dict]:
        return self._registry.get("sets") or {}

    def active_set_id(self) -> str:
        return self._active.get("active_set") or self._registry.get("default_set") or "golden"

    def set_active(self, set_id: str) -> None:
        if set_id not in self.registry_sets():
            raise KeyError(f"Unknown benchmark set: {set_id}")
        self._active["active_set"] = set_id
        self._save_active()

    def set_dir(self, set_id: str) -> Path:
        return SETS_DIR / set_id

    def files_dir(self, set_id: Optional[str] = None) -> Path:
        return self.set_dir(set_id or self.active_set_id()) / "files"

    def expected_path(self, set_id: Optional[str] = None) -> Path:
        return self.set_dir(set_id or self.active_set_id()) / "expected.json"

    def meta_path(self, set_id: str) -> Path:
        return self.set_dir(set_id) / "meta.json"

    def report_path(self, set_id: Optional[str] = None) -> Path:
        return self.set_dir(set_id or self.active_set_id()) / "latest_report.json"

    def summary_path(self, set_id: Optional[str] = None) -> Path:
        return self.set_dir(set_id or self.active_set_id()) / "latest_summary.txt"

    def required_count(self, set_id: Optional[str] = None) -> int:
        sid = set_id or self.active_set_id()
        reg = self.registry_sets().get(sid) or {}
        exp = load_json(self.expected_path(sid)) if self.expected_path(sid).is_file() else {}
        return int(exp.get("required_file_count") or reg.get("required_files") or 6)

    def is_ready(self, set_id: Optional[str] = None) -> bool:
        sid = set_id or self.active_set_id()
        return len(list_spreadsheets(self.files_dir(sid))) >= self.required_count(sid)

    def list_sets_status(self) -> List[Dict[str, Any]]:
        out = []
        for sid, reg in self.registry_sets().items():
            files = list_spreadsheets(self.files_dir(sid))
            meta = load_json(self.meta_path(sid)) if self.meta_path(sid).is_file() else {}
            out.append(
                {
                    "id": sid,
                    "name_ar": reg.get("name_ar"),
                    "kind": reg.get("kind"),
                    "required_files": reg.get("required_files"),
                    "stored_files": len(files),
                    "ready": len(files) >= int(reg.get("required_files") or 0),
                    "active": sid == self.active_set_id(),
                    "imported_at": meta.get("imported_at"),
                    "file_names": [p.name for p in files],
                }
            )
        return out

    def status(self) -> Dict[str, Any]:
        sid = self.active_set_id()
        return {
            "library": "benchmark-library-v1",
            "active_set": sid,
            "active_ready": self.is_ready(sid),
            "staging_files": [p.name for p in list_spreadsheets(STAGING_DIR)],
            "sets": self.list_sets_status(),
            "commands": self._registry.get("commands_ar") or {},
        }

    def _copy_into_set(self, set_id: str, sources: List[Path]) -> List[str]:
        dest_dir = self.files_dir(set_id)
        dest_dir.mkdir(parents=True, exist_ok=True)
        for old in dest_dir.glob("*"):
            if old.is_file():
                old.unlink()
        copied = []
        for src in sources:
            dest = dest_dir / src.name
            shutil.copy2(src, dest)
            copied.append(src.name)
        fps = [_fingerprint(dest_dir / n) for n in copied]
        meta = {
            "set_id": set_id,
            "imported_at": _utc_now(),
            "file_count": len(copied),
            "files": fps,
            "source": "benchmark_library",
        }
        save_json(self.meta_path(set_id), meta)
        return copied

    def import_files(self, set_id: str, sources: Iterable[Path]) -> Dict[str, Any]:
        """Copy files into library set (in-project storage)."""
        if set_id not in self.registry_sets():
            raise KeyError(f"Unknown benchmark set: {set_id}")

        src_list = [Path(s).resolve() for s in sources if Path(s).is_file()]
        src_list = [p for p in src_list if p.suffix.lower() in SPREADSHEET_EXT]
        need = self.required_count(set_id)
        if len(src_list) < need:
            return {
                "ok": False,
                "error": "insufficient_files",
                "message_ar": f"المطلوب {need} ملفات — وُجد {len(src_list)}",
                "set_id": set_id,
            }
        copied = self._copy_into_set(set_id, sorted(src_list, key=lambda p: p.name))
        if len(copied) < need:
            return {"ok": False, "message_ar": f"نُسخ {len(copied)} فقط — المطلوب {need}", "set_id": set_id}
        self.set_active(set_id)
        return {
            "ok": True,
            "set_id": set_id,
            "imported": copied,
            "message_ar": f"تم حفظ {len(copied)} ملفاً داخل المشروع — مجموعة {set_id}",
            "storage": str(self.files_dir(set_id)),
        }

    def import_from_staging(self, set_id: str) -> Dict[str, Any]:
        """Import all spreadsheets from library/_staging/ into a set."""
        STAGING_DIR.mkdir(parents=True, exist_ok=True)
        files = list_spreadsheets(STAGING_DIR)
        if not files:
            return {
                "ok": False,
                "error": "staging_empty",
                "message_ar": (
                    "ضع الملفات في benchmarks/library/_staging/ ثم قل: استبدل Golden Benchmark"
                ),
                "staging_path": str(STAGING_DIR),
            }
        result = self.import_files(set_id, files)
        if result.get("ok"):
            for p in files:
                try:
                    p.unlink()
                except OSError:
                    pass
            result["staging_cleared"] = True
        return result

    def replace_set(self, set_id: str) -> Dict[str, Any]:
        """استبدل Golden Benchmark — import from staging."""
        return self.import_from_staging(set_id)

    def discover_project_files(self, *patterns: str) -> List[Path]:
        """Find recently added spreadsheets anywhere under benchmarks/ (not library sets)."""
        found: List[Path] = []
        for base in (STAGING_DIR, BENCHMARKS_ROOT / "golden_benchmark" / "files"):
            if base.is_dir():
                found.extend(list_spreadsheets(base))
        return found
