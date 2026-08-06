"""Electricity/water utility webhook → Kowil suggest pay → owner approve prepare."""

from __future__ import annotations

import os
import sys
from pathlib import Path

os.environ.setdefault("SPP_BETA_MODE", "true")
os.environ.setdefault("SPP_DEMO_MODE", "false")
os.environ.setdefault("SPP_DATA_SOURCE", "mongo")
os.environ["UTILITIES_ENABLED"] = "true"
os.environ["UTILITIES_WEBHOOK_SECRET"] = "test-util-secret"

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO))
sys.path.insert(0, str(REPO / "backend"))

from fastapi.testclient import TestClient

import server as spp_server

API = "/api"


def setup_function():
    spp_server._memory_db.clear()
    spp_server._mongo_available = False


def test_utilities_status():
    client = TestClient(spp_server.app)
    r = client.get(f"{API}/integrations/utilities/status")
    assert r.status_code == 200
    body = r.json()
    assert body["electricity"]["configured"] is True
    assert body["water"]["configured"] is True
    assert body["electricity"]["payment_requires_owner_permission"] is True


def test_utility_webhook_rejects_bad_secret():
    client = TestClient(spp_server.app)
    r = client.post(
        f"{API}/webhooks/utilities/electricity",
        json={"bill_number": "X"},
        headers={"X-Utility-Secret": "wrong"},
    )
    assert r.status_code == 401


def test_electricity_bill_fan_out_and_approve():
    client = TestClient(spp_server.app)
    r = client.post(
        f"{API}/webhooks/utilities/electricity",
        json={
            "event_type": "bill_due",
            "bill_number": "EL-100",
            "account_number": "ACC-9",
            "unit": "A-1",
            "amount": 450.5,
            "due_date": "2026-08-20",
            "payment_url": "https://pay.example/el-100",
        },
        headers={"X-Utility-Secret": "test-util-secret"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["ok"] is True
    assert body["event"]["utility"] == "electricity"
    assert body["decision"]["kind"] == "utility_bill_payment"
    assert body["decision"]["requires_confirmation"] is True
    assert body["kowil"]["requires_owner_permission"] is True
    assert body["notifications"][0]["audience"] == "owner"

    event_id = body["event"]["id"]
    approved = client.post(
        f"{API}/utilities/approve-payment",
        json={"event_id": event_id},
    )
    assert approved.status_code == 200, approved.text
    ap = approved.json()
    assert ap["status"] == "approved_and_prepared"
    assert ap["approval"]["delivery_status"] == "not_sent"
    assert ap["approval"]["payment_status"] == "prepared_awaiting_rail"
    assert "owner" in ap["approval"]["prepared_messages"]


def test_water_bill_webhook():
    client = TestClient(spp_server.app)
    r = client.post(
        f"{API}/webhooks/utilities/water",
        json={
            "event_type": "bill_overdue",
            "bill_number": "WA-55",
            "amount": 120,
            "unit": "B-2",
        },
        headers={"X-Utility-Secret": "test-util-secret"},
    )
    assert r.status_code == 200
    assert r.json()["event"]["utility"] == "water"
    assert r.json()["event"]["priority"] == "critical"

    events = client.get(f"{API}/utilities/events").json()
    assert any(e.get("bill_number") == "WA-55" for e in events["events"])
