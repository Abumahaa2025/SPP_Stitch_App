"""Text and identifier normalization — no owner-specific assumptions."""

from __future__ import annotations

import hashlib
import re
import unicodedata

_ARABIC_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")
_EASTERN_DIGITS = str.maketrans("۰۱۲۳۴۵۶۷۸۹", "0123456789")


def clean_text(value: object) -> str:
    if value is None:
        return ""
    text = unicodedata.normalize("NFKC", str(value)).strip()
    text = text.translate(_ARABIC_DIGITS).translate(_EASTERN_DIGITS)
    return re.sub(r"\s+", " ", text)


def normalize_unit_label(value: object) -> str:
    """Stable display label for a unit — strips noise, keeps human meaning."""
    text = clean_text(value).lower()
    text = re.sub(r"^(unit|apt|apartment|flat|office|shop|وحدة|شقة|مكتب)\s*[#:\-]?\s*", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text or "unit"


def stable_id(*parts: object, prefix: str = "id") -> str:
    raw = "|".join(clean_text(p).lower() for p in parts if clean_text(p))
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:10]
    return f"{prefix}_{digest}"
