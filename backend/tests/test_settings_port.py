"""GAP-H07 — configuration port; engines use get_settings()."""

from __future__ import annotations

import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "backend"))


def test_get_settings_reads_beta_and_green(monkeypatch):
    from adapters.settings import get_settings, reset_settings_cache

    monkeypatch.setenv("SPP_BETA_MODE", "true")
    monkeypatch.setenv("SPP_ENV", "local")
    monkeypatch.setenv("GREEN_API_INSTANCE_ID", "inst")
    monkeypatch.setenv("GREEN_API_TOKEN", "tok")
    reset_settings_cache()
    s = get_settings()
    assert s.spp_beta_mode is True
    assert s.green_configured is True
    assert s.webhook_fail_open_allowed() is True


def test_green_configured_uses_settings_port(monkeypatch):
    from adapters.settings import reset_settings_cache
    from adapters.integrations.green_api import green_configured

    monkeypatch.delenv("GREEN_API_INSTANCE_ID", raising=False)
    monkeypatch.delenv("GREEN_API_TOKEN", raising=False)
    reset_settings_cache()
    assert green_configured() is False

    monkeypatch.setenv("GREEN_API_INSTANCE_ID", "1")
    monkeypatch.setenv("GREEN_API_TOKEN", "t")
    reset_settings_cache()
    assert green_configured() is True


def test_webhook_fail_open_uses_settings(monkeypatch):
    from adapters.settings import reset_settings_cache
    from adapters.webhook_security import webhook_fail_open_allowed

    monkeypatch.setenv("SPP_BETA_MODE", "false")
    monkeypatch.setenv("SPP_ENV", "production")
    reset_settings_cache()
    assert webhook_fail_open_allowed() is False

    monkeypatch.setenv("SPP_BETA_MODE", "true")
    reset_settings_cache()
    assert webhook_fail_open_allowed() is True


def test_home_assistant_uses_settings_port(monkeypatch):
    from adapters.settings import reset_settings_cache
    from adapters.integrations.home_assistant import ha_configured

    monkeypatch.delenv("HOME_ASSISTANT_URL", raising=False)
    monkeypatch.delenv("HOME_ASSISTANT_TOKEN", raising=False)
    reset_settings_cache()
    assert ha_configured() is False

    monkeypatch.setenv("HOME_ASSISTANT_URL", "http://ha.local")
    monkeypatch.setenv("HOME_ASSISTANT_TOKEN", "tok")
    reset_settings_cache()
    assert ha_configured() is True
