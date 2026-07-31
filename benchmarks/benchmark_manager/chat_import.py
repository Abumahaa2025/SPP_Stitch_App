"""Import benchmark files from Cursor chat attachments — no manual staging."""

from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Union

from .library import SPREADSHEET_EXT, BenchmarkLibrary

PathLike = Union[str, Path]

# Cursor may pass paths with quotes or file:// prefix
_PATH_PREFIX_RE = re.compile(r"^file:///?", re.I)


def normalize_path(raw: str) -> Optional[Path]:
    s = (raw or "").strip().strip('"').strip("'")
    if not s:
        return None
    s = _PATH_PREFIX_RE.sub("", s)
    p = Path(s).expanduser()
    try:
        p = p.resolve()
    except OSError:
        return None
    if p.is_file() and p.suffix.lower() in SPREADSHEET_EXT:
        return p
    return None


def collect_paths(
    cli_paths: Optional[Iterable[PathLike]] = None,
    manifest_path: Optional[PathLike] = None,
) -> List[Path]:
    """Gather spreadsheet paths from CLI args, manifest JSON, or env."""
    found: List[Path] = []
    seen: set[str] = set()

    def add(raw: str) -> None:
        p = normalize_path(raw)
        if p and str(p) not in seen:
            seen.add(str(p))
            found.append(p)

    for raw in cli_paths or []:
        add(str(raw))

    env_json = os.environ.get("SPP_BENCHMARK_FILES")
    if env_json:
        try:
            data = json.loads(env_json)
            if isinstance(data, list):
                for item in data:
                    add(str(item))
            elif isinstance(data, dict):
                for item in data.get("paths") or data.get("files") or []:
                    add(str(item))
        except json.JSONDecodeError:
            pass

    if manifest_path:
        mp = Path(manifest_path)
        if mp.is_file():
            data = json.loads(mp.read_text(encoding="utf-8"))
            for item in data.get("paths") or data.get("files") or []:
                if isinstance(item, dict):
                    add(str(item.get("path") or item.get("name") or ""))
                else:
                    add(str(item))

    return sorted(found, key=lambda p: p.name)


def import_from_chat(
    paths: Iterable[PathLike],
    set_id: str = "golden",
    lib: Optional[BenchmarkLibrary] = None,
) -> Dict[str, Any]:
    """Copy chat-attached files into library set — single step, no staging."""
    library = lib or BenchmarkLibrary()
    resolved = collect_paths(cli_paths=paths)
    if not resolved:
        return {
            "ok": False,
            "status": "no_attachments",
            "message_ar": (
                "لم أجد ملفات مرفقة. ارفق الملفات عبر Attach (+) في Cursor "
                "ثم قل: شغّل Golden Benchmark"
            ),
        }
    result = library.import_files(set_id, resolved)
    result["source"] = "chat_attachments"
    result["resolved_paths"] = [str(p) for p in resolved]
    return result


def chat_import_status(paths: Iterable[PathLike]) -> Dict[str, Any]:
    resolved = collect_paths(cli_paths=paths)
    return {
        "count": len(resolved),
        "files": [{"path": str(p), "name": p.name, "size": p.stat().st_size} for p in resolved],
        "ready": len(resolved) >= 6,
    }
