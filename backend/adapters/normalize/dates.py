"""Date parsing without locale-specific sheet layout assumptions."""

from __future__ import annotations

import re
from datetime import date, datetime, timezone
from typing import Optional

from adapters.normalize.text import clean_text

_ISO = re.compile(r"(\d{4})[-/](\d{1,2})[-/](\d{1,2})")
_DMY = re.compile(r"(\d{1,2})[-/](\d{1,2})[-/](\d{4})")


def parse_date(value: object) -> Optional[str]:
    """Return ISO date YYYY-MM-DD or None."""
    text = clean_text(value)
    if not text:
        return None
    m = _ISO.search(text)
    if m:
        y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
    else:
        m = _DMY.search(text)
        if not m:
            return None
        d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
    try:
        return date(y, mo, d).isoformat()
    except ValueError:
        return None


def days_until(iso_date: Optional[str], *, today: Optional[date] = None) -> Optional[int]:
    if not iso_date:
        return None
    try:
        end = date.fromisoformat(iso_date[:10])
    except ValueError:
        return None
    ref = today or datetime.now(timezone.utc).date()
    return (end - ref).days
