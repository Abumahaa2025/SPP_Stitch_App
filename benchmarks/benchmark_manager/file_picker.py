"""Native OS file picker for Golden Benchmark — no Cursor Attach, no staging."""

from __future__ import annotations

from pathlib import Path
from typing import List, Optional

SPREADSHEET_TYPES = [
    ("Spreadsheets", "*.xlsx *.xls *.xlsm *.csv"),
    ("Excel", "*.xlsx *.xls *.xlsm"),
    ("CSV", "*.csv"),
    ("All files", "*.*"),
]


def pick_spreadsheet_files(
    title: str = "اختر ملفات Golden Benchmark",
    initial_dir: Optional[str] = None,
) -> List[Path]:
    """
    Open a native multi-select file dialog (Windows / macOS / Linux via tkinter).
    Returns absolute paths. Empty list if user cancels.
    """
    try:
        import tkinter as tk
        from tkinter import filedialog
    except ImportError as exc:
        raise RuntimeError(
            "tkinter غير متوفر — ثبّت Python مع tkinter أو شغّل من بيئة تدعمه"
        ) from exc

    root = tk.Tk()
    root.withdraw()
    try:
        root.attributes("-topmost", True)
    except tk.TclError:
        pass
    root.update()

    kwargs = {
        "title": title,
        "filetypes": SPREADSHEET_TYPES,
        "multiple": True,
    }
    if initial_dir and Path(initial_dir).is_dir():
        kwargs["initialdir"] = initial_dir

    selected = filedialog.askopenfilenames(**kwargs)
    root.destroy()

    out: List[Path] = []
    for raw in selected or ():
        p = Path(raw).expanduser().resolve()
        if p.is_file():
            out.append(p)
    return sorted(out, key=lambda p: p.name)
