"""Automated messaging & intelligence platform webhook auth."""

from __future__ import annotations

import hmac
import os
from typing import Literal, Optional

PlatformChannel = Literal["messaging", "intelligence"]


def channel_enabled(channel: PlatformChannel) -> bool:
    flag = (os.environ.get(f"{channel.upper()}_ENABLED") or "").strip().lower()
    if flag in ("1", "true", "yes", "on"):
        return True
    return bool(webhook_secret(channel))


def webhook_secret(channel: PlatformChannel) -> str:
    specific = os.environ.get(f"{channel.upper()}_WEBHOOK_SECRET") or ""
    shared = os.environ.get("PLATFORM_WEBHOOK_SECRET") or ""
    return (specific or shared).strip()


def verify_webhook_secret(channel: PlatformChannel, provided: Optional[str]) -> bool:
    expected = webhook_secret(channel)
    if not expected:
        return True
    got = (provided or "").strip()
    if not got:
        return False
    return hmac.compare_digest(got, expected)
