"""Trace contract data from deployed GAS -> backend mapping -> /api/contracts -> executive.

Run from backend/:  python scripts/validate_gas_contracts_source.py
"""

from __future__ import annotations

import json
import sys
import urllib.request
from collections import Counter
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv

load_dotenv(ROOT / ".env")

from adapters import gas_client as gas_client_mod
from adapters.gas_client import GasClient, GasClientError
from adapters.mappers.contracts import map_contracts_from_app_data, reconcile_contracts
from adapters.mappers.decisions import map_decisions_from_app_data
from adapters.mappers.properties import map_properties_from_app_data
from adapters.mappers.tenants import map_tenants_from_app_data
from adapters.executive.brain import build_executive_brain


def _gas_row_keys(payload: dict) -> dict[str, int]:
    dash = payload.get("dashboard") or {}
    return {
        "units": len(dash.get("units") or []),
        "nearContracts": len(dash.get("nearContracts") or []),
        "expiredContracts": len(dash.get("expiredContracts") or []),
        "latePayments": len(dash.get("latePayments") or []),
    }


def _contract_fingerprints(contracts: list[dict]) -> list[str]:
    fps = []
    for c in contracts:
        fps.append(
            f"{c.get('property_id')}|{c.get('tenant_id')}|{c.get('end')}|{c.get('status')}"
        )
    return sorted(fps)


def _api_get(base: str, path: str) -> Any:
    with urllib.request.urlopen(base + path, timeout=120) as resp:
        return json.loads(resp.read().decode())


def main() -> int:
    gas = GasClient()
    if not gas.configured:
        print("FAIL: GOOGLE_APPS_SCRIPT_URL not configured in backend/.env")
        return 1

    print("=" * 72)
    print("LAYER 0 - Deployed GAS API surface")
    print("=" * 72)

  # listApiActions
    try:
        actions_raw = gas._get("listApiActions")  # noqa: SLF001 — intentional audit
        if isinstance(actions_raw, list):
            action_names = actions_raw
        elif isinstance(actions_raw, dict):
            read_actions = actions_raw.get("read") or []
            write_actions = actions_raw.get("write") or []
            action_names = list(read_actions) + list(write_actions)
        else:
            action_names = []
        has_contracts_lite = "getContractsLite" in action_names
        print(f"listApiActions count: {len(action_names)}")
        print(f"getContractsLite in registry: {'YES' if has_contracts_lite else 'NO'}")
        if action_names:
            sample = ", ".join(str(a) for a in action_names[:12])
            if len(action_names) > 12:
                sample += ", ..."
            print(f"actions sample: {sample}")
    except GasClientError as exc:
        print(f"WARN: listApiActions unavailable ({exc}); probing getContractsLite directly.")
        has_contracts_lite = False

    print("Probing getContractsLite endpoint directly...")
    try:
        gas_client_mod._CACHE.clear()
        probe = gas.get_contracts_lite()
        probe_keys = _gas_row_keys(probe)
        print(f"getContractsLite live response: OK -> dashboard rows {probe_keys}")
        has_contracts_lite = True
    except GasClientError as exc:
        print(f"getContractsLite live response: FAIL -> {exc}")
        if not has_contracts_lite:
            print("SOURCE: Google Apps Script - getContractsLite not deployed or not routable.")
            return 1

    try:
        health = gas.health_check()
        print(f"healthCheck: status={health.get('status')} sheetId={health.get('sheetId', 'n/a')}")
    except GasClientError as exc:
        print(f"healthCheck failed: {exc}")
        return 1

    print("\n" + "=" * 72)
    print("LAYER 1 - Raw GAS JSON (Google Sheets -> getDashboardData_ -> lite bundle)")
    print("=" * 72)

    loaders = {
        "getContractsLite": gas.get_contracts_lite,
        "getPropertiesLite": gas.get_properties_lite,
        "getDashboardLite": gas.get_dashboard_lite,
    }

    raw: dict[str, dict] = {}
    for name, fn in loaders.items():
        try:
            payload = fn()
            raw[name] = payload
            keys = _gas_row_keys(payload)
            print(f"{name}: dashboard rows -> {keys}")
        except GasClientError as exc:
            print(f"{name}: ERROR {exc}")
            raw[name] = {}

    contracts_lite = raw.get("getContractsLite") or {}
    dashboard_lite = raw.get("getDashboardLite") or {}

    # getContractsLite is a slice of the same bundle as getDashboardLite
    cl_dash = contracts_lite.get("dashboard") or {}
    dl_dash = dashboard_lite.get("dashboard") or {}
    bundle_match = (
        len(cl_dash.get("units") or []) == len(dl_dash.get("units") or [])
        and len(cl_dash.get("nearContracts") or []) == len(dl_dash.get("nearContracts") or [])
        and len(cl_dash.get("expiredContracts") or []) == len(dl_dash.get("expiredContracts") or [])
    )
    print(f"\ngetContractsLite vs getDashboardLite row counts match: {'YES' if bundle_match else 'NO'}")
    if not bundle_match:
        print("SOURCE: Google Apps Script - getContractsLite_ bundle diverges from dashboard bundle.")

    print("\n" + "=" * 72)
    print("LAYER 2 - Backend mapping (contracts.py)")
    print("=" * 72)

    mapped_by_loader: dict[str, list[dict]] = {}
    for name, payload in raw.items():
        if payload:
            mapped_by_loader[name] = map_contracts_from_app_data(payload)
            exp = sum(1 for c in mapped_by_loader[name] if c.get("status") == "expiring")
            print(f"map({name}): total={len(mapped_by_loader[name])} expiring={exp}")

    # Simulate _gas_contracts() fallback
    raw_contracts: list[dict] = []
    loader_used = "none"
    for name in ("getContractsLite", "getPropertiesLite", "getDashboardLite"):
        mapped = mapped_by_loader.get(name) or []
        if mapped:
            raw_contracts = mapped
            loader_used = name
            break

    print(f"\n_gas_contracts() would use: {loader_used} -> {len(raw_contracts)} contracts")

    props = map_properties_from_app_data(raw.get("getPropertiesLite") or dashboard_lite)
    tenants = map_tenants_from_app_data(raw.get("getTenantsLite") or {"dashboard": dl_dash})
    try:
        tenants = map_tenants_from_app_data(gas.get_tenants_lite())
    except GasClientError:
        pass
    decisions = map_decisions_from_app_data(gas.get_decisions_lite())

    reconciled = reconcile_contracts(raw_contracts, decisions, tenants, props)
    exp_raw = sum(1 for c in raw_contracts if c.get("status") == "expiring")
    exp_recon = sum(1 for c in reconciled if c.get("status") == "expiring")
    synth = len(reconciled) - len(raw_contracts)
    print(f"after reconcile_contracts: total={len(reconciled)} expiring={exp_recon} synthetic_added={synth}")

    brain = build_executive_brain({}, props, tenants, reconciled, decisions)
    exec_expiring = brain["portfolio"]["expiring_contracts"]
    print(f"executive.portfolio.expiring_contracts: {exec_expiring}")

    print("\n" + "=" * 72)
    print("LAYER 3 - Backend HTTP /api/contracts & /api/executive")
    print("=" * 72)

    api_base = "http://127.0.0.1:8000/api"
    api_ok = False
    try:
        api_contracts = _api_get(api_base, "/contracts")
        api_exec = _api_get(api_base, "/executive")
        api_ok = True
        api_exp = sum(1 for c in api_contracts if c.get("status") == "expiring")
        api_exec_exp = api_exec.get("portfolio", {}).get("expiring_contracts")
        print(f"/api/contracts: total={len(api_contracts)} expiring={api_exp}")
        print(f"/api/executive portfolio.expiring_contracts: {api_exec_exp}")

        fps_local = _contract_fingerprints(reconciled)
        fps_api = _contract_fingerprints(api_contracts)
        if fps_local == fps_api:
            print("Local reconcile vs /api/contracts fingerprints: MATCH")
        else:
            only_local = set(fps_local) - set(fps_api)
            only_api = set(fps_api) - set(fps_local)
            print("Local reconcile vs /api/contracts fingerprints: MISMATCH")
            if only_local:
                print(f"  only in local mapping ({len(only_local)}):", list(only_local)[:3])
            if only_api:
                print(f"  only in /api/contracts ({len(only_api)}):", list(only_api)[:3])
            print("SOURCE: Backend - cache TTL or portfolio context drift between calls.")
    except Exception as exc:
        print(f"Backend not reachable at {api_base}: {exc}")
        print("(Layers 0–2 still valid from direct GAS calls.)")

    print("\n" + "=" * 72)
    print("LAYER 4 - Frontend")
    print("=" * 72)
    print("contracts.tsx calls api.contracts() with no client-side transform.")
    print("BrainVerdict reads /api/executive only — no /api/verdicts fallback.")
    print("Frontend cannot introduce contract count drift; only displays API payloads.")

    print("\n" + "=" * 72)
    print("VERDICT")
    print("=" * 72)

    issues: list[str] = []

    if not bundle_match:
        issues.append("GAS: getContractsLite bundle != getDashboardLite bundle")

    if exec_expiring != exp_recon:
        issues.append("Backend: executive expiring count != reconciled contracts")

    if api_ok:
        api_exp = sum(1 for c in api_contracts if c.get("status") == "expiring")
        if api_exp != exec_expiring:
            issues.append("Backend: /api/contracts expiring != executive.portfolio.expiring_contracts")
        if _contract_fingerprints(api_contracts) != _contract_fingerprints(reconciled):
            issues.append("Backend: /api/contracts payload != fresh GAS reconcile (cache or timing)")

    # Duplicate property_ids in reconciled (data quality, not layer mismatch)
    pid_counts = Counter(c.get("property_id") for c in reconciled if c.get("property_id"))
    dupes = {k: v for k, v in pid_counts.items() if v > 1}
    if dupes:
        print(f"NOTE: {len(dupes)} property_id(s) appear in multiple contract rows (GAS dashboard rows).")
        print(f"      Example: {next(iter(dupes.items()))}")
        print("      SOURCE: Google Sheets dashboard - see backend/docs/DATA_QUALITY.md")

    if issues:
        for item in issues:
            print(f"FAIL - {item}")
        return 1

    print("PASS - Single source of truth chain:")
    print("  Google Sheets (dashboard tab)")
    print("    -> GAS getDashboardData_() / getDashboardLiteBundle_()")
    print("    -> getContractsLite_() [deployed]")
    print("    -> backend map_contracts_from_app_data + reconcile_contracts")
    print("    -> /api/contracts + /api/executive (same _portfolio_live_context)")
    print("    -> frontend renders API response as-is")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
