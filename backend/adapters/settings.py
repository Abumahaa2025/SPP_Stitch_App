"""Configuration / Settings infrastructure port (Blueprint §5.4 / GAP-H07).

Engines and adapters should receive values from ``get_settings()`` rather than
reading ``os.environ`` keys directly in new code.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from typing import Optional


def _flag(name: str, default: str = "false") -> bool:
    return os.environ.get(name, default).strip().lower() in ("1", "true", "yes", "on")


@dataclass(frozen=True)
class Settings:
    """Immutable snapshot of service environment configuration."""

    spp_beta_mode: bool
    spp_env: str
    spp_demo_mode: bool
    green_api_instance_id: str
    green_api_token: str
    green_api_api_url: str
    green_api_timeout_seconds: int
    home_assistant_url: str
    home_assistant_token: str
    home_assistant_entity_prefix: str
    home_assistant_timeout_seconds: int
    ejar_enabled: bool
    ejar_webhook_secret: str
    electricity_enabled: bool
    water_enabled: bool
    utilities_enabled: bool
    electricity_webhook_secret: str
    water_webhook_secret: str
    utilities_webhook_secret: str
    messaging_enabled: bool
    intelligence_enabled: bool
    messaging_webhook_secret: str
    intelligence_webhook_secret: str
    platform_webhook_secret: str

    @property
    def green_configured(self) -> bool:
        return bool(self.green_api_instance_id and self.green_api_token)

    @property
    def home_assistant_configured(self) -> bool:
        return bool(self.home_assistant_url and self.home_assistant_token)

    def webhook_fail_open_allowed(self) -> bool:
        """True only for explicit beta / local / development environments."""
        if self.spp_beta_mode:
            return True
        return self.spp_env in ("local", "dev", "development", "beta")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    env = (os.environ.get("SPP_ENV") or os.environ.get("ENV") or "").strip().lower()
    return Settings(
        spp_beta_mode=_flag("SPP_BETA_MODE"),
        spp_env=env,
        spp_demo_mode=_flag("SPP_DEMO_MODE"),
        green_api_instance_id=(os.environ.get("GREEN_API_INSTANCE_ID") or "").strip(),
        green_api_token=(os.environ.get("GREEN_API_TOKEN") or "").strip(),
        green_api_api_url=(os.environ.get("GREEN_API_API_URL") or "https://api.green-api.com").rstrip("/"),
        green_api_timeout_seconds=int(os.environ.get("GREEN_API_TIMEOUT_SECONDS") or "30"),
        home_assistant_url=(os.environ.get("HOME_ASSISTANT_URL") or "").strip(),
        home_assistant_token=(os.environ.get("HOME_ASSISTANT_TOKEN") or "").strip(),
        home_assistant_entity_prefix=(os.environ.get("HOME_ASSISTANT_ENTITY_PREFIX") or "sensor.").strip(),
        home_assistant_timeout_seconds=int(os.environ.get("HOME_ASSISTANT_TIMEOUT_SECONDS") or "20"),
        ejar_enabled=_flag("EJAR_ENABLED"),
        ejar_webhook_secret=(os.environ.get("EJAR_WEBHOOK_SECRET") or "").strip(),
        electricity_enabled=_flag("ELECTRICITY_ENABLED"),
        water_enabled=_flag("WATER_ENABLED"),
        utilities_enabled=_flag("UTILITIES_ENABLED"),
        electricity_webhook_secret=(os.environ.get("ELECTRICITY_WEBHOOK_SECRET") or "").strip(),
        water_webhook_secret=(os.environ.get("WATER_WEBHOOK_SECRET") or "").strip(),
        utilities_webhook_secret=(os.environ.get("UTILITIES_WEBHOOK_SECRET") or "").strip(),
        messaging_enabled=_flag("MESSAGING_ENABLED"),
        intelligence_enabled=_flag("INTELLIGENCE_ENABLED"),
        messaging_webhook_secret=(os.environ.get("MESSAGING_WEBHOOK_SECRET") or "").strip(),
        intelligence_webhook_secret=(os.environ.get("INTELLIGENCE_WEBHOOK_SECRET") or "").strip(),
        platform_webhook_secret=(os.environ.get("PLATFORM_WEBHOOK_SECRET") or "").strip(),
    )


def reset_settings_cache() -> None:
    """Test helper — clear cached settings after monkeypatching env."""
    get_settings.cache_clear()


def optional_str(name: str) -> Optional[str]:
    value = (os.environ.get(name) or "").strip()
    return value or None
