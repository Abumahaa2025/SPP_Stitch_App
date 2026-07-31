"""Load benchmark manifests and file payloads for regression tests."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Tuple

REPO_ROOT = Path(__file__).resolve().parents[2]
BENCHMARKS_ROOT = REPO_ROOT / "benchmarks"


def repo_root() -> Path:
    return REPO_ROOT


def benchmarks_root() -> Path:
    return BENCHMARKS_ROOT


def load_json(path: Path) -> dict:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def save_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def _xlsx_to_csv_snippet(path: Path) -> str:
    from adapters.upload_analysis.upload_files_meta import read_file_as_snippet

    return read_file_as_snippet(path)


def _read_file_text(path: Path) -> str:
    from adapters.upload_analysis.upload_files_meta import read_file_as_snippet

    return read_file_as_snippet(path)


def _active_set_id() -> str:
    active = BENCHMARKS_ROOT / "library" / "active.json"
    if active.is_file():
        return load_json(active).get("active_set") or "golden"
    return "golden"


def golden_files_dir(set_id: str | None = None) -> Path:
    """Files for active (or given) benchmark set — inside project library."""
    sid = set_id or _active_set_id()
    lib_dir = BENCHMARKS_ROOT / "library" / "sets" / sid / "files"
    if lib_dir.is_dir() and any(lib_dir.iterdir()):
        return lib_dir
    legacy = BENCHMARKS_ROOT / "golden_benchmark" / "files"
    if legacy.is_dir():
        return legacy
    return lib_dir


def list_golden_files(set_id: str | None = None) -> List[Path]:
    return sorted(
        p for p in golden_files_dir(set_id).glob("*")
        if p.is_file() and p.suffix.lower() in (".csv", ".xlsx", ".xls", ".xlsm")
    )


def expected_path(set_id: str | None = None) -> Path:
    sid = set_id or _active_set_id()
    p = BENCHMARKS_ROOT / "library" / "sets" / sid / "expected.json"
    if p.is_file():
        return p
    return BENCHMARKS_ROOT / "golden_benchmark" / "expected.json"


def golden_files_present(set_id: str | None = None) -> bool:
    real = list_golden_files(set_id)
    exp = load_json(expected_path(set_id))
    required = int(exp.get("required_file_count") or 6)
    return len(real) >= required


def files_from_paths(paths: List[Path]) -> List[dict]:
    """Production-shaped files[] from disk — same payload as mobile upload API."""
    from adapters.upload_analysis.upload_files_meta import build_upload_files_meta_from_paths

    return build_upload_files_meta_from_paths(paths)


def files_from_manifest(manifest_path: Path) -> Tuple[dict, List[dict]]:
    manifest = load_json(manifest_path)
    base = manifest_path.parent
    files_meta: List[dict] = []

    rel_paths = manifest.get("files") or []
    if not rel_paths:
        files_dir = golden_files_dir()
        sub = files_dir.relative_to(base) if files_dir.is_relative_to(base) else Path("files")
        rel_paths = [f"{sub}/{p.name}".replace("\\", "/") for p in list_golden_files()]

    for rel in rel_paths:
        fp = base / rel if not Path(rel).is_absolute() else Path(rel)
        if not fp.is_file():
            fp = golden_files_dir() / Path(rel).name
        if not fp.is_file():
            raise FileNotFoundError(f"Benchmark file missing: {rel}")
        text = _read_file_text(fp)
        mime = "text/csv"
        if fp.suffix.lower() in (".xlsx", ".xls"):
            mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        files_meta.append({"name": fp.name, "textSnippet": text, "mimeType": mime})

    return manifest, files_meta


def list_client_variants() -> List[Path]:
    root = BENCHMARKS_ROOT / "client_variants"
    return sorted(root.glob("*/manifest.json"))
