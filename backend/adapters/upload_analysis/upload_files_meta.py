"""Build upload file payloads — same shape the mobile client sends to /upload/portfolio-analysis."""

from __future__ import annotations

from pathlib import Path
from typing import Iterable, List, Union

SNIPPET_MAX = 120_000
EXCEL_MAX_BYTES = 8_000_000
SPREADSHEET_EXT = {".csv", ".xlsx", ".xls", ".xlsm", ".txt", ".tsv"}


def _xlsx_to_csv_snippet(path: Path) -> str:
    try:
        import openpyxl
    except ImportError as e:
        raise RuntimeError("openpyxl required for .xlsx: pip install openpyxl") from e

    if path.stat().st_size > EXCEL_MAX_BYTES:
        return ""
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb.active
    lines: List[str] = []
    for row in ws.iter_rows(values_only=True):
        cells = [str(c).strip() if c is not None else "" for c in row]
        if any(cells):
            lines.append(",".join(cells))
    wb.close()
    text = "\n".join(lines)
    return text[:SNIPPET_MAX]


def read_file_as_snippet(path: Path) -> str:
    """Read spreadsheet as text snippet (mirrors client readPropertyFileSnippet output)."""
    suffix = path.suffix.lower()
    if suffix in (".xlsx", ".xlsm", ".xls"):
        return _xlsx_to_csv_snippet(path)
    raw = path.read_text(encoding="utf-8-sig")
    return raw[:SNIPPET_MAX]


def build_upload_file_meta(path: Path) -> dict:
    """One file — identical keys to frontend buildUploadFileMeta()."""
    suffix = path.suffix.lower()
    is_excel = suffix in (".xlsx", ".xls", ".xlsm")
    mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" if is_excel else "text/csv"
    if suffix == ".txt":
        mime = "text/plain"
    snippet = read_file_as_snippet(path)
    meta: dict = {
        "name": path.name,
        "mimeType": mime,
        "size": path.stat().st_size,
    }
    if snippet:
        meta["textSnippet"] = snippet
    if snippet and is_excel:
        meta["parsedFromExcel"] = True
    return meta


def build_upload_files_meta_from_paths(paths: Iterable[Union[str, Path]]) -> List[dict]:
    """Build API-ready files[] from disk paths — no benchmark-specific fields."""
    out: List[dict] = []
    for raw in paths:
        p = Path(raw).resolve()
        if p.is_file() and p.suffix.lower() in SPREADSHEET_EXT:
            out.append(build_upload_file_meta(p))
    return sorted(out, key=lambda x: x.get("name") or "")


def build_upload_files_meta_from_dicts(files: List[dict]) -> List[dict]:
    """Normalize already-built payloads (e.g. from API request) — pass-through with defaults."""
    out: List[dict] = []
    for f in files:
        out.append(
            {
                "name": f.get("name") or "",
                "mimeType": f.get("mimeType") or f.get("mime") or "",
                "size": f.get("size"),
                "textSnippet": f.get("textSnippet") or f.get("contentPreview") or "",
                "parsedFromExcel": bool(f.get("parsedFromExcel")),
            }
        )
    return out
