"""Executive Brain V2 orchestrator."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from adapters.executive.agenda import build_executive_agenda
from adapters.executive.daily_brief import build_daily_executive_brief
from adapters.executive.opportunities import discover_opportunities
from adapters.executive.ranking import agenda_caps, build_ranked_items


def build_executive_brain(
    settings: Dict[str, Any],
    properties: List[dict],
    tenants: List[dict],
    contracts: List[dict],
    decisions: List[dict],
    reports: List[dict] | None = None,
    *,
    lifecycle: Optional[Dict[str, Any]] = None,
    normalized_lifecycle: Optional[Dict[str, Any]] = None,
    lifecycle_decisions: Optional[List[Dict[str, Any]]] = None,
    unified_smart_decisions: Optional[List[Dict[str, Any]]] = None,
    canonical_portfolio_summary: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Full executive package: brief + agenda + ranked queue + opportunities.

    Gap 3: when a persisted ai_state lifecycle is provided (imported from
    upload analysis), it is passed to build_ranked_items() (injecting
    tenant-change items) and to build_daily_executive_brief() (weaving
    turnover signals into the what/why narrative). A lifecycle_summary
    block is added to the portfolio section. Pre-Gap-3 behavior is fully
    preserved when lifecycle is None.

    Gap 4: when unified_smart_decisions is provided, ranked_decisions +
    agenda are DERIVED from the unified list (not independently rebuilt
    from conflicting sources). Each ranked item carries the unified
    decision id so the same operational event keeps the same id across
    /api/decisions, /api/executive, /api/briefing, /api/verdicts.
    """
    reports = reports or []
    # Gap A: Use authoritative counts from persisted AI state.
    # Hierarchy:
    #   portfolio.units → canonical_portfolio_summary.units_count (unique units, includes vacant)
    #   portfolio.occupied → canonical_portfolio_summary.occupied_units_count
    #   portfolio.vacant → canonical_portfolio_summary.vacant_units_count
    #   portfolio.tenants → normalized_lifecycle.summary.active_count (active tenants only)
    #   portfolio.properties → canonical_portfolio_summary.properties_count (or len(properties))
    # NEVER replace one count with another — they measure different things.
    nl = normalized_lifecycle if isinstance(normalized_lifecycle, dict) else None
    nl_summary = (nl or {}).get("summary") or {}
    active_tenants = nl_summary.get("active_count") if nl_summary else None
    cps = canonical_portfolio_summary if isinstance(canonical_portfolio_summary, dict) else None
    canonical_units = cps.get("units_count") if cps else None
    canonical_properties = cps.get("properties_count") if cps else None
    canonical_occupied = cps.get("occupied_units_count") if cps else None
    canonical_vacant = cps.get("vacant_units_count") if cps else None

    # properties_count: from canonical when available, otherwise len(properties)
    unit_count = canonical_properties if canonical_properties is not None else len(properties)
    # tenants_count: from lifecycle active_count when available
    tenant_count = active_tenants if active_tenants is not None else len(tenants)
    # For portfolio block: units = canonical unique units (includes vacant), properties = property rows
    portfolio_units = canonical_units if canonical_units is not None else len(properties)
    # Occupied / vacant from canonical when available; otherwise None (legacy).
    portfolio_occupied = canonical_occupied
    portfolio_vacant = canonical_vacant
    n = max(len(properties), 1)
    annual_revenue = sum(float(p.get("monthly_revenue") or 0) for p in properties) * 12
    avg_health = round(sum(p.get("health_score", 0) for p in properties) / n)
    occupancy_pct = round(100 * sum(p.get("occupancy", 0) for p in properties) / n)
    expiring = sum(1 for c in contracts if c.get("status") == "expiring")

    # Gap 3: pass lifecycle to build_ranked_items so tenant-change items
    # appear in the ranked queue + agenda.
    ranked = build_ranked_items(properties, tenants, contracts, decisions, lifecycle=lifecycle)

    # Gap 4: when unified_smart_decisions is provided, DERIVE ranked from
    # it instead of independently rebuilding from conflicting sources.
    # This ensures /api/executive.ranked_decisions uses the SAME decision
    # ids as /api/decisions, /api/briefing, /api/verdicts.
    nl = normalized_lifecycle if isinstance(normalized_lifecycle, dict) else None
    lc_decisions = list(lifecycle_decisions or [])
    if unified_smart_decisions:
        ranked = []
        for ud in unified_smart_decisions:
            ranked.append({
                "id": ud.get("id", ""),
                "source": ud.get("source", "unified"),
                "kind": ud.get("kind", "tenant"),
                "priority": ud.get("priority", "medium"),
                "score": float(ud.get("score", 0)),
                "tier": ud.get("tier", "follow_up"),
                "title": ud.get("title", ""),
                "why": ud.get("why", ""),
                "action": ud.get("action", ""),
                "impact_aed": int(ud.get("financial_impact", 0)),
                "property_id": ud.get("property_id"),
                "route": ud.get("route", "/tenants"),
                # Gap 4: preserve the full unified decision as a nested
                # object so callers can access provenance + evidence +
                # confidence + dedupe_key.
                "unified_decision": ud,
                "requires_confirmation": ud.get("requires_confirmation", True),
                "confidence": ud.get("confidence", 70),
                "blocked_by_gate": ud.get("blocked_by_gate", False),
                "dedupe_key": ud.get("dedupe_key", ""),
            })
    else:
        # Gap 3 (complete) path: inject lifecycle decisions into the ranked
        # queue when unified is NOT available (backward compat).
        if lc_decisions:
            seen_keys: set = set()
            unique_lc: List[Dict[str, Any]] = []
            for ld in lc_decisions:
                key = f"{ld.get('kind')}|{ld.get('tenant_name')}|{ld.get('unit_label')}|{ld.get('reporting_period')}"
                if key in seen_keys:
                    continue
                seen_keys.add(key)
                unique_lc.append(ld)
            for ld in unique_lc:
                ranked.append({
                    "id": ld.get("id", ""),
                    "source": "lifecycle",
                    "kind": ld.get("kind", "tenant"),
                    "priority": ld.get("priority", "medium"),
                    "score": float(ld.get("score", 0)),
                    "tier": ld.get("tier", "follow_up"),
                    "title": ld.get("title", ""),
                    "why": ld.get("why", ""),
                    "action": ld.get("action", ""),
                    "impact_aed": 0,
                    "property_id": ld.get("property_id"),
                    "route": ld.get("route", "/tenants"),
                    "lifecycle_decision": ld,
                    "requires_confirmation": ld.get("requires_confirmation", True),
                    "confidence": ld.get("confidence", 70),
                })
        # Re-sort after injection.
        priority_rank = {"critical": 0, "high": 1, "medium": 2, "low": 3}
        ranked.sort(key=lambda x: (priority_rank.get(x.get("priority", "low"), 9), -x.get("score", 0)))

    opportunities = discover_opportunities(properties, tenants, contracts, decisions)
    # Gap 3 (complete): add lifecycle-derived opportunities (collection
    # campaign from late tenants, onboarding follow-up from newcomers).
    if nl:
        nl_summary = nl.get("summary") or {}
        late_count = int(nl_summary.get("late_count") or 0)
        newcomer_count = int(nl_summary.get("newcomers_count") or 0)
        if late_count >= 2:
            # Collection campaign opportunity.
            late_tenants = nl.get("late_tenants") or []
            total_unpaid = sum(float(lt.get("total_unpaid") or 0) for lt in late_tenants)
            opportunities.append({
                "id": "opp_lifecycle_collection",
                "kind": "collection",
                "title": f"حملة تحصيل موحّدة — {late_count} مستأجر متأخر",
                "why": f"متأخرات مؤكدة من الاستيراد · {total_unpaid:,.0f} ر.س.",
                "action": "خصص ساعة تحصيل واتصل بالقائمة كاملة",
                "impact_aed": round(total_unpaid),
                "score": 70.0,
                "property_id": None,
                "route": "/tenants",
            })
        if newcomer_count >= 1:
            opportunities.append({
                "id": "opp_lifecycle_onboard",
                "kind": "onboarding",
                "title": f"استقبل {newcomer_count} مستأجر جديد",
                "why": "مستأجرون جدد من الاستيراد — أكّد العقود والجوالات.",
                "action": "جهّز عقود الاستقبال وسجّل الجوالات",
                "impact_aed": 0,
                "score": 55.0,
                "property_id": None,
                "route": "/tenants",
            })
        opportunities.sort(key=lambda o: -o.get("score", 0))

    agenda = build_executive_agenda(ranked, opportunities, unit_count)
    # Gap 3: pass lifecycle to build_daily_executive_brief so turnover
    # signals appear in the what/why narrative.
    daily_brief = build_daily_executive_brief(
        settings, agenda, ranked, opportunities, unit_count, tenant_count,
        lifecycle=lifecycle,
        normalized_lifecycle=normalized_lifecycle,
    )

    # Gap 3: lifecycle_summary block in the portfolio section.
    lifecycle_summary: Optional[Dict[str, Any]] = None
    if lifecycle and isinstance(lifecycle, dict):
        departed_count = int(lifecycle.get("departed_count") or len(lifecycle.get("departed") or []))
        newcomers_count = int(lifecycle.get("newcomers_count") or len(lifecycle.get("newcomers") or []))
        changes = lifecycle.get("tenant_changes") or []
        lifecycle_summary = {
            "has_signals": bool(departed_count or newcomers_count or changes),
            "departed_count": departed_count,
            "newcomers_count": newcomers_count,
            "tenant_changes_count": len(changes),
            "month_count": int(lifecycle.get("month_count") or 0),
            "last_month": lifecycle.get("last_month"),
            "last_year": lifecycle.get("last_year"),
        }

    # Gap 3 (complete): enrich lifecycle_summary with normalized_lifecycle
    # fields (late_count, payment_ledger_count, MoM change, annual_stats,
    # warnings, unresolved).
    if nl:
        nl_summary = nl.get("summary") or {}
        month_cmp = nl.get("month_comparison") or []
        mom_change = None
        if len(month_cmp) >= 2:
            last = month_cmp[-1]
            prev = month_cmp[-2]
            mom_change = {
                "prev_month": prev.get("month"),
                "cur_month": last.get("month"),
                "delta_revenue": last.get("delta_revenue"),
                "prev_collected": prev.get("collected"),
                "cur_collected": last.get("collected"),
            }
        if lifecycle_summary is None:
            lifecycle_summary = {
                "has_signals": False,
                "departed_count": 0,
                "newcomers_count": 0,
                "tenant_changes_count": 0,
                "month_count": 0,
            }
        lifecycle_summary.update({
            "has_signals": lifecycle_summary.get("has_signals") or bool(nl_summary),
            "late_count": int(nl_summary.get("late_count") or 0),
            "active_count": int(nl_summary.get("active_count") or 0),
            "payment_ledger_count": len(nl.get("payment_ledger") or []),
            "late_by_month_count": len(nl.get("late_by_month") or []),
            "mom_change": mom_change,
            "annual_stats": nl.get("annual_stats") or {},
            "warnings_count": len(nl.get("warnings") or []),
            "unresolved_count": len(nl.get("unresolved") or []),
            "has_real_content": bool(nl.get("has_real_content", True)),
            "lifecycle_version": nl.get("version"),
            "reporting_period": nl.get("reporting_period") or {},
        })

    # Gap 3 (complete): risks block — surface lifecycle risks.
    risks: List[Dict[str, Any]] = []
    if nl:
        nl_summary = nl.get("summary") or {}
        if int(nl_summary.get("late_count") or 0) > 0:
            late_tenants = nl.get("late_tenants") or []
            total_unpaid = sum(float(lt.get("total_unpaid") or 0) for lt in late_tenants)
            risks.append({
                "id": "risk_lifecycle_late_tenants",
                "severity": "high" if total_unpaid > 5000 else "medium",
                "title": f"{nl_summary.get('late_count', 0)} مستأجر متأخر",
                "detail": f"متأخرات مؤكدة · {total_unpaid:,.0f} ر.س",
                "evidence_source": "normalized_lifecycle.late_tenants",
            })
        if int(nl_summary.get("departed_count") or 0) > 0:
            risks.append({
                "id": "risk_lifecycle_departed",
                "severity": "medium",
                "title": f"{nl_summary.get('departed_count', 0)} مغادرة",
                "detail": "راجع إخلاء الوحدات وأعد التأجير",
                "evidence_source": "normalized_lifecycle.departed",
            })
        unresolved = nl.get("unresolved") or []
        if unresolved:
            risks.append({
                "id": "risk_lifecycle_unresolved",
                "severity": "medium",
                "title": f"{len(unresolved)} عنصر غير محلول",
                "detail": "بيانات ناقصة — راجع قبل الإجراءات التنفيذية",
                "evidence_source": "normalized_lifecycle.unresolved",
            })
        if not nl.get("has_real_content", True):
            risks.append({
                "id": "risk_lifecycle_filename_only",
                "severity": "high",
                "title": "رفع أسماء ملفات فقط",
                "detail": "لا يمكن إنتاج إشارات دورة حياة بدون محتوى",
                "evidence_source": "normalized_lifecycle.has_real_content",
            })

    portfolio_block: Dict[str, Any] = {
        "units": portfolio_units,
        "properties": unit_count,
        "tenants": tenant_count,
        "occupied": portfolio_occupied,
        "vacant": portfolio_vacant,
        "contracts_tracked": len(contracts),
        "open_decisions": len(decisions),
        "avg_health": avg_health,
        "occupancy_pct": occupancy_pct,
        "annual_revenue_aed": round(annual_revenue),
        "expiring_contracts": expiring,
    }
    # Gap 3: attach lifecycle_summary to portfolio block when present.
    # Additive — existing keys unchanged, existing consumers ignore the
    # new key.
    if lifecycle_summary is not None:
        portfolio_block["lifecycle"] = lifecycle_summary

    brain: Dict[str, Any] = {
        "version": "executive-v2",
        "portfolio": portfolio_block,
        "daily_brief": daily_brief,
        "agenda": agenda,
        "ranked_decisions": ranked[:50],
        "opportunities": opportunities,
        "meta": {
            "ranking_factors": [
                "urgency",
                "rent_value",
                "contract_status",
                "financial_impact",
                "property_health",
                "priority",
                # Gap 3: lifecycle is now a ranking input.
                "lifecycle",
            ],
            "agenda_caps": agenda_caps(unit_count),
            # Gap 3: marker so callers can verify lifecycle was considered.
            "lifecycle_included": lifecycle_summary is not None,
            # Gap 3 (complete): count of lifecycle decisions injected.
            "lifecycle_decisions_count": len(lc_decisions),
        },
    }
    # Gap 3 (complete): attach risks block when lifecycle present.
    if risks:
        brain["risks"] = risks
    return brain
