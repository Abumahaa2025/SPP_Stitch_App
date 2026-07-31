"""Normalize GAS report or Python deep analysis → single import snapshot."""

from __future__ import annotations

from typing import Any, Dict, List


def _camel_get(obj: dict, *keys: str, default=None):
    for k in keys:
        if k in obj and obj[k] is not None:
            return obj[k]
    return default


def snapshot_from_gas_report(report: dict, batch_id: str = "", files: List[dict] | None = None) -> dict:
    """Universal snapshot from GAS buildImportV1Report_ output."""
    report = report or {}
    lc = report.get("lifecycle") or {}
    dr = report.get("detailedReport") or {}
    pb = dr.get("paymentBoard") or report.get("paymentBoard") or {}
    ann = report.get("annual") or {}
    stats = report.get("stats") or {}

    return {
        "source": "gas",
        "batch_id": batch_id or report.get("batchId") or "",
        "lifecycle": lc,
        "annual": ann,
        "stats": stats,
        "detailed_report": dr,
        "payment_board": pb,
        "quality_log": report.get("qualityLog") or [],
        "parse_errors": report.get("parseErrors") or [],
        "files_without_content": report.get("filesWithoutContent") or [],
        "monthly_breakdown": dr.get("monthlyBreakdown") or report.get("monthlyRolls") or [],
        "late_by_month": pb.get("lateByMonth") or {},
        "late_tenants": pb.get("lateTenants") or [],
        "maintenance_log": dr.get("maintenanceLog") or [],
        "files_count": len(files or []),
    }


def snapshot_from_deep(deep: dict) -> dict:
    """Universal snapshot from Python analyze_statements_deep output."""
    deep = deep or {}
    pl = deep.get("payment_ledger") or {}
    lc = deep.get("lifecycle") or {}

    monthly_breakdown = []
    for pr in deep.get("parsed_rolls") or []:
        if not pr.get("ok"):
            continue
        rows = pr.get("rows") or []
        expected = sum(float(r.get("rent") or 0) for r in rows)
        collected = sum(float(r.get("rent") or 0) for r in rows if r.get("is_paid"))
        late_count = sum(1 for r in rows if r.get("is_late") or (not r.get("is_paid") and float(r.get("rent") or 0) > 0))
        monthly_breakdown.append(
            {
                "month": pr.get("month"),
                "year": pr.get("year"),
                "fileName": pr.get("file_name") or pr.get("fileName") or "",
                "expected": expected,
                "collected": collected,
                "lateCount": late_count,
            }
        )

    return {
        "source": "python",
        "batch_id": "",
        "lifecycle": lc,
        "annual": deep.get("annual") or {},
        "stats": {
            "uniqueUnits": (deep.get("unique_unit_stats") or {}).get("unique_units"),
            "apartmentCount": (deep.get("unique_unit_stats") or {}).get("apartment_count"),
            "shopCount": (deep.get("unique_unit_stats") or {}).get("shop_count"),
        },
        "detailed_report": {
            "collectionRate": None,
            "monthlyBreakdown": monthly_breakdown,
        },
        "payment_board": {
            "lateTenants": pl.get("late_tenants") or deep.get("late_tenants") or [],
            "lateByMonth": deep.get("late_by_month") or {},
            "mergeCount": pl.get("merge_count") or 0,
            "totalUnpaidAllMonths": sum(
                float(x.get("total_unpaid") or x.get("totalUnpaid") or 0)
                for x in (pl.get("late_tenants") or deep.get("late_tenants") or [])
            ),
            "lateTenantCount": len(pl.get("late_tenants") or deep.get("late_tenants") or []),
        },
        "quality_log": deep.get("quality_log") or [],
        "parse_errors": deep.get("parse_errors") or [],
        "files_without_content": deep.get("files_without_content") or [],
        "monthly_breakdown": monthly_breakdown,
        "late_by_month": deep.get("late_by_month") or {},
        "late_tenants": pl.get("late_tenants") or deep.get("late_tenants") or [],
        "maintenance_log": _maintenance_from_expense_rolls(deep.get("expense_rolls") or []),
        "expense_rolls": deep.get("expense_rolls") or [],
        "payment_ledger": pl.get("ledger") or {},
        "parsed_rolls": deep.get("parsed_rolls") or [],
        "file_classifications": deep.get("file_classifications") or [],
        "files_count": len(deep.get("file_classifications") or []),
    }


def _maintenance_from_expense_rolls(expense_rolls: List[dict]) -> List[dict]:
    """Flatten expense/maintenance rolls into Property Knowledge entries."""
    out: List[dict] = []
    for er in expense_rolls:
        fname = er.get("file_name") or ""
        for r in er.get("rows") or []:
            out.append(
                {
                    "description": r.get("description") or "صيانة",
                    "unit": r.get("unit") or "",
                    "amount": r.get("amount") or 0,
                    "category": r.get("category") or "صيانة",
                    "status": r.get("status") or "",
                    "file_name": fname,
                    "request_id": r.get("request_id") or "",
                }
            )
    return out[:200]
