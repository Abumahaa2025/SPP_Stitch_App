"""Bridge to SPP_Official GAS Smart Import engines — no logic rewrite, format adapter only."""

from __future__ import annotations

import logging
import uuid
from typing import Any, Dict, List, Literal, Optional

from .gas_client import GasClientError
from .live_data import get_gas_client
from .upload_analysis.intake_classifier import month_label
from .upload_analysis.late_report_format import build_late_section_items, build_late_payments_view_model
from .upload_analysis.portfolio_engine import analyze_upload_portfolio
from .koil import (
    apply_koil_to_executive_report,
    apply_understanding_to_executive_report,
    build_property_knowledge,
    deep_stub_from_gas,
    reasoning_to_smart_decisions,
    run_koil_reasoning,
    run_koil_understanding,
    snapshot_from_gas_report,
)
from .koil.koil_report_bridge import build_executive_brief, build_unified_summary, enrich_metrics_for_summary
from .koil.consistency_gate import apply_gate_to_reasoning, run_consistency_gate

logger = logging.getLogger(__name__)

Lang = Literal["ar", "en"]

_import_sessions: Dict[str, Dict[str, Any]] = {}


def gas_import_available() -> bool:
    return get_gas_client().configured


def _to_gas_files_meta(files: List[dict]) -> List[dict]:
    out: List[dict] = []
    for f in files:
        out.append(
            {
                "name": f.get("name") or "",
                "mime": f.get("mimeType") or f.get("mime") or "",
                "mimeType": f.get("mimeType") or "",
                "size": f.get("size"),
                "textSnippet": f.get("textSnippet") or f.get("contentPreview") or "",
                "parsedFromExcel": bool(f.get("parsedFromExcel")),
            }
        )
    return out


def _item(label: str, value: str) -> dict:
    return {"label": label, "value": value}


def _sec(key: str, title: str, items: List[dict]) -> dict:
    return {"key": key, "title": title, "items": items}


def _labels(lang: Lang) -> Dict[str, str]:
    if lang == "ar":
        return {
            "report_title": "تقرير أداء العقارات {year}",
            "files": "تصنيف الملفات المرفوعة",
            "months": "ربط الأشهر والمقارنة",
            "moved_out": "من غادر",
            "moved_in": "من دخل / جدد",
            "late": "المتأخرات — شهرًا بشهر",
            "late_tenants": "المتأخرات — شهرًا بشهر",
            "units_summary": "ملخص الوحدات",
            "quality": "سجل المراجعة والأخطاء",
            "revenue": "الإيرادات والتحصيل",
            "expenses": "المصروفات والصيانة",
            "contracts": "العقود المنتهية والقريبة",
            "portfolio": "صافي الربح والمحفظة",
            "success": "تم تحليل كشوف العقار وربط {months} أشهر.",
            "prompt": "تم التحليل — ماذا تريد أن تفعل؟",
            "opt_update": "اعتماد في المحفظة",
            "opt_review": "مراجعة قبل الاعتماد",
            "opt_cancel": "إلغاء",
            "what_now": "ماذا تريد أن أفعل الآن؟",
        }
    return {
        "report_title": "Property Performance Report {year}",
        "files": "Uploaded file classification",
        "months": "Month linking & comparison",
        "moved_out": "Departed tenants",
        "moved_in": "New / renewed tenants",
        "late": "Late payments — by month",
        "late_tenants": "Late payments — by month",
        "units_summary": "Units summary",
        "quality": "Review log & warnings",
        "revenue": "Revenue & collection",
        "expenses": "Expenses & maintenance",
        "contracts": "Expired & expiring contracts",
        "portfolio": "Net profit & portfolio",
        "success": "Analyzed {months} linked months from property statements.",
        "prompt": "Analysis complete — what would you like to do?",
        "opt_update": "Apply to portfolio",
        "opt_review": "Review before applying",
        "opt_cancel": "Cancel",
        "what_now": "What should I do now?",
    }


def _compute_analysis_confidence(
    *,
    parse_errors: List[str],
    files_without_content: List[str],
    merge_count: int,
    late_tenants: List[dict],
    unique_units: int,
) -> float:
    score = 100.0
    score -= len(parse_errors) * 8
    score -= len(files_without_content) * 12
    score -= min(15, merge_count * 2)
    if unique_units <= 0:
        score -= 25
    missing_contract = sum(1 for lt in late_tenants if not (lt.get("contract") or "").strip())
    missing_phone = sum(1 for lt in late_tenants if not (lt.get("phone") or "").strip())
    if late_tenants:
        score -= min(10, round((missing_contract / len(late_tenants)) * 8))
        score -= min(8, round((missing_phone / len(late_tenants)) * 6))
    return round(max(40.0, min(100.0, score)), 1)


def map_gas_report_to_portfolio(
    gas_payload: dict,
    files: List[dict],
    lang: Lang = "ar",
) -> Dict[str, Any]:
    """Adapt GAS runSmartPropertyImportPipeline response → app PortfolioAnalysis shape."""
    report = gas_payload.get("report") or gas_payload
    batch_id = gas_payload.get("batchId") or report.get("batchId") or str(uuid.uuid4())
    labels = _labels(lang)

    lc = report.get("lifecycle") or {}
    ann = report.get("annual") or {}
    dr = report.get("detailedReport") or {}
    stats = report.get("stats") or {}
    pb = dr.get("paymentBoard") or {}

    year = int(dr.get("year") or lc.get("lastYear") or ann.get("year") or 2026)
    month_count = int(lc.get("monthCount") or dr.get("monthCount") or 0)
    departed = lc.get("departed") or []
    active = lc.get("active") or []
    newcomers = lc.get("newcomers") or []
    late_rows = (pb.get("late") or []) + (pb.get("pending") or [])
    late_tenants_detailed = pb.get("lateTenants") or []
    quality_log = report.get("qualityLog") or []

    unique_units = int(
        dr.get("uniqueUnits")
        or stats.get("uniqueUnits")
        or stats.get("units")
        or len(active)
    )
    apartment_count = int(dr.get("apartmentCount") or stats.get("apartmentCount") or 0)
    shop_count = int(dr.get("shopCount") or stats.get("shopCount") or 0)
    confidence = _compute_analysis_confidence(
        parse_errors=report.get("parseErrors") or [],
        files_without_content=report.get("filesWithoutContent") or [],
        merge_count=int(pb.get("mergeCount") or 0),
        late_tenants=late_tenants_detailed,
        unique_units=unique_units,
    )
    total_unpaid = float(pb.get("totalUnpaidAllMonths") or sum(float(x.get("totalUnpaid") or x.get("rent") or 0) for x in late_tenants_detailed) or sum(float(x.get("rent") or 0) for x in late_rows))
    late_tenant_count = int(pb.get("lateTenantCount") or len(late_tenants_detailed) or len(late_rows))
    occupied = len(active)
    vacant = max(0, unique_units - occupied)
    occupancy_pct = round(occupied / unique_units * 100, 1) if unique_units else 0

    expected = float(ann.get("totalExpected") or 0)
    collected = float(ann.get("totalCollected") or 0)
    total_expenses = float(dr.get("expenseTotal") or ann.get("maintenanceCost") or 0)
    remaining = max(0, expected - collected)
    net_profit = collected - total_expenses
    collection_rate = dr.get("collectionRate") or (
        f"{round(collected / expected * 100)}%" if expected else "—"
    )

    file_items = []
    for f in files:
        name = f.get("name") or "—"
        tag = "Excel" if f.get("parsedFromExcel") else ("CSV" if f.get("textSnippet") else "—")
        file_items.append(_item(name, tag))

    month_items = []
    for m in dr.get("monthlyBreakdown") or report.get("monthlyRolls") or []:
        ml = month_label(int(m.get("month") or 0), lang) if m.get("month") else str(m.get("month") or "—")
        if lang == "ar":
            month_items.append(
                _item(
                    ml,
                    f"إيجار {m.get('expected', m.get('rent', 0)):,} · محصل {m.get('collected', 0):,} · "
                    f"متأخر {m.get('lateCount', 0)}",
                )
            )
        else:
            month_items.append(
                _item(
                    ml,
                    f"rent {m.get('expected', m.get('rent', 0)):,} · coll. {m.get('collected', 0):,} · "
                    f"late {m.get('lateCount', 0)}",
                )
            )

    departed_items = []
    for d in departed[:12]:
        ml = month_label(int(d.get("departedMonth") or 0), lang)
        departed_items.append(
            _item(
                f"{d.get('tenant')} — {d.get('unit')}",
                f"{ml} {d.get('departedYear', '')} · {float(d.get('rent') or 0):,.0f} ر.س · {d.get('reason', '')}",
            )
        )
    if not departed_items:
        departed_items.append(
            _item("—", "لا مغادرين مكتشفين بين الأشهر المرفوعة" if lang == "ar" else "No departures detected")
        )

    moved_in_items = []
    for n in newcomers[:12]:
        ml = month_label(int(n.get("arrivedMonth") or 0), lang)
        moved_in_items.append(
            _item(
                f"{n.get('tenant')} — {n.get('unit')}",
                f"دخل {ml} {n.get('arrivedYear', '')} · {float(n.get('rent') or 0):,.0f} ر.س",
            )
        )

    late_by_month = pb.get("lateByMonth") or {}
    late_payments = build_late_payments_view_model(
        late_by_month=late_by_month,
        late_tenants_detailed=late_tenants_detailed,
        total_unpaid=total_unpaid,
        late_tenant_count=late_tenant_count,
        lang=lang,
    )
    late_items = build_late_section_items(
        late_by_month=late_by_month,
        late_tenants_detailed=late_tenants_detailed,
        total_unpaid=total_unpaid,
        late_tenant_count=late_tenant_count,
        lang=lang,
    )

    deep = deep_stub_from_gas(report, files)
    import_snapshot = snapshot_from_gas_report(report, batch_id, files)
    koil_understanding = run_koil_understanding(files, deep, lang)
    property_knowledge = build_property_knowledge(import_snapshot, lang)
    koil_reasoning = run_koil_reasoning(property_knowledge, lang)

    units_summary_items = [
        _item("الوحدات السكنية" if lang == "ar" else "Residential units", str(apartment_count or max(0, unique_units - shop_count))),
        _item("المحلات" if lang == "ar" else "Commercial units", str(shop_count)),
        _item("إجمالي الوحدات" if lang == "ar" else "Total units", str(unique_units)),
        _item("المشغول" if lang == "ar" else "Occupied", str(occupied)),
        _item("الشاغر" if lang == "ar" else "Vacant", str(vacant)),
        _item("نسبة الإشغال" if lang == "ar" else "Occupancy", f"{occupancy_pct}%"),
        _item("المتأخرون" if lang == "ar" else "Late tenants", str(late_tenant_count)),
        _item("إجمالي المتأخرات" if lang == "ar" else "Total overdue", f"{total_unpaid:,.0f} ر.س"),
        _item("ثقة التحليل" if lang == "ar" else "Analysis confidence", f"{confidence}%"),
    ]

    quality_items = [_item("—", "لا ملاحظات" if lang == "ar" else "No warnings")]
    if quality_log:
        quality_items = [_item(f"#{i + 1}", str(w)) for i, w in enumerate(quality_log[:12])]

    expense_items = [_item("إجمالي المصروفات" if lang == "ar" else "Total expenses", f"{total_expenses:,.0f}")]
    for r in (dr.get("maintenanceLog") or [])[:6]:
        expense_items.append(
            _item(r.get("description") or "صيانة", f"{float(r.get('amount') or 0):,.0f}")
        )

    executive_report = {
        "title": labels["report_title"].format(year=year),
        "year": year,
        "sections": [
            _sec("files", labels["files"], file_items),
            _sec("units_summary", labels["units_summary"], units_summary_items),
            _sec("months", labels["months"], month_items or [_item("—", "—")]),
            _sec("departed", labels["moved_out"], departed_items),
            _sec("moved_in", labels["moved_in"], moved_in_items or [_item("—", "—")]),
            _sec("late_tenants", labels["late_tenants"], late_items),
            _sec(
                "revenue",
                labels["revenue"],
                [
                    _item("إجمالي الإيجارات" if lang == "ar" else "Total rent", f"{expected:,.0f}"),
                    _item("المحصل" if lang == "ar" else "Collected", f"{collected:,.0f}"),
                    _item("المتبقي" if lang == "ar" else "Remaining", f"{remaining:,.0f}"),
                    _item("نسبة التحصيل" if lang == "ar" else "Collection rate", str(collection_rate)),
                ],
            ),
            _sec("expenses", labels["expenses"], expense_items),
            _sec("contracts", labels["contracts"], [_item("—", "—")]),
            _sec("quality", labels["quality"], quality_items),
            _sec(
                "portfolio",
                labels["portfolio"],
                [
                    _item("صافي الربح" if lang == "ar" else "Net profit", f"{net_profit:,.0f}"),
                    _item("الإيراد المحصل" if lang == "ar" else "Collected revenue", f"{collected:,.0f}"),
                    _item("المصروفات" if lang == "ar" else "Expenses", f"{total_expenses:,.0f}"),
                    _item(
                        "مؤجرة / شاغرة" if lang == "ar" else "Occupied / vacant",
                        f"{occupied} / {vacant}",
                    ),
                ],
            ),
        ],
    }
    executive_report = apply_understanding_to_executive_report(executive_report, koil_understanding, lang)
    executive_report = apply_koil_to_executive_report(executive_report, koil_reasoning, lang)

    smart_decisions: List[dict] = reasoning_to_smart_decisions(koil_reasoning, lang)
    smart_decisions.append(
        {
            "id": "ud_pdf",
            "priority": "low",
            "title": "إنشاء تقرير PDF تنفيذي بالأسماء والأرقام" if lang == "ar" else "Generate executive PDF",
            "action": "create_pdf",
        }
    )

    month_cmp = []
    for m in dr.get("monthlyBreakdown") or []:
        month_cmp.append(
            {
                "month": month_label(int(m.get("month") or 0), lang),
                "revenue": int(m.get("expected") or m.get("rent") or 0),
                "expenses": int(m.get("expenses") or 0),
            }
        )

    analysis_id = batch_id
    metrics = {
        "properties": int(stats.get("properties") or 1),
        "units": unique_units,
        "tenants": len(active),
        "occupancy_pct": occupancy_pct,
        "occupied_units": occupied,
        "vacant_units": vacant,
        "residential_units": apartment_count or max(0, unique_units - shop_count),
        "commercial_units": shop_count,
        "total_revenue_annual": round(expected),
        "collected": round(collected),
        "remaining": round(remaining),
        "total_expenses": round(total_expenses),
        "contracts_expired": int(stats.get("contractsExpired") or stats.get("expiredContracts") or 0),
        "contracts_expiring_soon": int(stats.get("contractsExpiringSoon") or stats.get("expiringContracts") or 0),
        "late_tenants": late_tenant_count,
        "late_value": round(total_unpaid),
        "maintenance_open": len(dr.get("maintenanceLog") or []),
        "maintenance_done": max(0, month_count - 1),
        "net_profit": round(net_profit),
        "balance": round(net_profit * 0.4),
        "files_analyzed": len(files),
        "months_linked": month_count,
        "departed_count": len(departed),
        "newcomers_count": len(newcomers),
        "collection_rate_pct": round(collected / expected * 100) if expected else 0,
        "analysis_confidence_pct": confidence,
    }
    metrics = enrich_metrics_for_summary(metrics, property_knowledge)

    consistency_gate = run_consistency_gate(
        deep,
        property_knowledge,
        lang,
    )
    koil_reasoning = apply_gate_to_reasoning(koil_reasoning, consistency_gate, lang)
    executive_brief = build_executive_brief(
        property_knowledge,
        koil_reasoning,
        consistency_gate,
        lang,
        metrics=metrics,
    )
    summary = build_unified_summary(
        metrics,
        property_knowledge,
        executive_brief,
        consistency_gate,
        executive_report,
    )

    from adapters.lifecycle import build_normalized_lifecycle, generate_lifecycle_decisions
    from adapters.gate import normalize_gate_output, apply_gate_to_unified_decisions
    from adapters.decisions import unify_decisions

    normalized_lifecycle = build_normalized_lifecycle(deep, lang=lang)
    lifecycle_decisions = generate_lifecycle_decisions(
        normalized_lifecycle,
        gate=consistency_gate,
    )
    normalized_gate = normalize_gate_output(
        consistency_gate,
        deep=deep,
        knowledge=property_knowledge,
        analysis_id=analysis_id,
    )
    unified_smart_decisions = unify_decisions(
        koil_smart_decisions=smart_decisions,
        koil_reasoning=koil_reasoning,
        lifecycle_decisions=lifecycle_decisions,
        live_decisions=[],
        executive_ranked_items=[],
        consistency_gate=consistency_gate,
        analysis_id=analysis_id,
        unresolved_count=len(normalized_lifecycle.get("unresolved") or []),
        property_knowledge=property_knowledge,
    )
    unified_smart_decisions = apply_gate_to_unified_decisions(
        unified_smart_decisions, normalized_gate,
    )

    _import_sessions[analysis_id] = {
        "batch_id": batch_id,
        "files_meta": _to_gas_files_meta(files),
        "source": "gas",
        "lang": lang,
        "gas_mode": gas_payload.get("mode"),
        "property_knowledge": property_knowledge,
        "metrics": metrics,
        "summary": summary,
        "success_message": koil_reasoning.get("brief") or report.get("headline") or labels["success"].format(months=month_count),
        "executive_brief": executive_brief,
        "koil_reasoning": koil_reasoning,
        "consistency_gate": consistency_gate,
        "normalized_lifecycle": normalized_lifecycle,
        "lifecycle_decisions": lifecycle_decisions,
        "unified_smart_decisions": unified_smart_decisions,
        "normalized_gate": normalized_gate,
        "canonical_portfolio_summary": {},
        "property_memory": {"summary": {}, "assets": []},
        "executive_intelligence": {"insights": [], "count": 0},
        "canonical_warnings": [],
    }

    return {
        "analysis_id": analysis_id,
        "success_message": koil_reasoning.get("brief") or report.get("headline") or labels["success"].format(months=month_count),
        "prompt_message": labels["prompt"],
        "what_now_message": labels["what_now"],
        "prompt_options": [
            {"key": "update", "label": labels["opt_update"]},
            {"key": "review", "label": labels["opt_review"]},
            {"key": "cancel", "label": labels["opt_cancel"]},
        ],
        "metrics": metrics,
        "summary": summary,
        "executive_brief": executive_brief,
        "executive_report": executive_report,
        "late_payments": late_payments,
        "property_knowledge": property_knowledge,
        "koil_understanding": koil_understanding,
        "koil_reasoning": koil_reasoning,
        "consistency_gate": consistency_gate,
        "month_comparison": month_cmp,
        "expense_by_type": [],
        "smart_decisions": smart_decisions[:8],
        "next_actions": [
            {"key": "update_portfolio", "icon": "database", "route": "/portfolio"},
            {"key": "send_alerts", "icon": "bell", "route": "/notifications"},
            {"key": "create_pdf", "icon": "file-text", "route": "/reports"},
            {"key": "compare_months", "icon": "bar-chart-2", "route": "/insights"},
            {"key": "profit_analysis", "icon": "trending-up", "route": "/insights"},
            {"key": "forecast_expenses", "icon": "activity", "route": "/intelligence"},
            {"key": "show_risks", "icon": "alert-triangle", "route": "/health"},
            {"key": "improvement_plan", "icon": "target", "route": "/hub"},
        ],
        "linked_files": [{"name": f.get("name"), "category": "rent_roll", "category_label": f.get("name"), "month": None, "confidence": 90} for f in files],
        "intake_meta": {
            "engine": "smart_property_gas",
            "synthetic_fallback": False,
            "parse_errors": report.get("parseErrors") or [],
            "files_without_content": report.get("filesWithoutContent") or [],
            "quality_log": quality_log,
            "gas_mode": gas_payload.get("mode"),
            "employee_brief": koil_reasoning.get("brief") or report.get("employeeBrief"),
            "koil_version": koil_reasoning.get("version"),
        },
    }


def run_gas_import_analysis(files: List[dict], lang: Lang = "ar") -> Dict[str, Any]:
    gas = get_gas_client()
    if not gas.configured:
        raise GasClientError("GAS not configured")

    files_meta = _to_gas_files_meta(files)
    payload = gas.post_action("runSmartPropertyImportPipeline", {"filesMeta": files_meta})
    if not payload or payload.get("ok") is False:
        raise GasClientError(payload.get("error") or "فشل تحليل الملفات في GAS")

    return map_gas_report_to_portfolio(payload, files, lang=lang)


def apply_gas_import(
    analysis_id: str,
    files: Optional[List[dict]] = None,
) -> Dict[str, Any]:
    session = _import_sessions.get(analysis_id) or {}
    batch_id = session.get("batch_id") or analysis_id
    files_meta = _to_gas_files_meta(files) if files else (session.get("files_meta") or [])

    gas = get_gas_client()
    result = gas.post_action(
        "commitSmartPropertyImportBatch",
        {"batchId": batch_id, "filesMeta": files_meta},
    )
    if not result or result.get("ok") is False:
        raise GasClientError(result.get("error") or "فشل اعتماد المحفظة")

    commit_result = result.get("result") or {}
    return {
        "ok": True,
        "analysis_id": analysis_id,
        "batch_id": batch_id,
        "result": commit_result,
        "report": result.get("report"),
        "units_created": commit_result.get("unitsCreated"),
        "units_updated": commit_result.get("unitsUpdated"),
        "payments_added": commit_result.get("paymentsAdded"),
    }


def get_import_session(analysis_id: str) -> Dict[str, Any]:
    return dict(_import_sessions.get(analysis_id) or {})


def build_local_apply_commit(analysis_id: str) -> Dict[str, Any]:
    """Materialise Property Knowledge session into portfolio rows (no GAS)."""
    session = _import_sessions.get(analysis_id) or {}
    pk = session.get("property_knowledge") or {}
    metrics = session.get("metrics") or {}
    brief = session.get("executive_brief") or {}
    lc = pk.get("lifecycle") or {}
    active = list(lc.get("active") or [])
    tenants_pk = list(pk.get("tenants") or [])
    phone_by_unit = {
        str(t.get("unit") or "").strip(): (t.get("phone") or "").strip()
        for t in tenants_pk
        if (t.get("unit") or t.get("phone"))
    }
    rows = active or [
        {
            "tenant": t.get("tenant") or t.get("name"),
            "unit": t.get("unit"),
            "phone": t.get("phone"),
            "rent": t.get("rent"),
        }
        for t in tenants_pk
    ]
    prop_id = f"prop_imp_{analysis_id[:8]}"
    meta = pk.get("meta") or {}
    property_row = {
        "id": prop_id,
        "name": "العقار المستورد",
        "address": "",
        "city": "—",
        "kind": "mixed",
        "units": int(metrics.get("units") or len(rows) or 0),
        "occupancy": float(metrics.get("occupancy_pct") or 0) / 100.0,
        "monthly_revenue": float(metrics.get("collected") or 0) / max(1, int(metrics.get("months_linked") or 1)),
        "health_score": 70,
        "hero_image": "",
        "tenant_ids": [],
        "owner_id": "owner_imported",
        "source": "upload_apply",
        "period_from": meta.get("period_from"),
        "period_to": meta.get("period_to"),
    }
    tenants: List[dict] = []
    contracts: List[dict] = []
    for i, row in enumerate(rows):
        tid = f"ten_imp_{i + 1}"
        unit = str(row.get("unit") or i + 1)
        phone = (row.get("phone") or "").strip() or phone_by_unit.get(unit, "")
        tenants.append(
            {
                "id": tid,
                "name": row.get("tenant") or row.get("name") or "—",
                "property_id": prop_id,
                "unit": unit,
                "since": "",
                "rent": float(row.get("rent") or 0),
                "reliability": 0.8,
                "phone": phone,
                "source": "property_knowledge",
            }
        )
        property_row["tenant_ids"].append(tid)
        if i < 10:
            contracts.append(
                {
                    "id": f"ct_imp_{i + 1}",
                    "tenant_id": tid,
                    "property_id": prop_id,
                    "start": "",
                    "end": "",
                    "monthly_rent": float(row.get("rent") or 0),
                    "status": "active",
                    "source": "lifecycle_active",
                }
            )
    report = {
        "id": analysis_id,
        "kind": "monthly",
        "title": brief.get("title") or "التقرير التنفيذي",
        "subtitle": brief.get("period") or "",
        "highlight": (session.get("success_message") or brief.get("property_status") or "")[:160],
        "created_at": "",
        "pages": 1,
        "accent": "gold",
        "source": "executive_report",
        "summary": session.get("summary") or {},
        "metrics": {
            "units": int(metrics.get("units") or len(rows)),
            "tenants": len(tenants),
            "contracts": len(contracts),
            "collected": metrics.get("collected"),
            "remaining": metrics.get("remaining"),
            "late_tenants": metrics.get("late_tenants"),
            "rents": metrics.get("rents") or metrics.get("total_revenue_annual"),
            "gaps": metrics.get("gaps"),
        },
    }

    # --- AI State block (Gap 1) ---
    # Persist the full reasoning artifacts so the live-context endpoints
    # (/api/briefing, /api/verdicts, /api/executive) can consume them after
    # Apply — instead of rebuilding a fresh brief from raw properties/tenants
    # with zero memory of the import reasoning.
    #
    # Shape contract (consumed by server._persist_ai_state + _load_ai_state):
    #   analysis_id        — uuid string (matches the apply request)
    #   pipeline_version   — from koil_reasoning.version (e.g. "koil-reasoning-v1")
    #   applied_at         — ISO UTC timestamp (set by caller, not here —
    #                        caller knows the real commit time)
    #   status             — "applied" (failed applies never reach this path)
    #   source             — "python" | "gas" (matches commit.source)
    #   property_knowledge — full PK dict (units/collection/late/lifecycle/...)
    #   koil_reasoning     — full reasoning dict (what_happened/why/risks/recs)
    #   consistency_gate   — full gate dict (decision_status/conflicts/...)
    #   executive_brief    — full brief dict (property_status/key_numbers/...)
    #   lifecycle          — snapshot.lifecycle subset (departed/newcomers/active)
    #   tenant_cards       — property_knowledge.tenants list (full payment ledger cards)
    reasoning = session.get("koil_reasoning") or {}
    gate = session.get("consistency_gate") or {}
    ai_state = {
        "analysis_id": analysis_id,
        "pipeline_version": reasoning.get("version") or "koil-reasoning-v1",
        "applied_at": None,  # set by server._persist_ai_state at commit time
        "status": "applied",
        "source": session.get("source") or "python",
        "property_knowledge": pk,
        "koil_reasoning": reasoning,
        "consistency_gate": gate,
        "executive_brief": brief,
        "lifecycle": lc,
        "tenant_cards": list(pk.get("tenants") or []),
        # Gap 2: canonical portfolio + memory + intelligence outputs.
        # Computed once during analyze_upload_portfolio(), persisted here
        # so /api/portfolio-memory and /api/intelligence can serve them
        # after Apply without rebuilding from unrelated demo/GAS data.
        # All additive - ai_state consumers that don't read these keys
        # are unaffected.
        "canonical_portfolio_summary": session.get("canonical_portfolio_summary") or {},
        "property_memory": session.get("property_memory") or {"summary": {}, "assets": []},
        "executive_intelligence": session.get("executive_intelligence") or {"insights": [], "count": 0},
        "canonical_warnings": session.get("canonical_warnings") or [],
        # Gap 3 (complete): the ONE normalized lifecycle payload +
        # lifecycle-derived smart decisions. This is the authoritative
        # lifecycle source for all live-context endpoints.
        "normalized_lifecycle": session.get("normalized_lifecycle") or {
            "version": "lifecycle-v1",
            "reporting_period": {},
            "departed": [], "newcomers": [], "active": [],
            "tenant_changes": [], "late_tenants": [],
            "payment_ledger": [], "late_by_month": [],
            "month_comparison": [], "annual_stats": {},
            "summary": {"departed_count": 0, "newcomers_count": 0, "active_count": 0, "late_count": 0},
            "warnings": [], "unresolved": [],
            "source": "upload_analysis", "has_real_content": False, "month_count": 0,
        },
        "lifecycle_decisions": session.get("lifecycle_decisions") or [],
        # Gap 4: the ONE unified smart decisions list. Authoritative for
        # all live-context endpoints (/api/decisions, /api/executive,
        # /api/briefing, /api/verdicts). Replaces the four independent
        # decision lists with stable dedupe_keys + merged evidence.
        "unified_smart_decisions": session.get("unified_smart_decisions") or [],
        # Gap 5: the authoritative normalized consistency gate. Entity-aware
        # blocking — only decisions referencing the conflicted entity are
        # blocked; unrelated decisions remain executable.
        "normalized_gate": session.get("normalized_gate") or {
            "version": "consistency-gate-v1",
            "status": "ok",
            "confidence_cap": 100,
            "blocking_reasons": [],
            "warnings": [],
            "conflicts": [],
            "affected_outputs": [],
            "review_actions": [],
            "checked_at": None,
            "analysis_id": None,
        },
    }
    return {
        "ok": True,
        "analysis_id": analysis_id,
        "source": session.get("source") or "python",
        "properties": [property_row],
        "tenants": tenants,
        "contracts": contracts,
        "reports": [report],
        "units": int(metrics.get("units") or len(rows)),
        "tenant_count": len(tenants),
        "summary": session.get("summary") or {},
        # Gap 1: AI reasoning artifacts for live-context endpoints.
        # Server.upload_apply_analysis() reads this block and persists it
        # via _persist_ai_state(). Older callers that don't read this key
        # are unaffected (purely additive).
        "ai_state": ai_state,
    }


def create_gas_owner_pdf(analysis_id: Optional[str] = None) -> Dict[str, Any]:
    gas = get_gas_client()
    params: Dict[str, Any] = {}
    if analysis_id:
        session = _import_sessions.get(analysis_id) or {}
        params["batchId"] = session.get("batch_id") or analysis_id
    data = gas.post_action("createOwnerReportPdf", params)
    url = (data or {}).get("url") if isinstance(data, dict) else None
    if not url:
        raise GasClientError("لم يُرجع GAS رابط PDF")
    return {"ok": True, "url": url}


def analyze_upload_with_gas_fallback(
    files: List[dict],
    ctx: Dict[str, Any],
    lang: Lang = "ar",
) -> Dict[str, Any]:
    """Prefer GAS Smart Property engines; fall back to local Python port when GAS unavailable."""
    if gas_import_available():
        try:
            return run_gas_import_analysis(files, lang=lang)
        except GasClientError as exc:
            logger.warning("GAS import failed, falling back to Python engine: %s", exc)

    payload = analyze_upload_portfolio(files, ctx, lang=lang)
    analysis_id = payload.get("analysis_id") or str(uuid.uuid4())
    payload["analysis_id"] = analysis_id
    _import_sessions[analysis_id] = {
        "batch_id": analysis_id,
        "files_meta": _to_gas_files_meta(files),
        "source": "python",
        "lang": lang,
        # Keep slim proof payload so Apply can materialise without re-running engines.
        "property_knowledge": payload.get("property_knowledge"),
        "metrics": payload.get("metrics"),
        "summary": payload.get("summary"),
        "success_message": payload.get("success_message"),
        "executive_brief": payload.get("executive_brief"),
        # Gap 1: also persist reasoning + gate so build_local_apply_commit()
        # can include them in the ai_state block for live-context endpoints.
        "koil_reasoning": payload.get("koil_reasoning"),
        "consistency_gate": payload.get("consistency_gate"),
        # Gap 2: also persist canonical portfolio + memory + intelligence
        # outputs so /api/portfolio-memory and /api/intelligence can serve
        # them after Apply without rebuilding from unrelated demo/GAS data.
        "canonical_portfolio_summary": payload.get("canonical_portfolio_summary"),
        "property_memory": payload.get("property_memory"),
        "executive_intelligence": payload.get("executive_intelligence"),
        "canonical_warnings": payload.get("canonical_warnings"),
        # Gap 3 (complete): persist the normalized lifecycle payload +
        # lifecycle decisions. This is the authoritative lifecycle source
        # for /api/briefing, /api/verdicts, /api/executive, smart decisions.
        "normalized_lifecycle": payload.get("normalized_lifecycle"),
        "lifecycle_decisions": payload.get("lifecycle_decisions"),
        # Gap 4: persist the ONE unified smart decisions list. This is the
        # authoritative decision list for all live-context endpoints —
        # replaces the four independent decision lists.
        "unified_smart_decisions": payload.get("unified_smart_decisions"),
        # Gap 5: persist the authoritative normalized consistency gate.
        "normalized_gate": payload.get("normalized_gate"),
    }
    return payload
