"""P0 — Apply-derived notifications from ai_state (arrears + near-expiry)."""

from __future__ import annotations

import os
import sys
from pathlib import Path
from unittest.mock import patch

os.environ.setdefault("SPP_BETA_MODE", "true")
os.environ.setdefault("SPP_DEMO_MODE", "true")
os.environ.setdefault("SPP_DATA_SOURCE", "mongo")
os.environ.pop("GAS_WEB_APP_URL", None)
os.environ.pop("GAS_DEPLOYMENT_URL", None)

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO))
sys.path.insert(0, str(REPO / "backend"))

import pytest
from fastapi.testclient import TestClient

import server as spp_server
from adapters.gas_import_bridge import _import_sessions
from adapters.mappers.ai_notifications import derive_notifications_from_ai_state

API = "/api"

CSV_JAN = (
    "وحدة,مستأجر,إيجار,حالة,جوال,عقد\n"
    "101,A,5000,مسدد,0501111111,C1\n"
    "102,B,4500,مسدد,0502222222,C2\n"
    "103,C,4000,متأخر,0503333333,C3\n"
)
CSV_FEB = (
    "وحدة,مستأجر,إيجار,حالة,جوال,عقد\n"
    "101,A,5000,مسدد,0501111111,C1\n"
    "102,D,4800,مسدد,0504444444,C4\n"
    "103,C,4000,متأخر,0503333333,C3\n"
)
CSV_ALL_PAID = (
    "وحدة,مستأجر,إيجار,حالة,جوال,عقد\n"
    "101,A,5000,مسدد,0501111111,C1\n"
    "102,B,4500,مسدد,0502222222,C2\n"
)


def _req15_files():
    return [
        {"name": "كشف_شهر_1_2026.csv", "textSnippet": CSV_JAN, "mimeType": "text/csv"},
        {"name": "كشف_شهر_2_2026.csv", "textSnippet": CSV_FEB, "mimeType": "text/csv"},
    ]


def _all_paid_files():
    return [
        {"name": "كشف_شهر_1_2026.csv", "textSnippet": CSV_ALL_PAID, "mimeType": "text/csv"},
    ]


@pytest.fixture()
def api_client():
    spp_server._mongo_available = False
    spp_server._memory_clear()
    spp_server._portfolio_cache = None  # type: ignore[assignment]
    spp_server._portfolio_cache_at = 0.0  # type: ignore[assignment]
    _import_sessions.clear()
    spp_server._memory_db.pop(spp_server._AI_STATE_COLLECTION, None)
    spp_server._memory_db.pop(spp_server._AI_STATE_LATEST_COLLECTION, None)
    spp_server._last_applied_analysis = None  # type: ignore[assignment]
    spp_server.EMERGENT_LLM_KEY = ""  # type: ignore[assignment]
    with TestClient(spp_server.app) as client:
        yield client


def _upload_and_apply(client, files=None):
    files = files or _req15_files()
    r = client.post(f"{API}/upload/portfolio-analysis", json={"files": files, "lang": "ar"})
    assert r.status_code == 200
    aid = r.json().get("analysis_id")
    assert aid
    a = client.post(f"{API}/upload/apply-analysis", json={"analysis_id": aid, "files": files})
    assert a.status_code == 200, a.text
    assert a.json().get("ok") is True
    return aid, a.json()


class TestDeriveNotificationsMapper:
    def test_fake_ai_state_late_and_renewal(self):
        ai_state = {
            "analysis_id": "preview_abc",
            "applied_at": "2026-07-21T12:00:00+00:00",
            "normalized_lifecycle": {
                "late_tenants": [{"tenant": "C", "unit": "103"}],
            },
            "unified_smart_decisions": [
                {
                    "id": "lc_c|103",
                    "kind": "contact_late_tenant",
                    "tenant_name": "C",
                    "unit_label": "103",
                    "why": "متابعة تحصيل 4,000 ر.س",
                    "priority": "high",
                    "provenance": {"sources": ["lifecycle"]},
                },
                {
                    "id": "rn_102",
                    "kind": "renewal",
                    "tenant_name": "D",
                    "unit_label": "102",
                    "action": "تجديد العقد خلال 45 يومًا",
                    "priority": "high",
                },
            ],
        }
        notifs = derive_notifications_from_ai_state(ai_state)
        assert len(notifs) == 2
        assert all("preview_abc" in n["body"] for n in notifs)
        assert any("متأخر" in n["title"] or "تحصيل" in n["title"] for n in notifs)
        assert any("عقد" in n["title"] or "تجديد" in n["body"] for n in notifs)
        assert derive_notifications_from_ai_state(ai_state) == notifs

    def test_empty_unified_and_no_late_returns_empty(self):
        ai_state = {
            "analysis_id": "clean_1",
            "applied_at": "2026-07-21T12:00:00+00:00",
            "unified_smart_decisions": [],
            "normalized_lifecycle": {"late_tenants": []},
            "property_knowledge": {"late": {"tenants": []}},
        }
        assert derive_notifications_from_ai_state(ai_state) == []

    def test_blocked_gate_late_omitted(self):
        ai_state = {
            "analysis_id": "blocked_1",
            "applied_at": "2026-07-21T12:00:00+00:00",
            "unified_smart_decisions": [
                {
                    "id": "lc_c|103",
                    "kind": "contact_late_tenant",
                    "tenant_name": "C",
                    "unit_label": "103",
                    "blocked_by_gate": True,
                }
            ],
        }
        assert derive_notifications_from_ai_state(ai_state) == []


class TestApplyNotificationsApi:
    def test_apply_req15_derives_late_notifications(self, api_client):
        aid, _ = _upload_and_apply(api_client)
        r = api_client.get(f"{API}/notifications")
        assert r.status_code == 200
        notifs = r.json()
        assert isinstance(notifs, list)
        assert len(notifs) >= 1
        assert all(str(n.get("id", "")).startswith("n_ai_") for n in notifs)
        assert not any(str(n.get("id", "")).startswith("n_1") for n in notifs)
        joined = " ".join(f"{n.get('title', '')} {n.get('body', '')}" for n in notifs)
        assert "103" in joined or "C" in joined
        assert "متأخر" in joined or "تحصيل" in joined
        assert all(n.get("analysis_id") == aid or aid in str(n.get("body", "")) for n in notifs)

    def test_renewal_notification_after_session_inject(self, api_client):
        files = _req15_files()
        r = api_client.post(f"{API}/upload/portfolio-analysis", json={"files": files, "lang": "ar"})
        aid = r.json()["analysis_id"]
        session = _import_sessions[aid]
        unified = list(session.get("unified_smart_decisions") or [])
        unified.append(
            {
                "id": "rn_test_102",
                "kind": "renewal",
                "tenant_name": "D",
                "unit_label": "102",
                "action": "تجديد العقد خلال 30 يومًا",
                "priority": "high",
            }
        )
        session["unified_smart_decisions"] = unified
        _import_sessions[aid] = session

        a = api_client.post(f"{API}/upload/apply-analysis", json={"analysis_id": aid, "files": files})
        assert a.status_code == 200
        notifs = api_client.get(f"{API}/notifications").json()
        joined = " ".join(f"{n.get('title', '')} {n.get('body', '')}" for n in notifs)
        assert "عقد" in joined or "تجديد" in joined

    def test_repeated_apply_same_analysis_id_idempotent(self, api_client):
        files = _req15_files()
        aid, _ = _upload_and_apply(api_client, files=files)
        ids1 = sorted(n["id"] for n in api_client.get(f"{API}/notifications").json())
        api_client.post(f"{API}/upload/apply-analysis", json={"analysis_id": aid, "files": files})
        ids2 = sorted(n["id"] for n in api_client.get(f"{API}/notifications").json())
        assert ids1 == ids2
        assert len(ids1) == len(set(ids1))

    def test_no_late_no_renewal_empty_notifications(self, api_client):
        files = _all_paid_files()
        aid, body = _upload_and_apply(api_client, files=files)
        assert body.get("ai_state_persisted") is True
        notifs = api_client.get(f"{API}/notifications").json()
        assert notifs == []

    def test_gas_success_path_persists_ai_state(self, api_client):
        files = _req15_files()
        r = api_client.post(f"{API}/upload/portfolio-analysis", json={"files": files, "lang": "ar"})
        aid = r.json()["analysis_id"]

        with patch.object(spp_server, "gas_import_available", return_value=True), patch(
            "server.apply_gas_import",
            return_value={"ok": True, "result": {"unitsCreated": 3}},
        ):
            resp = api_client.post(
                f"{API}/upload/apply-analysis",
                json={"analysis_id": aid, "files": files},
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("gas") is True
        assert data.get("ai_state_persisted") is True

        loaded = spp_server._ai_state_memory_store().get(aid)
        assert loaded is not None
        assert loaded.get("koil_reasoning")
        assert loaded.get("property_knowledge")
