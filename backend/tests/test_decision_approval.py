"""P1 — durable approval and preparation of late-tenant decisions."""

from __future__ import annotations

import copy
import os
import sys
from pathlib import Path

os.environ.setdefault("SPP_BETA_MODE", "true")
os.environ.setdefault("SPP_DEMO_MODE", "false")
os.environ.setdefault("SPP_DATA_SOURCE", "mongo")

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO))
sys.path.insert(0, str(REPO / "backend"))

import pytest
from fastapi.testclient import TestClient

import server as spp_server

API = "/api"


class _UpdateResult:
    def __init__(self, upserted_id):
        self.upserted_id = upserted_id


class _FakeCollection:
    def __init__(self):
        self.docs = {}

    async def update_one(self, query, update, upsert=False):
        key = query.get("_id")
        existing = next(
            (
                doc
                for doc in self.docs.values()
                if all(doc.get(field) == value for field, value in query.items())
            ),
            None,
        )
        if existing is not None:
            return _UpdateResult(None)
        assert upsert is True
        document = copy.deepcopy(update.get("$setOnInsert") or update.get("$set") or {})
        doc_id = document.get("_id") or key
        document["_id"] = doc_id
        self.docs[doc_id] = document
        return _UpdateResult(doc_id)

    async def find_one(self, query, *args, **kwargs):
        for document in self.docs.values():
            if all(document.get(field) == value for field, value in query.items()):
                return copy.deepcopy(document)
        return None


class _FakeDb:
    def __init__(self):
        self.collections = {}

    def __getitem__(self, name):
        return self.collections.setdefault(name, _FakeCollection())


def _decision(
    decision_id="late-c-103",
    *,
    kind="contact_late_tenant",
    requires_confirmation=True,
    blocked_by_gate=False,
    gate_status="ok",
):
    return {
        "id": decision_id,
        "kind": kind,
        "tenant_name": "C",
        "unit_label": "103",
        "why": "متأخرات مؤكدة: 2 شهر · 8,000 ر.س على الوحدة 103.",
        "requires_confirmation": requires_confirmation,
        "blocked_by_gate": blocked_by_gate,
        "gate_status": gate_status,
        "status": "proposed",
    }


def _ai_state(analysis_id="analysis-a", decisions=None):
    return {
        "analysis_id": analysis_id,
        "unified_smart_decisions": decisions or [_decision()],
        "normalized_lifecycle": {
            "late_tenants": [
                {
                    "tenant": "C",
                    "unit": "103",
                    "total_unpaid": 8000,
                    "late_month_count": 2,
                    "phone": "0503333333",
                }
            ]
        },
        "property_knowledge": {"late": {"tenants": []}},
    }


@pytest.fixture()
def approval_api(monkeypatch):
    fake_db = _FakeDb()
    ai_collection = fake_db[spp_server._AI_STATE_COLLECTION]
    state_a = _ai_state()
    state_b = _ai_state("analysis-b", [_decision("late-b-103")])
    ai_collection.docs["analysis-a"] = copy.deepcopy(state_a)
    ai_collection.docs["analysis-b"] = copy.deepcopy(state_b)

    monkeypatch.setattr(spp_server, "_mongo_available", True)
    monkeypatch.setattr(spp_server, "_get_db", lambda: fake_db)
    with TestClient(spp_server.app) as client:
        # Startup may probe the real Mongo before the patched endpoint runs.
        spp_server._mongo_available = True
        yield client, fake_db


def _approve(client, analysis_id="analysis-a", decision_id="late-c-103", **extra):
    payload = {"analysis_id": analysis_id, "decision_id": decision_id, **extra}
    return client.post(f"{API}/decisions/approve", json=payload)


def test_valid_late_decision_is_approved_and_prepared(approval_api):
    client, fake_db = approval_api
    response = _approve(client)

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "approved_and_prepared"
    assert body["idempotent_replay"] is False
    approval = body["approval"]
    assert approval["analysis_id"] == "analysis-a"
    assert approval["decision_id"] == "late-c-103"
    assert approval["tenant"] == "C"
    assert approval["unit"] == "103"
    assert approval["amount"] == 8000
    assert approval["delivery_status"] == "not_sent"
    assert len(fake_db["decision_approvals"].docs) == 1
    assert "decision_approvals" not in spp_server._memory_db


def test_prepared_message_is_server_derived_arabic(approval_api):
    client, _ = approval_api
    approval = _approve(client).json()["approval"]
    message = approval["prepared_message"]

    assert message.startswith("السلام عليكم C")
    assert "وحدة 103" in message
    assert "8,000 ر.س" in message
    assert "2 شهر" in message


def test_unknown_decision_returns_404(approval_api):
    client, _ = approval_api
    response = _approve(client, decision_id="missing")

    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "decision_not_found"


def test_unknown_analysis_returns_404(approval_api):
    client, _ = approval_api
    response = _approve(client, analysis_id="missing-analysis")

    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "analysis_not_found"


def test_decision_from_another_analysis_is_rejected(approval_api):
    client, _ = approval_api
    response = _approve(client, analysis_id="analysis-a", decision_id="late-b-103")

    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "decision_not_found"


def test_decision_without_confirmation_is_rejected(approval_api):
    client, fake_db = approval_api
    state = _ai_state(decisions=[_decision(requires_confirmation=False)])
    fake_db[spp_server._AI_STATE_COLLECTION].docs["analysis-a"] = state

    response = _approve(client)
    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "confirmation_not_required"


def test_repeated_approval_is_idempotent(approval_api):
    client, fake_db = approval_api
    first = _approve(client).json()
    second = _approve(client).json()

    assert first["idempotent_replay"] is False
    assert second["idempotent_replay"] is True
    assert first["approval"]["approval_id"] == second["approval"]["approval_id"]
    assert first["approval"]["approved_at"] == second["approval"]["approved_at"]
    assert len(fake_db["decision_approvals"].docs) == 1


def test_no_whatsapp_or_gas_send_occurs(approval_api, monkeypatch):
    client, _ = approval_api

    def _unexpected_send():
        raise AssertionError("No external sender may be called")

    monkeypatch.setattr(spp_server, "get_gas_client", _unexpected_send)
    response = _approve(client)
    assert response.status_code == 200
    assert response.json()["approval"]["delivery_status"] == "not_sent"


def test_external_message_override_is_rejected(approval_api):
    client, _ = approval_api
    response = _approve(client, prepared_message="نص خارجي")

    assert response.status_code == 422


@pytest.mark.parametrize(
    ("decision", "code"),
    [
        (_decision(kind="renewal"), "unsupported_decision_kind"),
        (_decision(blocked_by_gate=True), "decision_blocked_by_gate"),
        (_decision(gate_status="blocked_for_review"), "decision_blocked_by_gate"),
    ],
)
def test_unsupported_or_blocked_decisions_are_rejected(approval_api, decision, code):
    client, fake_db = approval_api
    fake_db[spp_server._AI_STATE_COLLECTION].docs["analysis-a"] = _ai_state(
        decisions=[decision]
    )

    response = _approve(client)
    assert response.status_code == 409
    assert response.json()["detail"]["code"] == code


def test_mongo_unavailable_fails_closed(approval_api):
    client, _ = approval_api
    spp_server._mongo_available = False
    response = _approve(client)

    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "approval_store_unavailable"
