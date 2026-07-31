"""Iteration 6 — final smoke test.

Verifies all 18 backend /api endpoints return 200 and the upload → apply
round-trip returns ok:true.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Local fallback used only inside container tests
    BASE_URL = "http://localhost:8001"


GET_ENDPOINTS = [
    "/api/",
    "/api/briefing",
    "/api/executive",
    "/api/portfolio-memory",
    "/api/intelligence",
    "/api/properties",
    "/api/decisions",
    "/api/tenants",
    "/api/contracts",
    "/api/timeline",
    "/api/sensors",
    "/api/notifications",
    "/api/reports",
    "/api/knowledge",
    "/api/guides",
    "/api/owner",
    "/api/beta/info",
    "/api/build-info",
    "/api/verdicts",
    "/api/upload/last-applied",
]


@pytest.mark.parametrize("path", GET_ENDPOINTS)
def test_get_endpoint_returns_200(path):
    resp = requests.get(f"{BASE_URL}{path}", timeout=30)
    assert resp.status_code == 200, f"{path} → {resp.status_code}: {resp.text[:200]}"
    # ensure it's valid JSON
    resp.json()


def test_upload_analysis_and_apply_roundtrip():
    files_payload = {
        "files": [
            {
                "name": "TEST_portfolio.csv",
                "mimeType": "text/csv",
                "size": 128,
                "textSnippet": (
                    "property,unit,tenant,rent\n"
                    "Marina Crest,PH-01,TEST Alpha,24000\n"
                    "Marina Crest,PH-02,TEST Beta,22500\n"
                ),
            }
        ],
        "lang": "en",
    }

    analyze = requests.post(
        f"{BASE_URL}/api/upload/portfolio-analysis",
        json=files_payload,
        timeout=60,
    )
    assert analyze.status_code == 200, f"analyze status {analyze.status_code}: {analyze.text[:300]}"
    body = analyze.json()
    analysis_id = body.get("analysis_id") or body.get("id") or body.get("session_id")
    assert analysis_id, f"analyze response missing analysis_id: {body}"

    apply_resp = requests.post(
        f"{BASE_URL}/api/upload/apply-analysis",
        json={"analysis_id": analysis_id, "files": files_payload["files"]},
        timeout=60,
    )
    # Accept either 200 (full commit ok) or 404 if session expired between calls
    assert apply_resp.status_code == 200, f"apply status {apply_resp.status_code}: {apply_resp.text[:300]}"
    apply_body = apply_resp.json()
    assert apply_body.get("ok") is True, f"apply body not ok: {apply_body}"
    assert apply_body.get("analysis_id") == analysis_id
