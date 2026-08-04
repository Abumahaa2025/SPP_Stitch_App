"""Electricity & water utility connections — Phase 4 live integrations.

Degrades when UTILITIES_* / ELECTRICITY_* / WATER_* env unset.
Inbound webhooks are the primary path; payment is prepare-only until owner approves.
"""

from __future__ import annotations

import hmac
import os
from typing import Literal, Optional

UtilityKind = Literal["electricity", "water"]


def _flag(name: str) -> bool:
    return (os.environ.get(name) or "").strip().lower() in ("1", "true", "yes", "on")


def electricity_enabled() -> bool:
    if _flag("ELECTRICITY_ENABLED") or _flag("UTILITIES_ENABLED"):
        return True
    return bool((os.environ.get("ELECTRICITY_WEBHOOK_SECRET") or os.environ.get("UTILITIES_WEBHOOK_SECRET") or "").strip())


def water_enabled() -> bool:
    if _flag("WATER_ENABLED") or _flag("UTILITIES_ENABLED"):
        return True
    return bool((os.environ.get("WATER_WEBHOOK_SECRET") or os.environ.get("UTILITIES_WEBHOOK_SECRET") or "").strip())


def utility_enabled(kind: UtilityKind) -> bool:
    return electricity_enabled() if kind == "electricity" else water_enabled()


def webhook_secret(kind: UtilityKind) -> str:
    specific = (
        os.environ.get("ELECTRICITY_WEBHOOK_SECRET")
        if kind == "electricity"
        else os.environ.get("WATER_WEBHOOK_SECRET")
    )
    return (specific or os.environ.get("UTILITIES_WEBHOOK_SECRET") or "").strip()


def verify_webhook_secret(kind: UtilityKind, provided: Optional[str]) -> bool:
    expected = webhook_secret(kind)
    if not expected:
        return True
    got = (provided or "").strip()
    if not got:
        return False
    return hmac.compare_digest(got, expected)


def status_payload(
    kind: UtilityKind,
    *,
    event_count: int = 0,
    last_event_at: Optional[str] = None,
) -> dict:
    labels = {
        "electricity": {"ar": "شركة الكهرباء", "en": "Electricity company"},
        "water": {"ar": "شركة المياه", "en": "Water company"},
    }[kind]
    return {
        "service": kind,
        "label_ar": labels["ar"],
        "label_en": labels["en"],
        "configured": utility_enabled(kind),
        "webhook_ready": bool(webhook_secret(kind)) or utility_enabled(kind),
        "event_count": event_count,
        "last_event_at": last_event_at,
        "scopes": ["bill_notice", "bill_due", "payment_prepare"],
        "payment_requires_owner_permission": True,
    }


def combined_status(
    *,
    electricity_count: int = 0,
    water_count: int = 0,
    electricity_last: Optional[str] = None,
    water_last: Optional[str] = None,
) -> dict:
    return {
        "electricity": status_payload("electricity", event_count=electricity_count, last_event_at=electricity_last),
        "water": status_payload("water", event_count=water_count, last_event_at=water_last),
    }
