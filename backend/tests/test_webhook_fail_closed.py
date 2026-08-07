"""GAP-C02 — production/non-beta webhooks fail closed when secret unset."""

from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO))
sys.path.insert(0, str(REPO / "backend"))


@pytest.fixture
def production_env(monkeypatch):
    from adapters.settings import reset_settings_cache

    monkeypatch.setenv("SPP_BETA_MODE", "false")
    monkeypatch.setenv("SPP_ENV", "production")
    monkeypatch.delenv("ENV", raising=False)
    for key in (
        "EJAR_WEBHOOK_SECRET",
        "EJAR_ENABLED",
        "ELECTRICITY_WEBHOOK_SECRET",
        "WATER_WEBHOOK_SECRET",
        "UTILITIES_WEBHOOK_SECRET",
        "ELECTRICITY_ENABLED",
        "WATER_ENABLED",
        "UTILITIES_ENABLED",
        "MESSAGING_WEBHOOK_SECRET",
        "INTELLIGENCE_WEBHOOK_SECRET",
        "PLATFORM_WEBHOOK_SECRET",
        "MESSAGING_ENABLED",
        "INTELLIGENCE_ENABLED",
    ):
        monkeypatch.delenv(key, raising=False)
    reset_settings_cache()


def test_fail_open_helper_beta_only(monkeypatch):
    from adapters.settings import reset_settings_cache
    from adapters.webhook_security import webhook_fail_open_allowed

    monkeypatch.setenv("SPP_BETA_MODE", "true")
    monkeypatch.delenv("SPP_ENV", raising=False)
    reset_settings_cache()
    assert webhook_fail_open_allowed() is True

    monkeypatch.setenv("SPP_BETA_MODE", "false")
    monkeypatch.setenv("SPP_ENV", "production")
    reset_settings_cache()
    assert webhook_fail_open_allowed() is False

    monkeypatch.setenv("SPP_ENV", "local")
    reset_settings_cache()
    assert webhook_fail_open_allowed() is True


def test_ejar_rejects_when_secret_unset_in_production(production_env):
    from adapters.settings import reset_settings_cache
    from adapters.ejar_client import verify_webhook_secret

    reset_settings_cache()
    assert verify_webhook_secret(None) is False
    assert verify_webhook_secret("") is False
    assert verify_webhook_secret("anything") is False


def test_ejar_accepts_unset_secret_in_beta(monkeypatch):
    from adapters.settings import reset_settings_cache
    from adapters.ejar_client import verify_webhook_secret

    monkeypatch.setenv("SPP_BETA_MODE", "true")
    monkeypatch.delenv("EJAR_WEBHOOK_SECRET", raising=False)
    reset_settings_cache()
    assert verify_webhook_secret(None) is True


def test_utilities_reject_when_secret_unset_in_production(production_env):
    from adapters.settings import reset_settings_cache
    from adapters.utilities_client import verify_webhook_secret

    reset_settings_cache()
    assert verify_webhook_secret("electricity", None) is False
    assert verify_webhook_secret("water", "x") is False


def test_platform_inbox_reject_when_secret_unset_in_production(production_env):
    from adapters.settings import reset_settings_cache
    from adapters.platform_inbox_client import verify_webhook_secret

    reset_settings_cache()
    assert verify_webhook_secret("messaging", None) is False
    assert verify_webhook_secret("intelligence", "") is False


def test_http_webhook_401_when_secret_unset_production(production_env, monkeypatch):
    from adapters.settings import reset_settings_cache

    os.environ.setdefault("SPP_DEMO_MODE", "false")
    os.environ.setdefault("SPP_DATA_SOURCE", "mongo")
    monkeypatch.setenv("SPP_BETA_MODE", "false")
    monkeypatch.setenv("SPP_ENV", "production")
    reset_settings_cache()

    import server as spp_server
    from fastapi.testclient import TestClient

    spp_server._memory_db.clear()
    spp_server._mongo_available = False
    client = TestClient(spp_server.app)

    r = client.post("/api/webhooks/ejar", json={"contract_number": "X"})
    assert r.status_code == 401
