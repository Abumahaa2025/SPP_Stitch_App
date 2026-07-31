"""Live API consistency check — Executive Brain vs portfolio endpoints."""

from __future__ import annotations

import json
import sys
import urllib.request


def get(base: str, path: str) -> dict | list:
    with urllib.request.urlopen(base + path, timeout=120) as resp:
        return json.loads(resp.read().decode())


def main() -> int:
    base = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000/api"
    exec_ = get(base, "/executive")
    contracts = get(base, "/contracts")
    props = get(base, "/properties")
    tenants = get(base, "/tenants")
    decisions = get(base, "/decisions")

    pf = exec_.get("portfolio") or {}
    expiring = [c for c in contracts if c.get("status") == "expiring"]
    ranked = exec_.get("ranked_decisions") or []
    renewals = [
        r
        for r in ranked
        if r.get("kind") in ("renewal", "tenant") or r.get("route") == "/contracts"
    ]
    renewal_pids = {r.get("property_id") for r in renewals if r.get("property_id")}
    expiring_pids = {c.get("property_id") for c in expiring}
    orphans = renewal_pids - expiring_pids

    checks = [
        ("properties count", len(props), pf.get("units")),
        ("tenants count", len(tenants), pf.get("tenants")),
        ("expiring contracts", len(expiring), pf.get("expiring_contracts")),
        ("orphan renewals", len(orphans), 0),
    ]

    print("=== END-TO-END CONSISTENCY ===")
    ok = True
    for label, actual, expected in checks:
        passed = actual == expected
        ok = ok and passed
        status = "PASS" if passed else "FAIL"
        print(f"{status} {label}: {actual} vs executive {expected}")

    print(f"occupancy_pct: {pf.get('occupancy_pct')}")
    print(f"avg_health: {pf.get('avg_health')}")
    print(f"annual_revenue_aed: {pf.get('annual_revenue_aed')}")
    print(f"contracts total: {len(contracts)}")
    print(f"maintenance decisions: {len([d for d in decisions if d.get('kind') == 'maintenance'])}")

    if ok:
        print("\nMILESTONE BLOCKER: RESOLVED")
        return 0
    print("\nMILESTONE BLOCKER: OPEN")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
