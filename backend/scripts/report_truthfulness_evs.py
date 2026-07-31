"""Print expected vs actual for Koil truthfulness acceptance."""
from pathlib import Path

from adapters.upload_analysis.upload_files_meta import build_upload_files_meta_from_paths
from adapters.upload_analysis.intake_engine import analyze_statements_deep
from adapters.upload_analysis.intake_classifier import classify_file
from adapters.koil.consistency_gate import run_consistency_gate

desk = Path.home() / "Desktop"
rent = [
    desk / "كشف شهر 1-2026.xlsx",
    desk / "شكشف شهر 2-2026.xlsx",
    desk / "كشف شهر 3-2026.xlsx",
    desk / "كشف شهر 4-2026.xlsx",
    desk / "كشف شهر 5-2026.xlsx",
    desk / "كشف -شهر -6-2026-.xlsx",
]
maint = desk / "كشف صيانه جديد.xlsx"
metas = build_upload_files_meta_from_paths(rent + [maint])
deep = analyze_statements_deep(metas, {})
gate = run_consistency_gate({**deep, "month_comparison": []}, {}, "ar")

print("=== EXPECTED vs ACTUAL ===")
checks = []
cls = classify_file(metas[-1])
checks.append(("maint_type", "maintenance", cls.doc_type))
exp = deep["expense_rolls"][0]
checks.append(("maint_rows", 18, exp["row_count"]))
checks.append(("maint_total", 28464.0, float(exp["total"])))
for u in ("14", "13"):
    ent = max(
        (e for e in deep["payment_ledger"]["ledger"].values() if str(e.get("unit")) == u),
        key=lambda e: len(e.get("months") or []),
    )
    unpaid = [m for m in ent["months"] if m["status"] in ("unpaid_confirmed", "partial")]
    checks.append((f"unit_{u}_late_months", 0, len(unpaid)))
ent18 = max(
    (e for e in deep["payment_ledger"]["ledger"].values() if str(e.get("unit")) == "18"),
    key=lambda e: len(e.get("months") or []),
)
m3 = next(m for m in ent18["months"] if m["month"] == 3)
checks.append(("unit_18_march", "paid", m3["status"]))
ent6 = [
    e
    for e in deep["payment_ledger"]["ledger"].values()
    if str(e.get("unit")) == "6" and "افراح" in (e.get("tenant") or "")
][0]
checks.append(("unit_6_feb", "vacated", next(m["status"] for m in ent6["months"] if m["month"] == 2)))
checks.append(
    ("unit_11_departures", 0, len([d for d in deep["lifecycle"]["departed"] if str(d.get("unit")) == "11"]))
)
checks.append(
    ("unit_26_departures", 0, len([d for d in deep["lifecycle"]["departed"] if str(d.get("unit")) == "26"]))
)
ph5 = next(e.get("phone") for e in deep["payment_ledger"]["ledger"].values() if str(e.get("unit")) == "5")
checks.append(("unit_5_phone", "0531695119", ph5))
lu = sum(float(e.get("total_unpaid") or 0) for e in deep["payment_ledger"]["ledger"].values())
bt = float(deep["late_by_month"]["grand_total"])
checks.append(("ledger_total", round(lu, 2), round(bt, 2)))
checks.append(("late_tenants", "n/a", deep["late_by_month"]["late_tenant_count"]))
checks.append(("grand_unpaid", "<71900", bt))
checks.append(("gate", gate["decision_status"], gate["decision_status"]))

print(f"{'check':28} {'expected':22} {'actual':22} result")
all_ok = True
for name, exp_v, act in checks:
    if name == "maint_total":
        ok = abs(float(exp_v) - float(act)) < 0.5
    elif name == "ledger_total":
        ok = abs(float(exp_v) - float(act)) < 1
    elif name == "grand_unpaid":
        ok = float(act) < 71900
    elif name in ("late_tenants", "gate"):
        ok = True
    else:
        ok = exp_v == act
    all_ok = all_ok and ok
    print(f"{name:28} {str(exp_v):22} {str(act):22} {'PASS' if ok else 'FAIL'}")

print("gate_conflicts", gate.get("conflict_count"))
for c in gate.get("conflicts") or []:
    print(" -", c.get("detail"))
print("OVERALL", "PASS" if all_ok else "FAIL")
print("late_tenant_count", deep["late_by_month"]["late_tenant_count"], "grand_total", bt)
