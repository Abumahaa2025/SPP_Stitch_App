"""Automated messaging & intelligence platform webhook auth."""

from __future__ import annotations

import hmac
from typing import Literal, Optional

from adapters.settings import get_settings
from adapters.webhook_security import webhook_fail_open_allowed

PlatformChannel = Literal["messaging", "intelligence"]


def channel_enabled(channel: PlatformChannel) -> bool:
    s = get_settings()
    if channel == "messaging" and s.messaging_enabled:
        return True
    if channel == "intelligence" and s.intelligence_enabled:
        return True
    return bool(webhook_secret(channel))


def webhook_secret(channel: PlatformChannel) -> str:
    s = get_settings()
    specific = (
        s.messaging_webhook_secret
        if channel == "messaging"
        else s.intelligence_webhook_secret
    )
    return (specific or s.platform_webhook_secret or "").strip()


def verify_webhook_secret(channel: PlatformChannel, provided: Optional[str]) -> bool:
    expected = webhook_secret(channel)
    if not expected:
        return webhook_fail_open_allowed()
    got = (provided or "").strip()
    if not got:
        return False
    return hmac.compare_digest(got, expected)
