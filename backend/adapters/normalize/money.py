"""Parse monetary amounts from any common string/number format."""

from __future__ import annotations

import re

from adapters.normalize.text import clean_text


def parse_money(value: object, default: float = 0.0) -> float:
    if value is None:
        return default
    if isinstance(value, (int, float)):
        return float(value)
    text = clean_text(value)
    if not text:
        return default
    text = re.sub(r"[^\d.,\-]", "", text)
    if not text:
        return default
    # 1,234.56 vs 1.234,56
    if "," in text and "." in text:
        if text.rfind(",") > text.rfind("."):
            text = text.replace(".", "").replace(",", ".")
        else:
            text = text.replace(",", "")
    elif "," in text and "." not in text:
        tail = text.split(",")[-1]
        text = text.replace(",", "." if len(tail) == 2 else "")
    try:
        return float(text)
    except ValueError:
        return default
