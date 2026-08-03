"""Integrations status + WhatsApp fallback (no external network required)."""

from __future__ import annotations

import os

import pytest


@pytest.fixture(autouse=True)
def _clear_integration_env(monkeypatch):
    for key in (
        "GOOGLE_APPS_SCRIPT_URL",
        "SPP_API_KEY",
        "GREEN_API_INSTANCE_ID",
        "GREEN_API_TOKEN",
        "HOME_ASSISTANT_URL",
        "HOME_ASSISTANT_TOKEN",
    ):
        monkeypatch.delenv(key, raising=False)


def test_integration_status_disconnected():
    from adapters.integrations import integration_status

    st = integration_status()
    assert st["ok"] is True
    assert st["services"]["sheets"]["status"] == "not_connected"
    assert st["services"]["whatsapp"]["status"] == "not_connected"
    assert st["services"]["home_assistant"]["status"] == "not_connected"


def test_whatsapp_wa_me_fallback():
    from adapters.integrations import send_whatsapp_message

    result = send_whatsapp_message("966500000000", "مرحبا", dry_run=False)
    assert result["ok"] is True
    assert result["channel"] == "wa_me"
    assert result["delivery_status"] == "ready_to_send"
    assert "wa.me/966500000000" in (result.get("deep_link") or "")


def test_whatsapp_missing_phone():
    from adapters.integrations import send_whatsapp_message

    result = send_whatsapp_message("", "x")
    assert result["ok"] is False
    assert result["delivery_status"] == "missing_phone"


def test_green_marked_active_when_env_set(monkeypatch):
    monkeypatch.setenv("GREEN_API_INSTANCE_ID", "123")
    monkeypatch.setenv("GREEN_API_TOKEN", "tok")
    from adapters.integrations import integration_status, green_configured

    assert green_configured() is True
    st = integration_status()
    assert st["services"]["whatsapp"]["status"] == "active"


def test_ha_sensors_empty_when_not_configured():
    from adapters.integrations import fetch_ha_sensors, ha_configured

    assert ha_configured() is False
    assert fetch_ha_sensors() == []
