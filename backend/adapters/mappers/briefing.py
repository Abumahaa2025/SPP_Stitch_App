"""Build Emergent Briefing from live Sheets-mapped domain data only."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from adapters.mappers.brain_copy import (
    contract_expiry_phrase,
    contract_renewal_action,
    contract_sort_key,
    days_until,
    decision_action_ar,
    decision_detail_ar,
    decision_title_ar,
    fmt_money_ar,
    polish_decisions,
    salutation_ar,
    sanitize_brain_text,
)

_PRIORITY = {"critical": 0, "high": 1, "medium": 2, "low": 3}


def _owner_first_name(settings: Dict[str, Any]) -> str:
    for key in ("clientName", "propertyName"):
        raw = str(settings.get(key) or "").strip()
        if raw:
            return raw.split()[0]
    return ""


def _sorted_decisions(decisions: List[dict]) -> List[dict]:
    return sorted(decisions, key=lambda d: _PRIORITY.get(d.get("priority", "low"), 9))


def build_briefing(
    settings: Dict[str, Any],
    properties: List[dict],
    tenants: List[dict],
    contracts: List[dict],
    decisions: List[dict],
    reports: List[dict],
    sensor_alerts: List[dict] | None = None,
    *,
    reasoning: Optional[Dict[str, Any]] = None,
    consistency_gate: Optional[Dict[str, Any]] = None,
    lifecycle: Optional[Dict[str, Any]] = None,
    executive_brief: Optional[Dict[str, Any]] = None,
    normalized_lifecycle: Optional[Dict[str, Any]] = None,
    unified_smart_decisions: Optional[List[Dict[str, Any]]] = None,
    canonical_portfolio_summary: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Build the morning briefing.

    Pre-Gap-1 behavior is fully preserved when reasoning/gate/lifecycle are
    absent (None) — the briefing rebuilds from raw properties/tenants/contracts.

    Gap 1: when a successful Apply has persisted AI reasoning artifacts, the
    caller passes them here so the briefing can:
      - cite the Koil brief / top recommendation as evidence
      - downgrade confidence language when consistency_gate is blocked
      - surface lifecycle signals (departed/newcomers) that the legacy
        contract-based logic would miss

    Gap 3 (complete): when normalized_lifecycle is provided, the briefing
    uses it as the authoritative source for:
      - late tenants (with payment evidence)
      - payment history (ledger entries)
      - month-over-month collection change
    The legacy `lifecycle` arg (property_knowledge.lifecycle) is still
    honored for backward compat — normalized_lifecycle takes precedence.

    The narrative still respects the 2-6 line test contract - reasoning
    evidence replaces (not appends to) the first action line when present.
    """
    sensor_alerts = sensor_alerts or []

    portfolio_value = sum(float(p.get("monthly_revenue", 0)) for p in properties) * 12
    avg_health = round(sum(p.get("health_score", 0) for p in properties) / max(len(properties), 1))
    occupancy = round(100 * sum(p.get("occupancy", 0) for p in properties) / max(len(properties), 1))

    ranked = _sorted_decisions(decisions)
    critical = [d for d in ranked if d.get("priority") in ("critical", "high")]
    attention_props = sorted(
        [p for p in properties if p.get("health_score", 100) < 80],
        key=lambda p: p.get("health_score", 0),
    )
    expiring = [c for c in contracts if c.get("status") == "expiring"]
    vacant = [p for p in properties if p.get("occupancy", 0) < 0.5]
    financial = [d for d in ranked if d.get("kind") == "financial"]
    overdue = [c for c in expiring if (days_until(c.get("end", "")) or 1) < 0]

    # --- Gap 1: reason about lifecycle signals (departed / newcomers) ---
    # When the import pipeline has detected tenant changes, surface them
    # in the headline. This is additive - if lifecycle is None, the legacy
    # headline logic runs unchanged.
    #
    # Gap 3 (complete): when normalized_lifecycle is provided, use it as
    # the authoritative source. It takes precedence over the legacy
    # property_knowledge.lifecycle arg.
    nl = normalized_lifecycle if isinstance(normalized_lifecycle, dict) else None
    if nl:
        nl_summary = nl.get("summary") or {}
        departed_count = int(nl_summary.get("departed_count") or 0)
        newcomers_count = int(nl_summary.get("newcomers_count") or 0)
        late_count = int(nl_summary.get("late_count") or 0)
    elif lifecycle and isinstance(lifecycle, dict):
        departed_count = int(lifecycle.get("departed_count") or 0)
        newcomers_count = int(lifecycle.get("newcomers_count") or 0)
        late_count = 0
    else:
        departed_count = 0
        newcomers_count = 0
        late_count = 0

    # --- Gap 1: gate status colors the headline confidence ---
    gate_blocked = bool(
        consistency_gate
        and consistency_gate.get("decision_status") == "blocked_for_review"
    )

    # Gap 3 (complete): extract late tenant + MoM change evidence from
    # normalized_lifecycle for use in the narrative below.
    nl_late_tenants: List[dict] = []
    nl_mom_change: Optional[Dict[str, Any]] = None
    nl_payment_ledger_count = 0
    if nl:
        nl_late_tenants = list(nl.get("late_tenants") or [])[:3]
        nl_payment_ledger_count = len(nl.get("payment_ledger") or [])
        month_cmp = nl.get("month_comparison") or []
        if len(month_cmp) >= 2:
            last = month_cmp[-1]
            prev = month_cmp[-2]
            delta = float(last.get("delta_revenue") or 0)
            nl_mom_change = {
                "prev_month": prev.get("month"),
                "cur_month": last.get("month"),
                "prev_collected": prev.get("collected"),
                "cur_collected": last.get("collected"),
                "delta": delta,
            }

    if gate_blocked:
        headline = "راجع تعارضات الاستيراد قبل أي إجراء تنفيذي."
    elif critical:
        headline = f"ابدأ بمعالجة {len(critical)} قرارات عاجلة اليوم."
    elif late_count and nl:
        # Gap 3 (complete): late tenants from normalized lifecycle lead
        # the headline when there are no urgent decisions.
        headline = f"تواصل مع {late_count} مستأجر متأخر من آخر استيراد."
    elif overdue:
        headline = f"عالج {len(overdue)} عقداً متأخراً عن التجديد فوراً."
    elif expiring:
        headline = f"راجع {len(expiring)} عقداً في نافذة التجديد."
    elif departed_count and newcomers_count:
        headline = f"راجع {departed_count} مغادرة و{newcomers_count} دخول هذا الموسم."
    elif attention_props:
        headline = f"عالج {len(attention_props)} وحدة ضعيفة الصحة أولاً."
    elif vacant:
        headline = f"سوّق {len(vacant)} وحدة شاغرة الآن."
    else:
        headline = f"لا قرارات عاجلة — راقب الإشغال عند {occupancy}%."

    lines: List[str] = []

    # --- Gap 1: when reasoning is present, lead with its evidence ---
    # Replace (not append) the first action line so we stay within the
    # 2-6 line test cap. Fall back to the legacy line when reasoning is absent.
    reasoning_top_action = None
    reasoning_brief = None
    if reasoning and isinstance(reasoning, dict):
        reasoning_brief = reasoning.get("brief") or ""
        recs = reasoning.get("recommendations") or []
        if recs:
            top_rec = recs[0]
            reasoning_top_action = top_rec.get("action") or ""

    # Gap 4: when unified_smart_decisions is provided, the action line
    # references the top unified decision id so the same operational event
    # keeps the same id across /api/decisions, /api/executive, /api/briefing,
    # /api/verdicts. Falls back to the Koïl/legacy path when no unified list.
    unified_top = None
    if unified_smart_decisions:
        # Find the first non-blocked decision (or the first if all blocked).
        for ud in unified_smart_decisions:
            if not ud.get("blocked_by_gate", False):
                unified_top = ud
                break
        if unified_top is None and unified_smart_decisions:
            unified_top = unified_smart_decisions[0]

    if unified_top:
        # Gap 4: action line cites the unified decision id.
        action_text = sanitize_brain_text(unified_top.get("action") or "").rstrip(".")
        title_text = sanitize_brain_text(unified_top.get("title") or "").rstrip(".")
        decision_id = unified_top.get("id", "")
        # Keep the line tight — action + title + decision_id tag.
        id_tag = f" (قرار: {decision_id[:12]})" if decision_id else ""
        lines.append(f"افعل الآن: {title_text} — {action_text}.{id_tag}")
    elif reasoning_top_action:
        # Cite the Koil brief as evidence (truncated to fit the line cap).
        evidence_tag = ""
        if reasoning_brief:
            # Keep the line tight - first clause of the brief only.
            evidence_tag = " · " + sanitize_brain_text(reasoning_brief).split(".")[0][:80]
        lines.append(f"افعل الآن (كويل): {sanitize_brain_text(reasoning_top_action).rstrip('.')}{evidence_tag}.")
    elif ranked:
        top = ranked[0]
        lines.append(
            f"افعل الآن: {decision_title_ar(top)} — {decision_detail_ar(top, contracts).rstrip('.')}."
        )

    if len(critical) > 1:
        titles = " · ".join(decision_title_ar(d) for d in critical[1:3])
        if titles:
            lines.append(f"بعدها: {titles}.")

    if financial:
        late = financial[0]
        lines.append(
            f"التحصيل: {decision_title_ar(late)} — {decision_detail_ar(late, contracts).rstrip('.')}."
        )

    # --- Gap 3 (complete): late tenant evidence from normalized lifecycle ---
    # When normalized_lifecycle has late_tenants, surface the top one with
    # payment evidence (months late + total unpaid). This is more specific
    # than the generic "financial" decision line above.
    if nl_late_tenants and len(lines) < 5:
        lt = nl_late_tenants[0]
        lt_name = lt.get("tenant") or "—"
        lt_unit = lt.get("unit") or "—"
        lt_months = int(lt.get("late_month_count") or 0)
        lt_unpaid = float(lt.get("total_unpaid") or 0)
        lines.append(
            f"متأخر مؤكد: {lt_name} (وحدة {lt_unit}) — {lt_months} شهر · {lt_unpaid:,.0f} ر.س."
        )

    # --- Gap 3 (complete): month-over-month collection change ---
    # When normalized_lifecycle has 2+ months in month_comparison, surface
    # the delta so the owner sees collection trend at a glance.
    if nl_mom_change and len(lines) < 5:
        mom = nl_mom_change
        direction = "انخفاض" if mom["delta"] < 0 else "زيادة"
        lines.append(
            f"التحصيل شهرياً: {mom['prev_month']} → {mom['cur_month']} — "
            f"{direction} {abs(mom['delta']):,.0f} ر.س."
        )

    # --- Gap 1: lifecycle departure/newcomer line (only when present) ---
    # Replaces the "راجع صحة" line when lifecycle has signals - keeps the
    # narrative within 6 lines.
    if departed_count and newcomers_count and len(lines) < 5:
        lines.append(f"تنقلات: {departed_count} مغادرة · {newcomers_count} دخول — أكّد الهويات قبل التحصيل.")
    elif attention_props:
        names = "، ".join(p["name"] for p in attention_props[:3])
        lines.append(f"راجع صحة: {names} — خطّط لتدخل خلال الأسبوع.")

    if expiring:
        nearest = min(expiring, key=lambda c: contract_sort_key(c.get("end", "")))
        end_days = days_until(nearest.get("end", ""))
        guidance = contract_expiry_phrase(end_days)
        action = contract_renewal_action(end_days)
        lines.append(f"التجديدات ({len(expiring)}): {guidance} — {action}.")

    if vacant:
        names = "، ".join(p.get("name", "") for p in vacant[:3])
        lines.append(f"الشواغر: أطلق تسويق {names}.")

    if reports:
        r = reports[0]
        highlight = sanitize_brain_text(str(r.get("highlight") or "")).rstrip(".")
        if highlight:
            lines.append(f"راجع التقرير: {sanitize_brain_text(str(r.get('title', '')))} — {highlight}.")

    lines.append(
        f"لمحة: صحة {avg_health} · إشغال {occupancy}% · "
        f"إيراد سنوي {fmt_money_ar(portfolio_value)} ريال · {len(tenants)} مستأجر."
    )

    # Executive voice stays short (test contract + UI): 2-6 lines, always keep the snapshot last.
    if len(lines) > 6:
        snap = lines[-1]
        lines = lines[:-1][:5] + [snap]

    # Gap A: Use authoritative counts from persisted canonical portfolio.
    # Hierarchy:
    #   properties_count → canonical_portfolio_summary.properties_count → len(properties)
    #   tenants_count → normalized_lifecycle.summary.active_count → len(tenants)
    #   units_count → canonical_portfolio_summary.units_count (UNIQUE units,
    #                 including vacant ones — occupied + vacant)
    #   occupied_units_count → canonical_portfolio_summary.occupied_units_count
    #   vacant_units_count → canonical_portfolio_summary.vacant_units_count
    # NEVER replace properties_count with active_count — they measure different things.
    nl = normalized_lifecycle if isinstance(normalized_lifecycle, dict) else None
    nl_summary = (nl or {}).get("summary") or {}
    active_tenants = nl_summary.get("active_count") if nl_summary else None
    cps = canonical_portfolio_summary if isinstance(canonical_portfolio_summary, dict) else None
    canonical_properties = cps.get("properties_count") if cps else None
    canonical_units = cps.get("units_count") if cps else None
    canonical_occupied = cps.get("occupied_units_count") if cps else None
    canonical_vacant = cps.get("vacant_units_count") if cps else None
    # properties_count: use canonical when available, otherwise len(properties)
    properties_count = canonical_properties if canonical_properties is not None else len(properties)
    tenants_count = active_tenants if active_tenants is not None else len(tenants)
    # units_count + occupied + vacant: only present when canonical summary exists.
    # When absent (legacy / no AI state), they remain None so the client can
    # detect "field not available" rather than confusing it with 0.
    units_count = canonical_units
    occupied_units_count = canonical_occupied
    vacant_units_count = canonical_vacant

    brief_out: Dict[str, Any] = {
        "salutation": salutation_ar(),
        "owner_name": _owner_first_name(settings),
        "headline": headline,
        "narrative": lines,
        "portfolio_annual_revenue": portfolio_value,
        "avg_health": avg_health,
        "occupancy": occupancy,
        "properties_count": properties_count,
        "tenants_count": tenants_count,
        "units_count": units_count,
        "occupied_units_count": occupied_units_count,
        "vacant_units_count": vacant_units_count,
        "expiring_contracts": len(expiring),
        "decisions": polish_decisions(ranked, contracts),
        "sensor_alerts": sensor_alerts[:3],
    }
    # Gap 1: surface the reasoning provenance in the response so clients
    # can verify the briefing is grounded in imported AI state. All
    # additive fields - existing clients ignore them.
    if reasoning or consistency_gate or lifecycle or normalized_lifecycle:
        brief_out["ai_reasoning"] = {
            "has_reasoning": bool(reasoning),
            "has_consistency_gate": bool(consistency_gate),
            "gate_status": (consistency_gate or {}).get("decision_status") if consistency_gate else None,
            "reasoning_version": (reasoning or {}).get("version") if reasoning else None,
            "reasoning_confidence": (reasoning or {}).get("confidence") if reasoning else None,
            "departed_count": departed_count,
            "newcomers_count": newcomers_count,
            # Gap 3 (complete): normalized lifecycle provenance.
            "has_normalized_lifecycle": bool(normalized_lifecycle),
            "lifecycle_version": (normalized_lifecycle or {}).get("version") if normalized_lifecycle else None,
            "lifecycle_source": (normalized_lifecycle or {}).get("source") if normalized_lifecycle else None,
            "lifecycle_has_real_content": (normalized_lifecycle or {}).get("has_real_content") if normalized_lifecycle else None,
            "late_count": late_count,
            "payment_ledger_count": nl_payment_ledger_count,
            "mom_change": nl_mom_change,
            "unresolved_count": len((normalized_lifecycle or {}).get("unresolved") or []) if normalized_lifecycle else 0,
        }
    return brief_out
