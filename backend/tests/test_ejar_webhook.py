"""Ejar (منصة إيجار) webhook → Kowil suggest → owner approve prepare path."""

from __future__ import annotations

import os
import sys
from pathlib import Path

os.environ.setdefault("SPP_BETA_MODE", "true")
os.environ.setdefault("SPP_DEMO_MODE", "false")
os.environ.setdefault("SPP_DATA_SOURCE", "mongo")
os.environ["EJAR_ENABLED"] = "true"
os.environ["EJAR_WEBHOOK_SECRET"] = "test-ejar-secret"

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO))
sys.path.insert(0, str(REPO / "backend"))

from fastapi.testclient import TestClient

import server as spp_server

API = "/api"


def setup_function():
    spp_server._memory_db.clear()
    spp_server._mongo_available = False


def test_ejar_status_configured():
    client = TestClient(spp_server.app)
    r = client.get(f"{API}/integrations/ejar/status")
    assert r.status_code == 200
    body = r.json()
    assert body["service"] == "ejar"
    assert body["configured"] is True
    assert "contract_expiry" in body["scopes"]


def test_ejar_webhook_rejects_bad_secret():
    client = TestClient(spp_server.app)
    r = client.post(
        f"{API}/webhooks/ejar",
        json={"contract_number": "X"},
        headers={"X-Ejar-Secret": "wrong"},
    )
    assert r.status_code == 401


def test_ejar_webhook_accepts_expiry_and_fans_out():
    client = TestClient(spp_server.app)
    payload = {
        "event_type": "contract_nearing_expiry",
        "contract_number": "EJ-7788",
        "unit": "G-02",
        "tenant_name": "سارة أحمد",
        "tenant_phone": "+966500000001",
        "days_left": 12,
        "end_date": "2026-09-01",
    }
    r = client.post(
        f"{API}/webhooks/ejar",
        json=payload,
        headers={"X-Ejar-Secret": "test-ejar-secret"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["ok"] is True
    assert body["event"]["contract_number"] == "EJ-7788"
    assert body["decision"]["kind"] == "ejar_contract_expiry"
    assert body["decision"]["requires_confirmation"] is True
    assert body["kowil"]["requires_owner_permission"] is True
    audiences = {n["audience"] for n in body["notifications"]}
    assert audiences == {"owner", "agent_contracts", "tenant"}

    events = client.get(f"{API}/ejar/events").json()
    assert len(events["events"]) >= 1
    assert events["tasks"][0]["source"] == "ejar"

    notifs = client.get(f"{API}/notifications").json()
    ejar_notifs = [n for n in notifs if n.get("source") == "ejar"]
    assert len(ejar_notifs) >= 3


def test_ejar_owner_approve_prepares_messages():
    client = TestClient(spp_server.app)
    created = client.post(
        f"{API}/webhooks/ejar",
        json={
            "event_type": "contract_nearing_expiry",
            "contract_number": "EJ-9001",
            "unit": "A-1",
            "tenant_name": "نورة",
            "days_left": 5,
        },
        headers={"X-Ejar-Secret": "test-ejar-secret"},
    ).json()
    event_id = created["event"]["id"]

    r = client.post(f"{API}/ejar/approve", json={"event_id": event_id})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "approved_and_prepared"
    msgs = body["approval"]["prepared_messages"]
    assert "owner" in msgs and "agent_contracts" in msgs and "tenant" in msgs
    assert body["approval"]["delivery_status"] == "not_sent"
    assert body["event"]["owner_approval"] == "approved"
