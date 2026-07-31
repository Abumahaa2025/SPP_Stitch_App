"""E2E test: GAS Smart Import via API (real rent-roll snippets)."""
from __future__ import annotations

import json
import os
import sys

import requests

GAS_URL = os.environ.get(
    "GOOGLE_APPS_SCRIPT_URL",
    "https://script.google.com/macros/s/AKfycbx6Z_2_lNVJfbI2oVpkIKjRwAySQiZ5-WbhGpnw-WpNucH-6YZ0DHdlGP0XhH4XdVcb6A/exec",
).rstrip("/")
RENDER_URL = os.environ.get("RENDER_URL", "https://spp-beta-api.onrender.com").rstrip("/")

CSV1 = (
    "وحدة,مستأجر,إيجار,حالة\n"
    "101,أحمد العتيبي,5500,مسدد\n"
    "102,سعد القحطاني,4800,مسدد\n"
    "G-01,محل نور,12000,مسدد\n"
)
CSV2 = (
    "وحدة,مستأجر,إيجار,حالة\n"
    "101,أحمد العتيبي,5500,مسدد\n"
    "102,ريم الشمري,5000,مسدد\n"
    "G-01,محل نور,12000,متأخر\n"
)
CSV3 = (
    "وحدة,مستأجر,إيجار,حالة\n"
    "101,أحمد العتيبي,5500,مسدد\n"
    "102,ريم الشمري,5000,مسدد\n"
    "103,فهد الدوسري,6200,مسدد\n"
    "G-01,محل نور,12000,مسدد\n"
)

FILES = [
    {"name": "كشف_إيجار_شهر_1_2026.csv", "textSnippet": CSV1, "mimeType": "text/csv"},
    {"name": "كشف_إيجار_شهر_2_2026.csv", "textSnippet": CSV2, "mimeType": "text/csv"},
    {"name": "كشف_إيجار_شهر_3_2026.csv", "textSnippet": CSV3, "mimeType": "text/csv"},
    {
        "name": "كشف_صيانة_ومصروفات_2026.csv",
        "textSnippet": "البند,الوحدة,المبلغ\nصيانة مصعد,برج النخيل,4200\nسباكة,102,950\n",
        "mimeType": "text/csv",
    },
]


def gas_post(action: str, params: dict | None = None) -> dict:
    body = {"action": action, "params": params or {}}
    key = os.environ.get("SPP_API_KEY")
    if key:
        body["apiKey"] = key
    r = requests.post(GAS_URL, json=body, timeout=120)
    r.raise_for_status()
    env = r.json()
    if env.get("status") != "success":
        raise RuntimeError(env.get("message") or env)
    return env.get("data") or {}


def render_post(path: str, payload: dict) -> dict:
    r = requests.post(f"{RENDER_URL}/api{path}", json=payload, timeout=120)
    r.raise_for_status()
    return r.json()


def main() -> int:
    out: dict = {"gas_url": GAS_URL, "render_url": RENDER_URL, "steps": {}}

    print("1) GAS healthCheck...")
    hc = requests.get(f"{GAS_URL}?view=api&action=healthCheck", timeout=60).json()
    out["steps"]["health"] = hc.get("status")

    print("2) GAS runSmartPropertyImportPipeline...")
    pipe = gas_post("runSmartPropertyImportPipeline", {"filesMeta": FILES})
    out["steps"]["pipeline"] = {
        "ok": pipe.get("ok"),
        "batchId": pipe.get("batchId"),
        "mode": pipe.get("mode"),
        "headline": (pipe.get("report") or {}).get("headline"),
        "months": ((pipe.get("report") or {}).get("lifecycle") or {}).get("monthCount"),
        "departed": ((pipe.get("report") or {}).get("lifecycle") or {}).get("departedCount"),
        "active": ((pipe.get("report") or {}).get("lifecycle") or {}).get("activeCount"),
    }
    batch_id = pipe.get("batchId")
    if not batch_id:
        print(json.dumps(out, ensure_ascii=False, indent=2))
        return 1

    print("3) GAS createOwnerReportPdf...")
    try:
        pdf = gas_post("createOwnerReportPdf", {})
        out["steps"]["pdf"] = {"ok": pdf.get("ok"), "url": pdf.get("url", "")[:80]}
    except Exception as e:
        out["steps"]["pdf"] = {"error": str(e)}

    print("4) GAS commitSmartPropertyImportBatch...")
    try:
        commit = gas_post(
            "commitSmartPropertyImportBatch",
            {"batchId": batch_id, "filesMeta": FILES},
        )
        out["steps"]["commit"] = {
            "ok": commit.get("ok"),
            "result": commit.get("result"),
        }
    except Exception as e:
        out["steps"]["commit"] = {"error": str(e)}

    print("5) Render portfolio-analysis...")
    try:
        analysis = render_post("/upload/portfolio-analysis", {"files": FILES, "lang": "ar"})
        out["steps"]["render_analysis"] = {
            "analysis_id": analysis.get("analysis_id"),
            "engine": (analysis.get("intake_meta") or {}).get("engine"),
            "months_linked": (analysis.get("metrics") or {}).get("months_linked"),
            "success": analysis.get("success_message", "")[:120],
        }
        aid = analysis.get("analysis_id")
        if aid:
            print("6) Render apply-analysis...")
            try:
                applied = render_post("/upload/apply-analysis", {"analysis_id": aid, "files": FILES})
                out["steps"]["render_apply"] = applied
            except Exception as e:
                out["steps"]["render_apply"] = {"error": str(e)}
            print("7) Render create-pdf...")
            try:
                rp = render_post("/upload/create-pdf", {"analysis_id": aid})
                out["steps"]["render_pdf"] = rp
            except Exception as e:
                out["steps"]["render_pdf"] = {"error": str(e)}
    except Exception as e:
        out["steps"]["render_analysis"] = {"error": str(e)}

    text = json.dumps(out, ensure_ascii=False, indent=2)
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("utf-8", errors="replace").decode("utf-8"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
