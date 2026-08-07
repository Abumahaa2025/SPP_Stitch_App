"""Saudi Ejar (منصة إيجار) connection helpers — Phase 4 live integration.

Degrades gracefully when EJAR_* env is unset. Does not call external APIs
until credentials are provided; webhook reception is the primary path.
"""

from __future__ import annotations

import hmac
from typing import Optional

from adapters.settings import get_settings
from adapters.webhook_security import webhook_fail_open_allowed


def ejar_enabled() -> bool:
    """True when the owner has opted into Ejar (secret or explicit flag)."""
    s = get_settings()
    if s.ejar_enabled:
        return True
    return bool(s.ejar_webhook_secret)


def webhook_secret() -> str:
    return get_settings().ejar_webhook_secret


def verify_webhook_secret(provided: Optional[str]) -> bool:
    """Constant-time compare. Empty secret fails closed outside beta/local."""
    expected = webhook_secret()
    if not expected:
        return webhook_fail_open_allowed()
    got = (provided or "").strip()
    if not got:
        return False
    return hmac.compare_digest(got, expected)


def status_payload(*, event_count: int = 0, last_event_at: Optional[str] = None) -> dict:
    secret_set = bool(webhook_secret())
    return {
        "service": "ejar",
        "label_ar": "منصة إيجار",
        "label_en": "Ejar",
        "configured": ejar_enabled(),
        "webhook_ready": secret_set,
        "webhook_secret_configured": secret_set,
        "webhook_fail_open": (not secret_set) and webhook_fail_open_allowed(),
        "event_count": event_count,
        "last_event_at": last_event_at,
        "scopes": ["contract_expiry", "contract_renewal", "official_notices"],
    }
