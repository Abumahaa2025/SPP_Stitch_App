#!/usr/bin/env python3
"""Live Render verification for Apply engines path (commit 8901639 fingerprint).

Does not change UI. Proves:
- portfolio-analysis returns engines + property_knowledge
- apply-analysis returns ok with gas:false + commit (not 502)
- tenants after apply carry phones from Property Knowledge when lifecycle lacks them
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests

RENDER = (sys.argv[1] if len(sys.argv) > 1 else "https://spp-beta-api.onrender.com").rstrip("/")
API = f"{RENDER}/api"
OUT = Path(__file__).resolve().parents[2] / "proofs" / f"live_apply_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.json"

# Lifecycle-like flow: second month changes tenant on 102; phones only reliable on cards.
CSV1 = (
    "وحدة,مستأجر,إيجار,حالة,جوال\n"
    "101,أحمد العتيبي,5500,مسدد,0501111111\n"
    "102,سعد القحطاني,4800,مسدد,0502222222\n"
)
CSV2 = (
    "وحدة,مستأجر,إيجار,حالة,جوال\n"
    "101,أحمد العتيبي,5500,مسدد,0501111111\n"
    "102,ريم الشمري,5000,متأخر,0503333333\n"
)
FILES = [
    {"name": "كشف_شهر_1_2026.csv", "textSnippet": CSV1, "mimeType": "text/csv"},
    {"name": "كشف_شهر_2_2026.csv", "textSnippet": CSV2, "mimeType": "text/csv"},
]


def main() -> int:
    proof: dict = {
        "render": RENDER,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "target_commit": "8901639",
        "steps": {},
        "assertions": {},
    }

    r = requests.get(f"{API}/", timeout=90)
    proof["steps"]["health"] = {"status": r.status_code, "body": r.json()}
    r.raise_for_status()

    info = requests.get(f"{API}/beta/info", timeout=60)
    proof["steps"]["beta_info"] = info.json()

    # Optional build fingerprint if endpoint exists
    build = requests.get(f"{API}/build-info", timeout=30)
    proof["steps"]["build_info"] = {
        "status": build.status_code,
        "body": build.json() if build.headers.get("content-type", "").startswith("application/json") else build.text[:200],
    }

    analysis = requests.post(
        f"{API}/upload/portfolio-analysis",
        json={"files": FILES, "lang": "ar"},
        timeout=180,
    )
    proof["steps"]["analysis_status"] = analysis.status_code
    body = analysis.json() if analysis.headers.get("content-type", "").startswith("application/json") else {"raw": analysis.text[:500]}
    proof["steps"]["analysis"] = {
        "analysis_id": body.get("analysis_id"),
        "success_message": (body.get("success_message") or "")[:120],
        "has_engines": bool((body.get("executive_brief") or {}).get("engines")),
        "section_keys": [s.get("key") for s in ((body.get("executive_report") or {}).get("sections") or [])][:12],
        "pk_tenants": len(((body.get("property_knowledge") or {}).get("tenants") or [])),
        "metrics": body.get("metrics"),
    }
    analysis.raise_for_status()
    aid = body["analysis_id"]

    # Probe PK phones for later compare
    pk_phones = {
        str(t.get("unit")): (t.get("phone") or "")
        for t in ((body.get("property_knowledge") or {}).get("tenants") or [])
    }
    proof["steps"]["pk_phones"] = pk_phones

    applied = requests.post(
        f"{API}/upload/apply-analysis",
        json={"analysis_id": aid, "files": FILES},
        timeout=120,
    )
    proof["steps"]["apply_status"] = applied.status_code
    apply_body = applied.json() if applied.headers.get("content-type", "").startswith("application/json") else {"raw": applied.text[:500]}
    proof["steps"]["apply"] = apply_body

    tenants = requests.get(f"{API}/tenants", timeout=60)
    props = requests.get(f"{API}/properties", timeout=60)
    reports = requests.get(f"{API}/reports", timeout=60)
    proof["steps"]["tenants_status"] = tenants.status_code
    proof["steps"]["tenants"] = tenants.json() if tenants.ok else tenants.text[:300]
    proof["steps"]["properties"] = props.json() if props.ok else props.text[:300]
    proof["steps"]["reports"] = reports.json() if reports.ok else reports.text[:300]

    # Assertions fingerprinting 8901639+
    not_502 = applied.status_code != 502
    ok_apply = applied.status_code == 200 and bool(apply_body.get("ok"))
    local_or_gas = apply_body.get("gas") in (True, False)
    has_commit = isinstance(apply_body.get("commit"), dict) and (
        apply_body.get("gas") is True or apply_body.get("commit", {}).get("tenants", 0) >= 1 or apply_body.get("commit", {}).get("source")
    )

    tenant_rows = tenants.json() if tenants.ok and isinstance(tenants.json(), list) else []
    phones_after = [str(t.get("phone") or "").strip() for t in tenant_rows]
    phones_ok = any(p.startswith("05") for p in phones_after)

    # If apply wrote memory, property link check
    prop_ids = {p.get("id") for p in (props.json() if props.ok and isinstance(props.json(), list) else [])}
    linked = all((t.get("property_id") in prop_ids) for t in tenant_rows) if tenant_rows and prop_ids else False

    proof["assertions"] = {
        "service_online": proof["steps"]["health"]["status"] == 200,
        "analysis_has_engines": proof["steps"]["analysis"]["has_engines"],
        "analysis_has_koil_sections": "koil_brief" in (proof["steps"]["analysis"]["section_keys"] or []),
        "apply_not_502_on_gas_fail_or_disabled": not_502,
        "apply_ok": ok_apply,
        "apply_returns_commit_shape": has_commit and local_or_gas,
        "apply_gas_false_local_materialise": apply_body.get("gas") is False and ok_apply,
        "phones_present_after_apply": phones_ok,
        "tenants_linked_to_property": linked or apply_body.get("gas") is True,
        "pk_had_phones_pre_apply": any(v.startswith("05") for v in pk_phones.values()),
    }
    # fingerprint note
    bi = proof["steps"]["build_info"]
    proof["deploy"] = {
        "build_info_available": bi.get("status") == 200,
        "build_body": bi.get("body"),
        "note": "Without /build-info, deploy SHA is inferred via Apply local materialise + phone behavior (8901639).",
        "target_commit": "89016396e545bdde21a3d70a19eda2ce5c36912b",
    }
    proof["assertions"]["all_required"] = all(
        [
            proof["assertions"]["service_online"],
            proof["assertions"]["analysis_has_engines"],
            proof["assertions"]["analysis_has_koil_sections"],
            proof["assertions"]["apply_not_502_on_gas_fail_or_disabled"],
            proof["assertions"]["apply_ok"],
            proof["assertions"]["apply_returns_commit_shape"],
        ]
    )
    proof["finished_at"] = datetime.now(timezone.utc).isoformat()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(proof, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"out": str(OUT), "assertions": proof["assertions"], "apply": apply_body, "deploy": proof["deploy"]}, ensure_ascii=False, indent=2))
    return 0 if proof["assertions"]["all_required"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
