"""
WP-1 practical proof — operational base from real analysis payload.

Mirrors frontend/src/utils/apply-analysis-to-os.ts materialisation + merge rules.
Writes a durable JSON store (simulates close/reopen of PropertyOS storage).
No engine/backend/Render/master changes.
"""
from __future__ import annotations

import json
import re
import sys
from copy import deepcopy
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "backend"))

from adapters.upload_analysis.portfolio_engine import analyze_upload_portfolio

PROOF_DIR = REPO / "proofs" / "wp1_operational_base"
STORE = PROOF_DIR / "property_os_store.json"
BATCHES = PROOF_DIR / "import_batches.json"
REPORT = PROOF_DIR / "PROOF_WP1.md"


def slug(v: str) -> str:
    s = re.sub(r"[^\w\u0600-\u06FF-]", "", str(v or "").strip().replace(" ", "_"))
    return s or "x"


def num(v) -> float:
    try:
        return float(v or 0)
    except (TypeError, ValueError):
        return 0.0


def load_files(paths: list[Path]) -> list[dict]:
    out = []
    for p in paths:
        out.append(
            {
                "name": p.name,
                "textSnippet": p.read_text(encoding="utf-8"),
                "mimeType": "text/csv",
            }
        )
    return out


def analyze(paths: list[Path]) -> dict:
    return analyze_upload_portfolio(
        load_files(paths),
        {"properties": [], "tenants": [], "contracts": [], "decisions": [], "reports": []},
        lang="ar",
    )


def build_rows(analysis: dict) -> list[dict]:
    pk = analysis.get("property_knowledge") or {}
    cards = pk.get("tenants") or []
    active = (pk.get("lifecycle") or {}).get("active") or []
    late = analysis.get("late_payments") or {}
    by_unit: dict[str, dict] = {}

    def ensure(unit_raw, idx: int) -> dict:
        unit = str(unit_raw or "").strip() or str(idx + 1)
        if unit not in by_unit:
            by_unit[unit] = {
                "unit": unit,
                "tenant": "",
                "phone": "",
                "rent": 0.0,
                "contractNumber": "",
                "contractStart": "",
                "contractEnd": "",
                "months": [],
            }
        return by_unit[unit]

    for i, c in enumerate(cards):
        row = ensure(c.get("unit"), i)
        row["tenant"] = (c.get("tenant") or row["tenant"] or "").strip()
        row["phone"] = (c.get("phone") or row["phone"] or "").strip()
        row["rent"] = num(c.get("rent")) or row["rent"]
        row["contractNumber"] = (c.get("contract") or row["contractNumber"] or "").strip()
        row["contractStart"] = (
            c.get("contract_start") or c.get("contract_start_label") or row["contractStart"] or ""
        ).strip()
        row["contractEnd"] = (
            c.get("contract_end") or c.get("contract_end_label") or row["contractEnd"] or ""
        ).strip()
        for m in c.get("months") or []:
            row["months"].append(
                {
                    "label": m.get("label"),
                    "year": m.get("year"),
                    "month": m.get("month"),
                    "due": num(m.get("due")),
                    "paid": num(m.get("paid")),
                    "remaining": num(m.get("remaining")),
                    "status": m.get("status") or "",
                    "statusLabel": m.get("status_label"),
                    "source": "tenant_card",
                    "pay_status_raw": m.get("pay_status_raw"),
                }
            )

    for i, a in enumerate(active):
        row = ensure(a.get("unit"), len(cards) + i)
        # Current occupancy from lifecycle.active wins over historical card names.
        if (a.get("tenant") or "").strip():
            row["tenant"] = str(a.get("tenant")).strip()
        if (a.get("phone") or "").strip():
            row["phone"] = str(a.get("phone")).strip()
        if num(a.get("rent")):
            row["rent"] = num(a.get("rent"))

    seen = {f"{r['unit']}|{m['label']}" for r in by_unit.values() for m in r["months"]}
    for mth in late.get("months") or []:
        for i, te in enumerate(mth.get("tenants") or []):
            row = ensure(te.get("unit"), i)
            if not row["tenant"]:
                row["tenant"] = (te.get("tenant") or "").strip()
            if not row["phone"]:
                row["phone"] = (te.get("phone") or "").strip()
            if not row["contractNumber"] and te.get("contract"):
                row["contractNumber"] = str(te.get("contract")).strip()
            key = f"{row['unit']}|{mth.get('label')}"
            if key not in seen:
                seen.add(key)
                row["months"].append(
                    {
                        "label": mth.get("label"),
                        "year": mth.get("year"),
                        "month": mth.get("month"),
                        "due": num(te.get("due")),
                        "paid": num(te.get("paid")),
                        "remaining": num(te.get("remaining")),
                        "status": te.get("status") or "unpaid",
                        "statusLabel": te.get("status_label"),
                        "source": "late_payments",
                    }
                )

    return [r for r in by_unit.values() if r["tenant"] or r["unit"]]


def materialize(analysis: dict, existing_property_id: str | None = None) -> dict:
    rows = build_rows(analysis)
    prop_id = existing_property_id or "prop_imp_primary"
    units, tenants, contracts, ledger, payments = [], [], [], [], []

    for i, row in enumerate(rows):
        unit_num = row["unit"] or str(i + 1)
        unit_id = f"unit_imp_{slug(unit_num)}"
        tid = f"ten_imp_{slug(unit_num)}"
        rent = num(row["rent"])
        units.append({"id": unit_id, "propertyId": prop_id, "number": unit_num, "rentAmount": rent, "status": "occupied"})
        tenants.append(
            {
                "id": tid,
                "name": row["tenant"] or "—",
                "phone": row["phone"],
                "unitId": unit_id,
                "moveInDate": (row["contractStart"] or "")[:10],
            }
        )
        contracts.append(
            {
                "id": f"ct_imp_{slug(unit_num)}",
                "number": (row["contractNumber"] or f"IMP-{unit_num}").strip(),
                "tenantId": tid,
                "unitId": unit_id,
                "startDate": (row["contractStart"] or "")[:10],
                "endDate": (row["contractEnd"] or "")[:10],
                "rentAmount": rent,
                "startDateRaw": row["contractStart"] or "",
                "endDateRaw": row["contractEnd"] or "",
                "startRequiresSource": not bool(row["contractStart"]),
                "endRequiresSource": not bool(row["contractEnd"]),
            }
        )
        for mi, mth in enumerate(row["months"]):
            month_key = (
                f"{mth['year']}-{int(mth['month']):02d}"
                if mth.get("year") and mth.get("month")
                else slug(str(mth.get("label") or f"m{mi}"))
            )
            ledger.append(
                {
                    "id": f"ldg_{slug(unit_num)}_{month_key}",
                    "tenantId": tid,
                    "unitId": unit_id,
                    "unit": unit_num,
                    "tenant": row["tenant"],
                    "monthKey": month_key,
                    "monthLabel": mth.get("label"),
                    "year": mth.get("year"),
                    "month": mth.get("month"),
                    "due": mth["due"],
                    "paid": mth["paid"],
                    "remaining": mth["remaining"],
                    "status": mth["status"],
                    "statusLabel": mth.get("statusLabel"),
                    "source": mth["source"],
                }
            )
            if mth["paid"] > 0:
                payments.append(
                    {
                        "id": f"pay_{slug(unit_num)}_{month_key}",
                        "unitId": unit_id,
                        "tenantId": tid,
                        "amount": mth["paid"],
                    }
                )

    return {
        "property": {"id": prop_id, "name": "العقار المستورد", "unitCount": len(units)},
        "units": units,
        "tenants": tenants,
        "contracts": contracts,
        "paymentLedger": ledger,
        "payments": payments,
        "analysis_id": analysis.get("analysis_id"),
        "rows_built": len(rows),
    }


def merge_by_id(existing: list, incoming: list, entity: str, change_log: list) -> list:
    mp = {r["id"]: r for r in existing}
    for rec in incoming:
        if rec["id"] in mp:
            if json.dumps(mp[rec["id"]], sort_keys=True, ensure_ascii=False) != json.dumps(
                rec, sort_keys=True, ensure_ascii=False
            ):
                change_log.append({"type": "updated", "entity": entity, "id": rec["id"]})
        else:
            change_log.append({"type": "added", "entity": entity, "id": rec["id"]})
        mp[rec["id"]] = rec
    return list(mp.values())


def apply_merge(prev_store: dict | None, incoming: dict, analysis: dict) -> tuple[dict, dict]:
    change_log: list = []
    prev = prev_store or {}
    units = merge_by_id(prev.get("units") or [], incoming["units"], "unit", change_log)
    tenants = merge_by_id(prev.get("tenants") or [], incoming["tenants"], "tenant", change_log)
    contracts = merge_by_id(prev.get("contracts") or [], incoming["contracts"], "contract", change_log)
    ledger = merge_by_id(prev.get("paymentLedger") or [], incoming["paymentLedger"], "ledger", change_log)
    payments = merge_by_id(prev.get("payments") or [], incoming["payments"], "payment", change_log)
    property_row = prev.get("property") or incoming["property"]
    property_row = {
        **property_row,
        "id": property_row.get("id") or incoming["property"]["id"],
        "unitCount": max(int(property_row.get("unitCount") or 0), len(units)),
    }
    batch = {
        "id": f"batch_{(analysis.get('analysis_id') or 'x')[:8]}",
        "analysisId": analysis.get("analysis_id"),
        "counts": {
            "units": len(incoming["units"]),
            "tenants": len(incoming["tenants"]),
            "contracts": len(incoming["contracts"]),
            "ledgerEntries": len(incoming["paymentLedger"]),
            "payments": len(incoming["payments"]),
        },
        "changeCounts": {
            "added": sum(1 for c in change_log if c["type"] == "added"),
            "updated": sum(1 for c in change_log if c["type"] == "updated"),
        },
        "changeLog": change_log,
    }
    store = {
        "property": property_row,
        "units": units,
        "tenants": tenants,
        "contracts": contracts,
        "paymentLedger": ledger,
        "payments": payments,
        "lastImportBatchId": batch["id"],
    }
    return store, batch


def write_twelve_unit_csv(path: Path) -> None:
    """Real-shaped rent roll with >10 units to prove no 10-contract cap."""
    lines = ["وحدة,مستأجر,إيجار,حالة,جوال,عقد"]
    for i in range(1, 13):
        unit = f"{100 + i}"
        status = "متأخر" if i in (3, 7, 11) else "مسدد"
        lines.append(f"{unit},مستأجر {unit},5{i:03d},{status},050{i:07d},C-{unit}")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def counts(store: dict) -> dict:
    return {
        "units": len(store.get("units") or []),
        "tenants": len(store.get("tenants") or []),
        "contracts": len(store.get("contracts") or []),
        "paymentLedger": len(store.get("paymentLedger") or []),
        "payments": len(store.get("payments") or []),
    }


def main() -> int:
    PROOF_DIR.mkdir(parents=True, exist_ok=True)
    # Clean previous proof store so counts are deterministic.
    if STORE.exists():
        STORE.unlink()
    if BATCHES.exists():
        BATCHES.unlink()

    synth = REPO / "benchmarks" / "synthetic_benchmark" / "files"
    m1, m2, m3 = synth / "rent_month_1.csv", synth / "rent_month_2.csv", synth / "rent_month_3.csv"

    # --- Apply 1: months 1+2 ---
    a1 = analyze([m1, m2])
    inc1 = materialize(a1)
    store1, batch1 = apply_merge(None, inc1, a1)
    STORE.write_text(json.dumps(store1, ensure_ascii=False, indent=2), encoding="utf-8")
    batches = [batch1]
    BATCHES.write_text(json.dumps(batches, ensure_ascii=False, indent=2), encoding="utf-8")

    # --- Close / reopen simulation ---
    reloaded = json.loads(STORE.read_text(encoding="utf-8"))
    reopen_ok = counts(reloaded) == counts(store1) and reloaded.get("lastImportBatchId") == batch1["id"]

    # --- Apply 2: months 1+2+3 (newer, adds unit 104) ---
    a2 = analyze([m1, m2, m3])
    prev_prop = (reloaded.get("property") or {}).get("id")
    inc2 = materialize(a2, existing_property_id=prev_prop)
    store2, batch2 = apply_merge(reloaded, inc2, a2)
    STORE.write_text(json.dumps(store2, ensure_ascii=False, indent=2), encoding="utf-8")
    batches = [batch2, batch1]
    BATCHES.write_text(json.dumps(batches, ensure_ascii=False, indent=2), encoding="utf-8")

    # --- Reopen after 2nd apply ---
    reloaded2 = json.loads(STORE.read_text(encoding="utf-8"))

    # Merge proofs
    unit_ids = [u["id"] for u in store2["units"]]
    tenant_ids = [t["id"] for t in store2["tenants"]]
    contract_ids = [c["id"] for c in store2["contracts"]]
    no_dup_units = len(unit_ids) == len(set(unit_ids))
    no_dup_tenants = len(tenant_ids) == len(set(tenant_ids))
    no_dup_contracts = len(contract_ids) == len(set(contract_ids))
    # Stable merge: Apply2 must NOT double Apply1's 4 units — only add net-new (104 → 5).
    merge_no_inflate = counts(store1)["units"] == 4 and counts(store2)["units"] == 5
    unit_102 = next((u for u in store2["units"] if u["number"] == "102"), None)
    tenant_102 = next((t for t in store2["tenants"] if t["unitId"] == (unit_102 or {}).get("id")), None)
    # ريم replaces سعد on unit 102 — same tenant id, updated name
    tenant_102_updated = bool(tenant_102) and "ريم" in (tenant_102.get("name") or "")
    updated_or_added = batch2["changeCounts"]["updated"] + batch2["changeCounts"]["added"] > 0
    batches_kept = len(batches) == 2
    # Ledger months for 101 unique by monthKey
    ldg_101_keys = [L["monthKey"] for L in store2["paymentLedger"] if L["unit"] == "101"]
    ledger_no_dup_months = len(ldg_101_keys) == len(set(ldg_101_keys))

    # --- 12-contract proof (no 10 cap) ---
    big = PROOF_DIR / "rent_12_units.csv"
    write_twelve_unit_csv(big)
    big2 = PROOF_DIR / "rent_12_units_m2.csv"
    lines = big.read_text(encoding="utf-8").splitlines()
    big2.write_text("\n".join(lines) + "\n", encoding="utf-8")
    a12b = analyze([big, big2])
    inc12 = materialize(a12b)
    contracts_12 = len(inc12["contracts"])
    real_contract_numbers = [c["number"] for c in inc12["contracts"]]
    all_real_c = all(n.startswith("C-") for n in real_contract_numbers)

    # Ledger sample from tenant card months (unit 101)
    sample_ldg = [L for L in store2["paymentLedger"] if L["unit"] == "101"]
    pk2 = a2.get("property_knowledge") or {}
    card_101 = next((t for t in (pk2.get("tenants") or []) if str(t.get("unit")) == "101"), None)
    payload_month0 = (card_101 or {}).get("months", [None])[0] if card_101 else None
    match_ldg = None
    if payload_month0 and sample_ldg:
        match_ldg = next(
            (
                L
                for L in sample_ldg
                if L["monthLabel"] == payload_month0.get("label")
                and L["due"] == num(payload_month0.get("due"))
                and L["paid"] == num(payload_month0.get("paid"))
                and L["remaining"] == num(payload_month0.get("remaining"))
                and L["status"] == payload_month0.get("status")
            ),
            None,
        )

    from datetime import date

    today = date.today().isoformat()
    no_today_default = all((t.get("moveInDate") or "") != today for t in store2["tenants"])

    lines_out = []
    def w(s=""):
        lines_out.append(s)

    w("# WP-1 Practical Proof — Operational Base")
    w()
    w("Branch: `conflict_030726_0550`")
    w("Source CSVs: `benchmarks/synthetic_benchmark/files/rent_month_{1,2,3}.csv` (+ 12-unit roll for contract-cap proof)")
    w()
    w("## 1) Operational base counts (after Apply 1 = months 1+2)")
    w()
    c1 = counts(store1)
    w(f"| Metric | Count |")
    w(f"|--------|------:|")
    w(f"| Units | {c1['units']} |")
    w(f"| Tenants | {c1['tenants']} |")
    w(f"| Contracts | {c1['contracts']} |")
    w(f"| Payment Ledger | {c1['paymentLedger']} |")
    w(f"| Payments | {c1['payments']} |")
    w(f"| Import Batches | 1 |")
    w()
    w("## 1b) After Apply 2 (months 1+2+3 — newer)")
    w()
    c2 = counts(store2)
    w(f"| Metric | Count |")
    w(f"|--------|------:|")
    w(f"| Units | {c2['units']} |")
    w(f"| Tenants | {c2['tenants']} |")
    w(f"| Contracts | {c2['contracts']} |")
    w(f"| Payment Ledger | {c2['paymentLedger']} |")
    w(f"| Payments | {c2['payments']} |")
    w(f"| Import Batches | {len(batches)} |")
    w()
    w(f"- Unit 104 present after Apply 2: `{any(u['number']=='104' for u in store2['units'])}`")
    w(f"- Stable merge (4 → 5 units, not doubled): `{merge_no_inflate}`")
    w(f"- Ledger grew without duplicate month keys on 101: {c1['paymentLedger']} → {c2['paymentLedger']} (unique months `{ledger_no_dup_months}`)")
    w()
    w("## 2) Merge proof (Apply 1 then Apply 2)")
    w()
    w(f"- No duplicate unit ids: `{no_dup_units}` (n={len(unit_ids)})")
    w(f"- No duplicate tenant ids: `{no_dup_tenants}` (n={len(tenant_ids)})")
    w(f"- No duplicate contract ids: `{no_dup_contracts}` (n={len(contract_ids)})")
    w(f"- Change log recorded (added+updated > 0): `{updated_or_added}` → {batch2['changeCounts']}")
    w(f"- Both import batches retained: `{batches_kept}` ids={[b['id'] for b in batches]}")
    w(f"- Unit 102 tenant updated in place (سعد → ريم): `{tenant_102_updated}` → `{tenant_102}`")
    if unit_102:
        w(f"- Unit 102 still single row: `{unit_102}`")
    w()
    w("## 3) Persistence (close / reopen)")
    w()
    w(f"- After Apply 1 reload match: `{reopen_ok}`")
    w(f"- After Apply 2 reload units={len(reloaded2.get('units') or [])}, tenants={len(reloaded2.get('tenants') or [])}, contracts={len(reloaded2.get('contracts') or [])}, ledger={len(reloaded2.get('paymentLedger') or [])}, batch=`{reloaded2.get('lastImportBatchId')}`")
    w(f"- Store file: `{STORE.relative_to(REPO)}`")
    w(f"- Batches file: `{BATCHES.relative_to(REPO)}`")
    w()
    w("## 4) Contracts proof (no 10-cap + real numbers)")
    w()
    w(f"- 12-unit analysis contracts materialised: **{contracts_12}** (must be 12, not capped at 10)")
    w(f"- All real contract numbers from CSV (`C-…`): `{all_real_c}` → {real_contract_numbers}")
    w()
    w("### Contracts after Apply 2")
    w()
    w("| number | unit | tenant | start (payload) | end (payload) |")
    w("|--------|------|--------|-----------------|---------------|")
    for c in store2["contracts"]:
        t = next((x for x in store2["tenants"] if x["id"] == c["tenantId"]), {})
        u = next((x for x in store2["units"] if x["id"] == c["unitId"]), {})
        w(
            f"| {c['number']} | {u.get('number')} | {t.get('name')} | {c.get('startDateRaw') or 'Requires Source Support'} | {c.get('endDateRaw') or 'Requires Source Support'} |"
        )
    w()
    w("> Apply stores payload `contract_start/end` as-is. Empty payload → empty / Requires Source Support. No ISO today invented.")
    w()
    w("## 5) Payment Ledger sample (from months[])")
    w()
    if match_ldg and payload_month0:
        w("Tenant unit **101** — ledger row matched 1:1 to `property_knowledge.tenants[].months[]`:")
        w()
        w("```json")
        w(json.dumps({"payload_month": payload_month0, "ledger_row": match_ldg}, ensure_ascii=False, indent=2))
        w("```")
        w()
        w(f"- Match exact (due/paid/remaining/status/label): `True`")
        w(f"- Source tag on ledger: `{match_ldg.get('source')}`")
    else:
        w(f"- FAIL: could not match ledger to months[]")
    w()
    w("### All ledger rows for unit 101")
    w()
    for L in sample_ldg:
        w(f"- {L['monthLabel']}: due={L['due']} paid={L['paid']} remaining={L['remaining']} status={L['status']} source={L['source']}")
    w()
    w("## 6) No invented data")
    w()
    w(f"- No tenant `moveInDate` defaulted to today (`{today}`): `{no_today_default}`")
    w("- Apply does not invent: maintenance tickets, full address/city/owner, multi-property split, ISO contract dates when missing.")
    w()
    w("## Verdict")
    w()
    checks = {
        "counts_apply1": c1["units"] == 4 and c1["contracts"] == 4 and c1["paymentLedger"] >= 1,
        "merge_no_dups": no_dup_units and no_dup_tenants and no_dup_contracts,
        "merge_stable_counts": merge_no_inflate and ledger_no_dup_months,
        "merge_changelog": updated_or_added and batches_kept and tenant_102_updated,
        "persist_reopen": reopen_ok and len(reloaded2.get("units") or []) == c2["units"],
        "contracts_no_cap_12": contracts_12 == 12 and all_real_c,
        "ledger_from_months": bool(match_ldg),
        "no_today_invent": no_today_default,
    }
    for k, v in checks.items():
        w(f"- {'PASS' if v else 'FAIL'}: `{k}`")
    w()
    all_ok = all(checks.values())
    w(f"**Overall: {'PASS — WP-1 operational base proven' if all_ok else 'FAIL'}**")
    REPORT.write_text("\n".join(lines_out) + "\n", encoding="utf-8")
    print(REPORT.read_text(encoding="utf-8"))
    print("ALL_OK" if all_ok else "FAILED", checks)
    return 0 if all_ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
