"""GAP-C01 / GAP-C04 — WhatsApp endpoint is deep-link prepare only."""

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

API = "/api"


def setup_function():
    spp_server._memory_db.clear()
    spp_server._mongo_available = False


def test_whatsapp_send_defaults_to_deep_link(monkeypatch):
    monkeypatch.setenv("GREEN_API_INSTANCE_ID", "123")
    monkeypatch.setenv("GREEN_API_TOKEN", "tok")
    client = TestClient(spp_server.app)
    r = client.post(
        f"{API}/integrations/whatsapp/send",
        json={"phone": "966500000000", "message": "hello"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["ok"] is True
    assert body["channel"] == "wa_me"
    assert body["server_dispatch"] is False
    assert body["outbound_rail"] == "placeholder"
    assert body["delivery_status"] != "sent"
    assert "wa.me/" in (body.get("deep_link") or "")


def test_whatsapp_send_dry_run_false_without_approval_rejected(monkeypatch):
    monkeypatch.delenv("GREEN_API_INSTANCE_ID", raising=False)
    monkeypatch.delenv("GREEN_API_TOKEN", raising=False)
    client = TestClient(spp_server.app)
    r = client.post(
        f"{API}/integrations/whatsapp/send",
        json={"phone": "966500000000", "message": "hello", "dry_run": False},
    )
    assert r.status_code == 403
    body = r.json()
    detail = body.get("detail") or body
    assert detail.get("error") == "approval_required"
    assert detail.get("server_dispatch") is False


def test_whatsapp_send_dry_run_false_with_approval_still_no_dispatch(monkeypatch):
    monkeypatch.setenv("GREEN_API_INSTANCE_ID", "123")
    monkeypatch.setenv("GREEN_API_TOKEN", "tok")
    client = TestClient(spp_server.app)
    r = client.post(
        f"{API}/integrations/whatsapp/send",
        json={
            "phone": "966500000000",
            "message": "hello",
            "dry_run": False,
            "approval_id": "desk-approval:task-1:test",
        },
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["server_dispatch"] is False
    assert body["channel"] == "wa_me"
    assert body["approval_bound"] is True
    assert body["delivery_status"] != "sent"
