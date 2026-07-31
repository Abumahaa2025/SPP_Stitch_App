"""Live smoke test for GAS lite endpoints (skipped without URL)."""

from __future__ import annotations

import os
import time

import pytest

from adapters.gas_client import GasClient, GasClientError


GAS_URL = os.environ.get("GOOGLE_APPS_SCRIPT_URL", "")
pytestmark = pytest.mark.skipif(not GAS_URL, reason="GOOGLE_APPS_SCRIPT_URL not set")


@pytest.fixture
def client() -> GasClient:
    return GasClient(base_url=GAS_URL, timeout=60)


def test_health_check(client: GasClient):
    try:
        data = client.health_check()
    except GasClientError as exc:
        pytest.skip(f"GAS not reachable anonymously: {exc}")
    assert data.get("status") == "ok"


@pytest.mark.parametrize(
    "method",
    [
        "get_properties_lite",
        "get_tenants_lite",
        "get_contracts_lite",
    ],
)
def test_dashboard_lite_under_timeout(client: GasClient, method: str):
    started = time.time()
    try:
        payload = getattr(client, method)()
    except GasClientError as exc:
        pytest.skip(f"GAS not reachable anonymously: {exc}")
    elapsed = time.time() - started
    assert elapsed < 60, f"{method} took {elapsed:.1f}s"
    assert isinstance(payload, dict)
    assert "dashboard" in payload
