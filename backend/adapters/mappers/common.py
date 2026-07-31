"""Shared mapper utilities."""

from __future__ import annotations

import hashlib
import re


def slug(value: str) -> str:
    value = re.sub(r"\s+", "-", (value or "").strip())
    return hashlib.md5(value.encode("utf-8")).hexdigest()[:10]


def unit_property_id(unit_name: str) -> str:
    return f"prop_{slug(unit_name or 'main')}"


def tenant_id(name: str, unit: str) -> str:
    return f"ten_{slug(name or unit)}"


def contract_id(contract_no: str, index: int) -> str:
    return f"ct_{slug(str(contract_no or index))}"
