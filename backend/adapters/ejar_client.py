"""Saudi Ejar (منصة إيجار) connection helpers — Phase 4 live integration.

Degrades gracefully when EJAR_* env is unset. Does not call external APIs
until credentials are provided; webhook reception is the primary path.
"""

from __future__ import annotations

import hmac
import os
from typing import Optional


def ejar_enabled() -> bool:
    """True when the owner has opted into Ejar (secret or explicit flag)."""
    flag = (os.environ.get("EJAR_ENABLED") or "").strip().lower()
    if flag in ("1", "true", "yes", "on"):
        return True
    return bool((os.environ.get("EJAR_WEBHOOK_SECRET") or "").strip())


def webhook_secret() -> str:
    return (os.environ.get("EJAR_WEBHOOK_SECRET") or "").strip()


def verify_webhook_secret(provided: Optional[str]) -> bool:
    """Constant-time compare. If no secret configured, accept (dev/beta)."""
    expected = webhook_secret()
    if not expected:
        return True
    got = (provided or "").strip()
    if not got:
        return False
    return hmac.compare_digest(got, expected)


def status_payload(*, event_count: int = 0, last_event_at: Optional[str] = None) -> dict:
    return {
        "service": "ejar",
        "label_ar": "منصة إيجار",
        "label_en": "Ejar",
        "configured": ejar_enabled(),
        "webhook_ready": bool(webhook_secret()) or ejar_enabled(),
        "event_count": event_count,
        "last_event_at": last_event_at,
        "scopes": ["contract_expiry", "contract_renewal", "official_notices"],
    }
