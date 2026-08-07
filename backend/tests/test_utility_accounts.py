"""GAP-M03 — UtilityAccount standing entity."""

from __future__ import annotations

import os
import sys
from pathlib import Path

os.environ.setdefault("SPP_BETA_MODE", "true")
os.environ.setdefault("SPP_DEMO_MODE", "false")
os.environ.setdefault("SPP_DATA_SOURCE", "mongo")

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO))
sys.path.insert(0, str(REPO / "backend"))

from fastapi.testclient import TestClient

import server as spp_server
from adapters.utility_accounts import reset_memory_store, upsert_account, list_accounts

API = "/api"


def setup_function():
    reset_memory_store()
    spp_server._memory_db.clear()
    spp_server._mongo_available = False


def test_upsert_requires_service_target():
    try:
        upsert_account(
            {
                "utility_kind": "electricity",
                "account_number": "ACC-1",
                "responsible_party": "tenant",
            }
        )
        assert False, "expected ValueError"
    except ValueError as exc:
        assert str(exc) == "service_target_required"


def test_upsert_and_list_account():
    row = upsert_account(
        {
            "utility_kind": "water",
            "account_number": "W-99",
            "meter_number": "M-1",
            "unit_id": "unit_1",
            "property_id": "prop_1",
            "responsible_party": "owner",
        }
    )
    assert row["id"]
    assert row["status"] == "linked"
    rows = list_accounts(utility_kind="water", unit_id="unit_1")
    assert len(rows) == 1
    assert rows[0]["account_number"] == "W-99"


def test_http_utility_accounts_roundtrip():
    client = TestClient(spp_server.app)
    created = client.post(
        f"{API}/utility-accounts",
        json={
            "utility_kind": "electricity",
            "account_number": "E-100",
            "unit_id": "u1",
            "building_id": "bld_1",
            "responsible_party": "tenant",
        },
    )
    assert created.status_code == 200, created.text
    body = created.json()
    assert body["ok"] is True
    aid = body["account"]["id"]

    listed = client.get(f"{API}/utility-accounts?utility_kind=electricity")
    assert listed.status_code == 200
    assert listed.json()["count"] >= 1

    one = client.get(f"{API}/utility-accounts/{aid}")
    assert one.status_code == 200
    assert one.json()["account"]["account_number"] == "E-100"
