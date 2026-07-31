"""Turn uploaded property statements + live portfolio into detailed executive report."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal

from .intake_classifier import month_label
from .intake_engine import analyze_statements_deep
from .intake_lifecycle import build_month_comparison
from .late_report_format import build_late_section_items, build_late_payments_view_model
from adapters.koil.import_snapshot import snapshot_from_deep
from adapters.koil.property_knowledge_engine import build_property_knowledge
from adapters.koil.koil_reasoning_engine import run_koil_reasoning
from adapters.koil.understanding_engine import run_koil_understanding
from adapters.koil.koil_report_bridge import (
    apply_koil_to_executive_report,
    apply_understanding_to_executive_report,
    build_executive_brief,
    build_unified_summary,
    enrich_metrics_for_summary,
    reasoning_to_smart_decisions,
)
from adapters.koil.consistency_gate import apply_gate_to_reasoning, run_consistency_gate
# Gap 2 — upload → canonical → memory graph → executive intelligence bridge
from adapters.canonical.pipeline import upload_analysis_to_canonical

Lang = Literal["ar", "en"]


def _labels(lang: Lang) -> Dict[str, str]:
    if lang == "ar":
        return {
            "report_title": "تقرير أداء العقارات {year}",
            "files": "تصنيف الملفات المرفوعة",
            "months": "ربط الأشهر والمقارنة",
            "moved_out": "من غادر",
            "moved_in": "من دخل / جدد",
            "late": "المتأخرات — شهرًا بشهر",
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


def _contracts_expiring(contracts: List[dict], tenants: List[dict], within_days: int = 60) -> List[dict]:
    now = datetime.now(timezone.utc)
    tenant_map = {t["id"]: t for t in tenants}
    out = []
    for c in contracts:
        end_raw = c.get("end")
        if not end_raw:
            continue
        try:
            end = datetime.fromisoformat(str(end_raw).replace("Z", "+00:00"))
            if end.tzinfo is None:
                end = end.replace(tzinfo=timezone.utc)
            delta = (end - now).days
            if 0 <= delta <= within_days:
                ten = tenant_map.get(c.get("tenant_id"), {})
                out.append(
                    {
                        **c,
                        "_days_left": delta,
                        "tenant_name": ten.get("name", "—"),
                        "unit": ten.get("unit", "—"),
                    }
                )
        except (ValueError, TypeError):
            continue
    return sorted(out, key=lambda x: x["_days_left"])


def _sec(key: str, title: str, items: List[dict]) -> dict:
    return {"key": key, "title": title, "items": items}


def _item(label: str, value: str) -> dict:
    return {"label": label, "value": value}


def _icon_for_kind(kind: str) -> str:
    """Map a unified decision kind to an icon name for next_actions."""
    return {
        "contact_late_tenant": "bell",
        "follow_up_departed_tenant": "user-minus",
        "onboard_new_tenant": "user-plus",
        "review_payment_history": "file-text",
        "investigate_tenant_change": "search",
        "compare_collection_periods": "bar-chart-2",
        "request_missing_lifecycle_data": "alert-triangle",
        "maintenance": "wrench",
        "renewal": "file",
        "vacancy": "home",
        "opportunity": "trending-up",
        "tenant": "user",
        "financial": "dollar-sign",
    }.get(kind, "activity")


def analyze_upload_portfolio(
    files: List[dict],
    ctx: Dict[str, Any],
    lang: Lang = "ar",
) -> Dict[str, Any]:
    deep = analyze_statements_deep(files, ctx)
    labels = _labels(lang)
    lc = deep["lifecycle"]
    ann = deep["annual"]
    years = [pr.get("year") or 2026 for pr in deep["parsed_rolls"]]
    year = max(years) if years else 2026
    month_count = lc.get("month_count") or len(deep["parsed_rolls"])

    contracts = ctx.get("contracts") or []
    tenants = ctx.get("tenants") or []
    properties = ctx.get("properties") or []
    expiring = _contracts_expiring(contracts, tenants, 60)
    expired = [c for c in contracts if str(c.get("status", "")).lower() in ("expired", "ended")]

    total_expenses = float(ann.get("maintenance_cost") or ann.get("expense_from_rolls") or 0)
    collected = float(ann.get("total_collected") or 0)
    expected = float(ann.get("total_expected") or 0)
    remaining = max(0, expected - collected)
    net_profit = collected - total_expenses

    active = lc.get("active") or []
    departed = lc.get("departed") or []
    newcomers = lc.get("newcomers") or []
    late_list = deep.get("late_tenants") or []
    unique_stats = deep.get("unique_unit_stats") or {}
    quality_log = deep.get("quality_log") or []
    maint_freq = deep.get("maintenance_freq") or []
    costliest = deep.get("costliest_units") or []

    unique_units = int(unique_stats.get("unique_units") or 0)
    shop_count = int(unique_stats.get("shop_count") or 0)
    apartment_count = int(unique_stats.get("apartment_count") or 0)
    total_units = unique_units or sum(int(p.get("units") or 0) for p in properties)
    occupied = len(active) if active else sum(
        round(int(p.get("units") or 0) * float(p.get("occupancy") or 0)) for p in properties
    )
    vacant = max(0, total_units - occupied)
    occupancy_pct = round((occupied / total_units * 100) if total_units else 0, 1)
    late_by_month = deep.get("late_by_month") or {}
    total_unpaid = float(
        late_by_month.get("grand_total")
        or sum(float(lt.get("total_unpaid") or lt.get("rent") or 0) for lt in late_list)
    )
    late_tenant_count = int(late_by_month.get("late_tenant_count") or len(late_list))

    # --- Sections with named detail ---
    file_items = []
    for fc in deep.get("file_classifications") or []:
        m = fc.get("month")
        ml = month_label(m, lang) if m else "—"
        cat = fc.get("category_ar") if lang == "ar" else fc.get("category_en")
        file_items.append(
            _item(
                fc.get("name", "—"),
                f"{cat} · {ml} · {fc.get('confidence', 0)}%",
            )
        )

    month_cmp = build_month_comparison(deep["parsed_rolls"], deep["expense_rolls"], lang)
    deep["month_comparison"] = month_cmp
    month_items = []
    for i, m in enumerate(month_cmp):
        delta = m.get("delta_revenue") or 0
        sign = "+" if delta >= 0 else ""
        if lang == "ar":
            month_items.append(
                _item(
                    m["month"],
                    f"إيجار {m['revenue']:,} · محصل {m['collected']:,} · مصروف {m['expenses']:,} · "
                    f"تغير {sign}{delta:,} · متأخر {m.get('late_count', 0)}",
                )
            )
        else:
            month_items.append(
                _item(
                    m["month"],
                    f"rent {m['revenue']:,} · coll. {m['collected']:,} · exp. {m['expenses']:,} · "
                    f"Δ {sign}{delta:,} · late {m.get('late_count', 0)}",
                )
            )

    departed_items = []
    for d in departed[:12]:
        ml = month_label(d.get("departed_month") or 0, lang)
        departed_items.append(
            _item(
                f"{d.get('tenant')} — {d.get('unit')}",
                f"{ml} {d.get('departed_year')} · {d.get('rent', 0):,.0f} ر.س · {d.get('reason', '')}",
            )
        )
    if not departed_items:
        departed_items.append(_item("—", "لا مغادرين مكتشفين بين الأشهر المرفوعة" if lang == "ar" else "No departures detected"))

    moved_in_items = []
    for n in newcomers[:12]:
        ml = month_label(n.get("arrived_month") or 0, lang)
        moved_in_items.append(
            _item(
                f"{n.get('tenant')} — {n.get('unit')}",
                f"دخل {ml} {n.get('arrived_year')} · {n.get('rent', 0):,.0f} ر.س",
            )
        )
    for a in active:
        if any(x.get("unit") == a.get("unit") for x in newcomers):
            continue
    renewals = [c for c in contracts if str(c.get("status", "")).lower() == "expiring"]
    for c in renewals[:5]:
        ten = next((t for t in tenants if t.get("id") == c.get("tenant_id")), {})
        moved_in_items.append(
            _item(
                f"{ten.get('name', '—')} — {ten.get('unit', '—')}",
                f"تجديد عقد · ينتهي {str(c.get('end', ''))[:10]} · {c.get('monthly_rent', 0):,.0f} ر.س/شهر",
            )
        )

    late_payments = build_late_payments_view_model(
        late_by_month=late_by_month,
        late_tenants_detailed=late_list,
        total_unpaid=total_unpaid,
        late_tenant_count=late_tenant_count,
        lang=lang,
    )
    # Metrics follow confirmed-only late board (never unknowns as arrears).
    total_unpaid = float(late_payments["summary"]["total_unpaid"])
    late_tenant_count = int(late_payments["summary"]["late_tenant_count"])
    late_items = build_late_section_items(
        late_by_month=late_by_month,
        late_tenants_detailed=late_list,
        total_unpaid=total_unpaid,
        late_tenant_count=late_tenant_count,
        lang=lang,
    )

    import_snapshot = snapshot_from_deep(deep)
    koil_understanding = run_koil_understanding(files, deep, lang)
    property_knowledge = build_property_knowledge(import_snapshot, lang)
    koil_reasoning = run_koil_reasoning(property_knowledge, lang)
    consistency_gate = run_consistency_gate(deep, property_knowledge, lang)
    koil_reasoning = apply_gate_to_reasoning(koil_reasoning, consistency_gate, lang)

    # Gap 5: normalize the raw consistency gate output into the authoritative
    # persisted shape. This is the ONE gate shape consumed by all live-context
    # endpoints (briefing, verdicts, executive, unified decisions).
    from adapters.gate import normalize_gate_output
    normalized_gate = normalize_gate_output(
        consistency_gate,
        deep=deep,
        knowledge=property_knowledge,
        analysis_id=str(uuid.uuid4()),
    )

    # Gap 3 (complete): build the ONE normalized lifecycle payload using
    # the existing 7 intake_lifecycle functions. This is the authoritative
    # lifecycle shape persisted in ai_state and consumed by all live-context
    # endpoints (briefing, verdicts, executive, smart decisions).
    from adapters.lifecycle import build_normalized_lifecycle, generate_lifecycle_decisions
    normalized_lifecycle = build_normalized_lifecycle(deep, lang=lang)
    lifecycle_decisions = generate_lifecycle_decisions(
        normalized_lifecycle,
        gate=consistency_gate,
    )

    # Gap 4 block moved below (after smart_decisions is built).

    units_summary_items = [
        _item("الوحدات السكنية" if lang == "ar" else "Residential units", str(apartment_count or max(0, total_units - shop_count))),
        _item("المحلات" if lang == "ar" else "Commercial units", str(shop_count)),
        _item("إجمالي الوحدات" if lang == "ar" else "Total units", str(total_units)),
        _item("المشغول" if lang == "ar" else "Occupied", str(occupied)),
        _item("الشاغر" if lang == "ar" else "Vacant", str(vacant)),
        _item("نسبة الإشغال" if lang == "ar" else "Occupancy", f"{occupancy_pct}%"),
        _item("المتأخرون" if lang == "ar" else "Late tenants", str(late_tenant_count)),
        _item("إجمالي المتأخرات" if lang == "ar" else "Total overdue", f"{total_unpaid:,.0f} ر.س"),
    ]

    quality_items = [_item("—", "لا ملاحظات" if lang == "ar" else "No warnings")]
    if quality_log:
        quality_items = [_item(f"#{i + 1}", str(w)) for i, w in enumerate(quality_log[:12])]

    expense_items = [
        _item("إجمالي المصروفات" if lang == "ar" else "Total expenses", f"{total_expenses:,.0f}"),
    ]
    for desc, count, total in maint_freq[:6]:
        expense_items.append(_item(f"{desc} (×{count})", f"{total:,.0f}"))
    if costliest:
        u, amt = costliest[0]
        expense_items.append(
            _item(
                "أكثر وحدة تكلفة" if lang == "ar" else "Costliest unit",
                f"{u} — {amt:,.0f} ر.س",
            )
        )

    contract_items = []
    for c in expired[:5]:
        ten = next((t for t in tenants if t.get("id") == c.get("tenant_id")), {})
        contract_items.append(
            _item(
                f"{ten.get('name', '—')} — {ten.get('unit', '—')}",
                f"منتهي · {c.get('monthly_rent', 0):,.0f} ر.س/شهر",
            )
        )
    for c in expiring[:8]:
        contract_items.append(
            _item(
                f"{c.get('tenant_name')} — {c.get('unit')}",
                f"ينتهي خلال {c['_days_left']} يوم · {c.get('monthly_rent', 0):,.0f} ر.س/شهر",
            )
        )

    collection_rate = f"{round(collected / expected * 100)}%" if expected else "—"

    executive_report = {
        "title": labels["report_title"].format(year=year),
        "year": year,
        "sections": [
            _sec("files", labels["files"], file_items),
            _sec("units_summary", "ملخص الوحدات" if lang == "ar" else "Units summary", units_summary_items),
            _sec("months", labels["months"], month_items),
            _sec("departed", labels["moved_out"], departed_items),
            _sec("moved_in", labels["moved_in"], moved_in_items),
            _sec("late_tenants", "المتأخرات — شهرًا بشهر" if lang == "ar" else "Late payments — by month", late_items),
            _sec(
                "revenue",
                labels["revenue"],
                [
                    _item("إجمالي الإيجارات (6 أشهر)" if lang == "ar" else "Total rent (6 mo)", f"{expected:,.0f}"),
                    _item("المحصل" if lang == "ar" else "Collected", f"{collected:,.0f}"),
                    _item("المتبقي" if lang == "ar" else "Remaining", f"{remaining:,.0f}"),
                    _item("نسبة التحصيل" if lang == "ar" else "Collection rate", collection_rate),
                ],
            ),
            _sec("expenses", labels["expenses"], expense_items),
            _sec("contracts", labels["contracts"], contract_items or [_item("—", "لا عقود حرجة" if lang == "ar" else "No critical contracts")]),
            _sec("quality", "سجل المراجعة" if lang == "ar" else "Review log", quality_items),
            _sec(
                "portfolio",
                labels["portfolio"],
                [
                    _item("صافي الربح" if lang == "ar" else "Net profit", f"{net_profit:,.0f}"),
                    _item("الإيراد المحصل" if lang == "ar" else "Collected revenue", f"{collected:,.0f}"),
                    _item("المصروفات" if lang == "ar" else "Expenses", f"{total_expenses:,.0f}"),
                    _item("مؤجرة / شاغرة" if lang == "ar" else "Occupied / vacant", f"{occupied} / {vacant}"),
                ],
            ),
        ],
    }
    executive_report = apply_understanding_to_executive_report(executive_report, koil_understanding, lang)
    executive_report = apply_koil_to_executive_report(executive_report, koil_reasoning, lang)

    smart_decisions: List[dict] = reasoning_to_smart_decisions(koil_reasoning, lang)
    for c in expiring[:2]:
        smart_decisions.append(
            {
                "id": f"ct_{c.get('id')}",
                "priority": "high",
                "title": (
                    f"{c.get('tenant_name')} — {c.get('unit')} — عقد ينتهي خلال {c['_days_left']} يوم"
                    if lang == "ar"
                    else f"{c.get('tenant_name')} — contract expires in {c['_days_left']} days"
                ),
                "action": "فتح العقد وإرسال عرض تجديد" if lang == "ar" else "Open contract & send renewal offer",
            }
        )
    smart_decisions.append(
        {
            "id": "ud_pdf",
            "priority": "low",
            "title": "إنشاء تقرير PDF تنفيذي بالأسماء والأرقام" if lang == "ar" else "Generate executive PDF with names & figures",
            "action": "create_pdf",
        }
    )

    # --- Gap 4: unify all four decision sources into ONE list ---
    # Koïl smart_decisions + lifecycle_decisions + live ctx decisions +
    # executive ranked items → single authoritative unified_smart_decisions
    # with stable dedupe_keys, merged evidence, deterministic scores,
    # and consistency-gate awareness.
    from adapters.decisions import unify_decisions
    from adapters.executive.ranking import build_ranked_items as _build_ranked
    _ctx_decisions = ctx.get("decisions") or []
    _ctx_properties = ctx.get("properties") or []
    _ctx_tenants = ctx.get("tenants") or []
    _ctx_contracts = ctx.get("contracts") or []
    _executive_ranked = _build_ranked(
        _ctx_properties,
        _ctx_tenants,
        _ctx_contracts,
        _ctx_decisions,
        lifecycle=normalized_lifecycle.get("lifecycle") if normalized_lifecycle else None,
    )
    unified_smart_decisions = unify_decisions(
        koil_smart_decisions=smart_decisions,
        koil_reasoning=koil_reasoning,
        lifecycle_decisions=lifecycle_decisions,
        live_decisions=_ctx_decisions,
        executive_ranked_items=_executive_ranked,
        consistency_gate=consistency_gate,
        analysis_id=str(uuid.uuid4()),
        unresolved_count=len(normalized_lifecycle.get("unresolved") or []),
        property_knowledge=property_knowledge,
    )
    # Gap 5: apply the authoritative normalized gate to unified decisions.
    # This adds blocked_by_gate, gate_status, gate_conflict_codes,
    # gate_evidence, confidence_before_gate, confidence_after_gate to each
    # decision, using entity-aware blocking (not global).
    from adapters.gate import apply_gate_to_unified_decisions
    unified_smart_decisions = apply_gate_to_unified_decisions(
        unified_smart_decisions, normalized_gate,
    )
    # Derive next_actions from unified decisions (replaces hardcoded list
    # when an analysis exists). Each action references the unified decision id.
    unified_next_actions = [
        {
            "key": d.get("kind", "action"),
            "icon": _icon_for_kind(d.get("kind", "")),
            "route": d.get("route", "/"),
            "label": d.get("title", ""),
            "decision_id": d.get("id"),
            "priority": d.get("priority", "medium"),
            "confidence": d.get("confidence", 0),
        }
        for d in unified_smart_decisions[:8]
    ]

    metrics = {
        "properties": len(properties),
        "units": total_units,
        "tenants": len(active) if active else len(tenants),
        "occupancy_pct": occupancy_pct,
        "occupied_units": occupied,
        "vacant_units": vacant,
        "residential_units": apartment_count or max(0, total_units - shop_count),
        "commercial_units": shop_count,
        "total_revenue_annual": round(expected),
        "collected": round(collected),
        "remaining": round(remaining),
        "total_expenses": round(total_expenses),
        "contracts_expired": len(expired),
        "contracts_expiring_soon": len(expiring),
        "late_tenants": late_tenant_count,
        "late_value": round(total_unpaid),
        "maintenance_open": sum(c for _, c, _ in maint_freq),
        "maintenance_done": max(0, month_count - 1),
        "net_profit": round(net_profit),
        "balance": round(net_profit * 0.4),
        "files_analyzed": len(files),
        "months_linked": month_count,
        "departed_count": len(departed),
        "newcomers_count": len(newcomers),
        "collection_rate_pct": round(collected / expected * 100) if expected else 0,
    }
    metrics = enrich_metrics_for_summary(metrics, property_knowledge)

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

    # --- Gap 2: run the upload → canonical → memory → insights bridge ---
    # Produces 4 additive fields attached to the response:
    #   canonical_portfolio_summary — portfolio shape (units/assets/events counts)
    #   property_memory            — asset risk profiles (same shape as
    #                                /api/portfolio-memory response)
    #   executive_intelligence     — repeat_repair / warranty_window /
    #                                renewal_pricing insights (same shape as
    #                                /api/intelligence response)
    #   canonical_warnings         — unresolved records (parse errors,
    #                                missing phones, missing contracts, etc.)
    #
    # The bridge degrades gracefully - on any error it returns empty
    # defaults so the upload analysis response is never broken.
    analysis_id_for_canonical = str(uuid.uuid4())
    # Derive the canonical property identity NOW (at analyze time), so the
    # canonical portfolio summary can count unique properties correctly even
    # before Apply. The same prop_id is used by build_local_apply_commit()
    # at apply time — they share the analysis_id, so the prop_id is stable.
    #
    # Property identity precedence (most-specific first):
    #   1. If the source data carries a property/building column (multi-property
    #      upload), unit_from_row() in canonical/ingest.py derives property_id
    #      as `prop_<stable_hash_of_name>`. This identifies the REAL property
    #      entity, not the analysis. Two buildings in one upload → two distinct
    #      property_ids → properties_count=2.
    #   2. If no property column exists (single-property upload), we assign
    #      the analysis-level canonical prop_id (prop_imp_{analysis_id[:8]})
    #      as a fallback. This is stable across rebuilds and survives cache
    #      clears. analysis_id is provenance here, not the only identity —
    #      it's used ONLY when no imported property evidence is available.
    canonical_prop_id = f"prop_imp_{analysis_id_for_canonical[:8]}"
    for card in property_knowledge.get("tenants") or []:
        if not isinstance(card, dict):
            continue
        # Only set the fallback property_id when the card has no imported
        # property/building evidence. If `property` is non-empty, the
        # canonical ingest layer will derive a stable prop_<hash> from it
        # and that takes precedence (see unit_from_row in canonical/ingest.py).
        if not (card.get("property") or card.get("property_raw")):
            card.setdefault("property_id", canonical_prop_id)
    canonical_outputs = upload_analysis_to_canonical(
        property_knowledge=property_knowledge,
        metrics=metrics,
        analysis_id=analysis_id_for_canonical,
    )

    return {
        "analysis_id": analysis_id_for_canonical,
        # Regression / Koil brief contract: success_message must be Koil-signed
        # ("كويل · …" / "Koil · …"). property_status stays on executive_brief for UI.
        "success_message": koil_reasoning.get("brief")
        or executive_brief.get("property_status")
        or labels["success"].format(months=month_count),
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
        # Gap 2: canonical portfolio + memory + intelligence outputs.
        # All additive - existing clients ignore these keys. Persisted into
        # ai_state by build_local_apply_commit() so /api/portfolio-memory
        # and /api/intelligence can serve them after Apply without rebuild.
        "canonical_portfolio_summary": canonical_outputs["canonical_portfolio_summary"],
        "property_memory": canonical_outputs["property_memory"],
        "executive_intelligence": canonical_outputs["executive_intelligence"],
        "canonical_warnings": canonical_outputs["canonical_warnings"],
        # Gap 3 (complete): the ONE normalized lifecycle payload +
        # lifecycle-derived smart decisions. Persisted in ai_state by
        # build_local_apply_commit() so /api/briefing, /api/verdicts,
        # /api/executive can serve them after Apply.
        "normalized_lifecycle": normalized_lifecycle,
        "lifecycle_decisions": lifecycle_decisions,
        # Gap 4: the ONE unified smart decisions list + derived next_actions.
        # Replaces the four independent decision lists (koil smart_decisions,
        # lifecycle_decisions, live decisions, executive ranked_items) with
        # a single authoritative list that has stable dedupe_keys, merged
        # evidence, deterministic scores, and consistency-gate awareness.
        "unified_smart_decisions": unified_smart_decisions,
        # Gap 5: the ONE authoritative normalized consistency gate. This is
        # the authoritative gate shape consumed by all live-context endpoints.
        "normalized_gate": normalized_gate,
        "month_comparison": [
            {"month": m["month"], "revenue": m["revenue"], "expenses": m["expenses"]}
            for m in month_cmp
        ],
        "expense_by_type": [{"type": d, "amount": t} for d, _, t in maint_freq[:5]],
        "smart_decisions": smart_decisions[:8],
        # Gap 4: next_actions derived from unified_smart_decisions when an
        # analysis exists. Each action references the unified decision id
        # so the same operational event keeps the same id across all views.
        # The hardcoded fallback below is only used when unified_next_actions
        # is empty (no decisions were produced).
        "next_actions": unified_next_actions if unified_next_actions else [
            {"key": "update_portfolio", "icon": "database", "route": "/portfolio"},
            {"key": "send_alerts", "icon": "bell", "route": "/notifications"},
            {"key": "create_pdf", "icon": "file-text", "route": "/reports"},
            {"key": "compare_months", "icon": "bar-chart-2", "route": "/insights"},
            {"key": "profit_analysis", "icon": "trending-up", "route": "/insights"},
            {"key": "forecast_expenses", "icon": "activity", "route": "/intelligence"},
            {"key": "show_risks", "icon": "alert-triangle", "route": "/health"},
            {"key": "improvement_plan", "icon": "target", "route": "/hub"},
        ],
        "linked_files": [
            {
                "name": fc.get("name"),
                "category": fc.get("category"),
                "category_label": fc.get("category_ar") if lang == "ar" else fc.get("category_en"),
                "month": fc.get("month"),
                "confidence": fc.get("confidence"),
            }
            for fc in (deep.get("file_classifications") or [])
        ],
        "intake_meta": {
            "engine": "property_intake_v2",
            "synthetic_fallback": deep.get("used_synthetic", False),
            "parse_errors": deep.get("parse_errors") or [],
            "files_without_content": deep.get("files_without_content") or [],
            "koil_understanding_version": koil_understanding.get("version"),
            "koil_understanding_mode": koil_understanding.get("mode"),
            "parse_by_file": [
                {
                    "file_name": pr.get("file_name"),
                    "month": pr.get("month"),
                    "year": pr.get("year"),
                    "row_count": pr.get("row_count"),
                    "ok": pr.get("ok"),
                    "column_labels": pr.get("column_labels") or {},
                    "column_map": pr.get("column_map") or {},
                    "column_confidence": pr.get("column_confidence"),
                }
                for pr in (deep.get("parsed_rolls") or [])
            ],
        },
    }
