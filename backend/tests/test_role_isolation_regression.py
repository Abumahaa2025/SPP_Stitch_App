"""SPP Backend Regression – iteration_4.
Covers all 18 endpoints listed in the review request, Upload → Analysis → Apply
flow, and the /api/executive `executive-v2` version guarantee.

Run against the public EXPO_PUBLIC_BACKEND_URL so we validate what the user sees.
"""
from __future__ import annotations

import io
import os
import pytest
import requests

# Load frontend/.env manually — pytest doesn't have dotenv.
_env_path = "/app/frontend/.env"
_env = {}
if os.path.exists(_env_path):
    for line in open(_env_path):
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        _env[k.strip()] = v.strip().strip('"').strip("'")

BASE_URL = _env.get("EXPO_PUBLIC_BACKEND_URL")
assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL not set in /app/frontend/.env"
BASE_URL = BASE_URL.rstrip("/")

ENDPOINTS = [
    "/api/briefing",
    "/api/executive",
    "/api/properties",
    "/api/tenants",
    "/api/contracts",
    "/api/reports",
    "/api/notifications",
    "/api/intelligence",
    "/api/portfolio-memory",
    "/api/sensors",
    "/api/decisions",
    "/api/timeline",
    "/api/knowledge",
    "/api/guides",
    "/api/beta/info",
    "/api/build-info",
    "/api/owner",
    "/api/verdicts",
]


@pytest.fixture(scope="module")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ------------- 18 endpoints must all be 200 -------------
@pytest.mark.parametrize("endpoint", ENDPOINTS)
def test_endpoint_returns_200(api_client, endpoint):
    r = api_client.get(f"{BASE_URL}{endpoint}", timeout=30)
    assert r.status_code == 200, f"{endpoint} → {r.status_code} · body={r.text[:200]}"
    # JSON body check
    body = r.json()
    assert body is not None


# ------------- /api/executive shape guarantee -------------
class TestExecutive:
    def test_version_executive_v2(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/executive", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data.get("version") == "executive-v2", f"got {data.get('version')}"

    def test_real_portfolio_numbers(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/executive", timeout=30)
        data = r.json()
        # Real shape: data.portfolio = { units, tenants, occupancy_pct, ... }
        portfolio = data.get("portfolio") or {}
        assert portfolio.get("units") == 42, f"units={portfolio.get('units')}"
        assert portfolio.get("tenants") == 42, f"tenants={portfolio.get('tenants')}"
        assert portfolio.get("occupancy_pct") == 100, (
            f"occupancy_pct={portfolio.get('occupancy_pct')}"
        )


# ------------- Upload → Analysis → Apply -------------
class TestUploadFlow:
    ARABIC_TEXT = (
        "تقرير المحفظة العقارية\n"
        "العقار: برج الرومي\n"
        "الوحدات: 42\n"
        "المستأجرين: 42\n"
        "معدل الإشغال: 100%\n"
        "الإيرادات السنوية: 1,200,000 د.ك\n"
    )

    def test_upload_portfolio_analysis(self, api_client):
        payload = {
            "files": [
                {
                    "name": "portfolio_test.txt",
                    "mimeType": "text/plain",
                    "size": len(self.ARABIC_TEXT.encode("utf-8")),
                    "textSnippet": self.ARABIC_TEXT,
                }
            ],
            "lang": "ar",
        }
        r = requests.post(
            f"{BASE_URL}/api/upload/portfolio-analysis",
            json=payload,
            timeout=90,
        )
        assert r.status_code == 200, f"upload → {r.status_code}: {r.text[:300]}"
        data = r.json()
        assert "analysis_id" in data, f"missing analysis_id: {list(data.keys())}"
        assert data.get("executive_report") or data.get("report"), "no executive_report"
        assert data.get("metrics") is not None, "no metrics field"
        # Stash for the follow-up test
        pytest._SPP_ANALYSIS_ID = data["analysis_id"]
        pytest._SPP_UPLOAD_FILES = payload["files"]

    def test_apply_analysis(self, api_client):
        analysis_id = getattr(pytest, "_SPP_ANALYSIS_ID", None)
        if not analysis_id:
            pytest.skip("upload test did not produce analysis_id")
        files = getattr(pytest, "_SPP_UPLOAD_FILES", None)
        r = requests.post(
            f"{BASE_URL}/api/upload/apply-analysis",
            json={"analysis_id": analysis_id, "files": files},
            timeout=60,
        )
        assert r.status_code == 200, f"apply → {r.status_code}: {r.text[:300]}"
        data = r.json()
        assert data.get("ok") is True, f"apply did not return ok=true: {data}"
