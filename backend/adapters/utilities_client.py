"""Electricity & water utility connections — Phase 4 live integrations.

Degrades when UTILITIES_* / ELECTRICITY_* / WATER_* env unset.
Inbound webhooks are the primary path; payment is prepare-only until owner approves.
"""

from __future__ import annotations

import hmac
from typing import Literal, Optional

from adapters.settings import get_settings
from adapters.webhook_security import webhook_fail_open_allowed

UtilityKind = Literal["electricity", "water"]


def electricity_enabled() -> bool:
    s = get_settings()
    if s.electricity_enabled or s.utilities_enabled:
        return True
    return bool(s.electricity_webhook_secret or s.utilities_webhook_secret)


def water_enabled() -> bool:
    s = get_settings()
    if s.water_enabled or s.utilities_enabled:
        return True
    return bool(s.water_webhook_secret or s.utilities_webhook_secret)


def utility_enabled(kind: UtilityKind) -> bool:
    return electricity_enabled() if kind == "electricity" else water_enabled()


def webhook_secret(kind: UtilityKind) -> str:
    s = get_settings()
    specific = (
        s.electricity_webhook_secret
        if kind == "electricity"
        else s.water_webhook_secret
    )
    return (specific or s.utilities_webhook_secret or "").strip()


def verify_webhook_secret(kind: UtilityKind, provided: Optional[str]) -> bool:
    expected = webhook_secret(kind)
    if not expected:
        return webhook_fail_open_allowed()
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
    secret_set = bool(webhook_secret(kind))
    return {
        "service": kind,
        "label_ar": labels["ar"],
        "label_en": labels["en"],
        "configured": utility_enabled(kind),
        "webhook_ready": secret_set,
        "webhook_secret_configured": secret_set,
        "webhook_fail_open": (not secret_set) and webhook_fail_open_allowed(),
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
