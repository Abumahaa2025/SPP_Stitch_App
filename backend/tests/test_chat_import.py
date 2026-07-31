"""Tests for chat attachment import (infrastructure only — not golden data)."""

from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO))

from benchmarks.benchmark_manager.chat_import import collect_paths, import_from_chat, normalize_path


def test_normalize_path_strips_quotes():
    with tempfile.NamedTemporaryFile(suffix=".csv", delete=False) as f:
        f.write(b"a,b\n1,2\n")
        raw = f'"{f.name}"'
    try:
        p = normalize_path(raw)
        assert p is not None
        assert p.suffix == ".csv"
    finally:
        Path(f.name).unlink(missing_ok=True)


def test_collect_paths_from_list(tmp_path):
    f1 = tmp_path / "a.csv"
    f2 = tmp_path / "b.xlsx"
    f1.write_text("x,y\n1,2\n", encoding="utf-8")
    f2.write_bytes(b"")
    paths = collect_paths(cli_paths=[str(f1), str(f2)])
    assert len(paths) == 2


def test_import_from_chat_copies_to_library(tmp_path, monkeypatch):
    # Use a temp library root — never touch real golden files.
    import benchmarks.benchmark_manager.library as lib_mod
    from benchmarks.benchmark_manager.library import BenchmarkLibrary

    monkeypatch.setattr(lib_mod, "SETS_DIR", tmp_path / "sets")
    monkeypatch.setattr(lib_mod, "REGISTRY_PATH", tmp_path / "registry.json")
    monkeypatch.setattr(lib_mod, "ACTIVE_PATH", tmp_path / "active.json")
    (tmp_path / "sets" / "golden").mkdir(parents=True)
    (tmp_path / "registry.json").write_text(
        json.dumps({"sets": {"golden": {"id": "golden", "required_files": 6}}, "default_set": "golden"}),
        encoding="utf-8",
    )
    (tmp_path / "sets" / "golden" / "expected.json").write_text(
        json.dumps({"required_file_count": 6}),
        encoding="utf-8",
    )

    files = []
    for i in range(6):
        p = tmp_path / f"month_{i}.csv"
        p.write_text(f"unit,tenant,rent,status\n{i},t{i},1000,paid\n", encoding="utf-8")
        files.append(p)
    result = import_from_chat(files, set_id="golden", lib=BenchmarkLibrary())
    assert result.get("ok"), result
    assert len(result.get("imported") or []) == 6
    assert result.get("source") == "chat_attachments"
