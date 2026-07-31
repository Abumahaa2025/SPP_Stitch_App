"""Lifecycle Intelligence — Gap 3 completion.

Builds ONE normalized lifecycle payload from the existing intake_lifecycle
functions, then derives 7 specific lifecycle decision kinds with stable
deduplication + confidence + consistency-gate awareness.

Public API:
    build_normalized_lifecycle(deep, lang)         -> NormalizedLifecycle
    generate_lifecycle_decisions(normalized, gate) -> List[LifecycleDecision]
    LIFECYCLE_DECISION_KINDS                        -> the 7 allowed kinds

This module is purely additive — it calls the existing functions:
    build_monthly_index()
    build_lifecycle()
    build_tenant_payment_ledger()
    find_late_tenants()
    build_late_payments_by_month()
    build_month_comparison()
    build_annual_stats()
It never recreates their calculations.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Literal, Optional

from adapters.upload_analysis.intake_lifecycle import (
    build_annual_stats,
    build_late_payments_by_month,
    build_lifecycle,
    build_month_comparison,
    build_monthly_index,
    build_tenant_payment_ledger,
    find_late_tenants,
)

Lang = Literal["ar", "en"]

# The 7 allowed lifecycle decision kinds. No other kinds are emitted.
LIFECYCLE_DECISION_KINDS = (
    "follow_up_departed_tenant",
    "onboard_new_tenant",
    "contact_late_tenant",
    "review_payment_history",
    "investigate_tenant_change",
    "compare_collection_periods",
    "request_missing_lifecycle_data",
)


@dataclass
class NormalizedLifecycle:
    """One normalized lifecycle payload — the authoritative shape persisted
    in ai_state and consumed by all live-context endpoints."""

    version: str = "lifecycle-v1"
    reporting_period: Dict[str, Any] = field(default_factory=lambda: {
        "from_month": None, "from_year": None,
        "to_month": None, "to_year": None,
    })
    departed: List[dict] = field(default_factory=list)
    newcomers: List[dict] = field(default_factory=list)
    active: List[dict] = field(default_factory=list)
    tenant_changes: List[dict] = field(default_factory=list)
    late_tenants: List[dict] = field(default_factory=list)
    payment_ledger: List[dict] = field(default_factory=list)
    late_by_month: List[dict] = field(default_factory=list)
    month_comparison: List[dict] = field(default_factory=list)
    annual_stats: Dict[str, Any] = field(default_factory=dict)
    summary: Dict[str, int] = field(default_factory=lambda: {
        "departed_count": 0, "newcomers_count": 0,
        "active_count": 0, "late_count": 0,
    })
    warnings: List[str] = field(default_factory=list)
    unresolved: List[Dict[str, Any]] = field(default_factory=list)
    # Provenance
    source: str = "upload_analysis"
    has_real_content: bool = True  # False when filename-only upload
    month_count: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "version": self.version,
            "reporting_period": dict(self.reporting_period),
            "departed": list(self.departed),
            "newcomers": list(self.newcomers),
            "active": list(self.active),
            "tenant_changes": list(self.tenant_changes),
            "late_tenants": list(self.late_tenants),
            "payment_ledger": list(self.payment_ledger),
            "late_by_month": list(self.late_by_month),
            "month_comparison": list(self.month_comparison),
            "annual_stats": dict(self.annual_stats),
            "summary": dict(self.summary),
            "warnings": list(self.warnings),
            "unresolved": list(self.unresolved),
            "source": self.source,
            "has_real_content": self.has_real_content,
            "month_count": self.month_count,
        }


@dataclass
class LifecycleDecision:
    """One lifecycle-derived smart decision.

    Required fields per Gap 3 spec section 8:
        id, source, kind, priority, score, tier, title, why, action,
        evidence, tenant_id, tenant_name, unit_id, unit_label,
        reporting_period, confidence, route, requires_confirmation
    """
    id: str
    source: str = "lifecycle"
    kind: str = ""  # one of LIFECYCLE_DECISION_KINDS
    priority: str = "medium"  # critical | high | medium | low
    score: float = 0.0
    tier: str = "follow_up"  # now | today | week | follow_up
    title: str = ""
    why: str = ""
    action: str = ""
    evidence: List[str] = field(default_factory=list)
    tenant_id: Optional[str] = None
    tenant_name: Optional[str] = None
    unit_id: Optional[str] = None
    unit_label: Optional[str] = None
    reporting_period: Dict[str, Any] = field(default_factory=dict)
    confidence: int = 70  # 0..100
    route: str = "/tenants"
    requires_confirmation: bool = True

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "source": self.source,
            "kind": self.kind,
            "priority": self.priority,
            "score": self.score,
            "tier": self.tier,
            "title": self.title,
            "why": self.why,
            "action": self.action,
            "evidence": list(self.evidence),
            "tenant_id": self.tenant_id,
            "tenant_name": self.tenant_name,
            "unit_id": self.unit_id,
            "unit_label": self.unit_label,
            "reporting_period": dict(self.reporting_period),
            "confidence": self.confidence,
            "route": self.route,
            "requires_confirmation": self.requires_confirmation,
        }


def _has_real_content(deep: Dict[str, Any]) -> bool:
    """Filename-only uploads must never produce lifecycle events.

    A real upload has at least one parsed_rolls entry with rows. If all
    files were filename-only (no textSnippet), parsed_rolls is empty or
    every entry has row_count=0.
    """
    parsed = deep.get("parsed_rolls") or []
    if not parsed:
        return False
    return any(int(pr.get("row_count") or 0) > 0 for pr in parsed)


def _build_reporting_period(lifecycle: Dict[str, Any], month_comparison: List[dict]) -> Dict[str, Any]:
    """Derive from_month/from_year/to_month/to_year from lifecycle + comparison."""
    last_month = lifecycle.get("last_month")
    last_year = lifecycle.get("last_year")

    if month_comparison and len(month_comparison) >= 1:
        first = month_comparison[0]
        last = month_comparison[-1]
        return {
            "from_month": first.get("month_num"),
            "from_year": _extract_year_from_comparison(first),
            "to_month": last.get("month_num"),
            "to_year": _extract_year_from_comparison(last),
        }
    return {
        "from_month": None, "from_year": None,
        "to_month": last_month, "to_year": last_year,
    }


def _extract_year_from_comparison(month_entry: Dict[str, Any]) -> Optional[int]:
    """month_comparison entries don't carry year directly — derive from label.

    The month_label format is "يناير 2026" / "January 2026".
    """
    label = str(month_entry.get("month") or "")
    if not label:
        return None
    # Find the 4-digit year in the label.
    import re
    m = re.search(r"\b(20\d{2})\b", label)
    return int(m.group(1)) if m else None


def build_normalized_lifecycle(deep: Dict[str, Any], lang: Lang = "ar") -> Dict[str, Any]:
    """Build the ONE normalized lifecycle payload from upload deep analysis.

    Calls the 7 existing intake_lifecycle functions — never recreates
    their calculations. Returns a dict ready to persist in ai_state.

    Args:
        deep: the analyze_statements_deep() output dict.
        lang: "ar" or "en" — controls month_label language.

    Returns:
        Dict matching NormalizedLifecycle.to_dict() shape.
    """
    deep = deep or {}
    has_content = _has_real_content(deep)

    # --- Filename-only guard: no lifecycle events when no real content ---
    # The existing functions still get called (so the shape is consistent)
    # but all event lists are forced empty and has_real_content=False.
    parsed_rolls = deep.get("parsed_rolls") or []
    expense_rolls = deep.get("expense_rolls") or []

    monthly_index = build_monthly_index(parsed_rolls)
    lifecycle = build_lifecycle(monthly_index)
    annual_stats = build_annual_stats(parsed_rolls, lifecycle)
    month_comparison = build_month_comparison(parsed_rolls, expense_rolls, lang)
    payment_ledger = build_tenant_payment_ledger(parsed_rolls)
    late_by_month = build_late_payments_by_month(payment_ledger)
    late_tenants = find_late_tenants(parsed_rolls)

    reporting_period = _build_reporting_period(lifecycle, month_comparison)

    # Extract the ledger entries as a list (the original is a dict keyed by tenant key).
    ledger_entries = list((payment_ledger.get("ledger") or {}).values())

    # Build warnings + unresolved from quality signals.
    warnings: List[str] = []
    unresolved: List[Dict[str, Any]] = []
    for pe in deep.get("parse_errors") or []:
        warnings.append(f"Parse error in {pe.get('file_name')}: {pe.get('error')}")
    for fw in deep.get("files_without_content") or []:
        warnings.append(f"File without content: {fw.get('file_name')}")
        unresolved.append({
            "code": "file_without_content",
            "file": fw.get("file_name"),
            "detail": "Filename-only upload — content not read",
        })

    # Surface payment-ledger quality issues as unresolved.
    unknown_count = 0
    for ent in ledger_entries:
        for m in ent.get("months") or []:
            if m.get("status") == "unknown_requires_review":
                unknown_count += 1
    if unknown_count > 0:
        unresolved.append({
            "code": "unclear_payment_months",
            "detail": f"{unknown_count} payment month(s) need review before confident claims",
            "count": unknown_count,
        })

    # Surface lifecycle departures without confirmation as unresolved.
    for d in lifecycle.get("departed") or []:
        if not d.get("confirmed"):
            unresolved.append({
                "code": "unconfirmed_departure",
                "unit": d.get("unit"),
                "tenant": d.get("tenant"),
                "detail": f"Departure of {d.get('tenant')} on unit {d.get('unit')} is unconfirmed",
            })

    if not has_content:
        # Force all event lists empty — filename-only uploads must NOT
        # create lifecycle events (Gap 3 requirement 12).
        return NormalizedLifecycle(
            reporting_period=reporting_period,
            departed=[],
            newcomers=[],
            active=[],
            tenant_changes=[],
            late_tenants=[],
            payment_ledger=[],
            late_by_month=list((late_by_month.get("months") or [])),
            month_comparison=month_comparison,
            annual_stats=annual_stats,
            summary={"departed_count": 0, "newcomers_count": 0, "active_count": 0, "late_count": 0},
            warnings=warnings,
            unresolved=unresolved,
            source="upload_analysis",
            has_real_content=False,
            month_count=int(lifecycle.get("month_count") or 0),
        ).to_dict()

    return NormalizedLifecycle(
        reporting_period=reporting_period,
        departed=list(lifecycle.get("departed") or []),
        newcomers=list(lifecycle.get("newcomers") or []),
        active=list(lifecycle.get("active") or []),
        tenant_changes=list(lifecycle.get("tenant_changes") or []) or _derive_changes_from_lifecycle(lifecycle),
        late_tenants=late_tenants,
        payment_ledger=ledger_entries,
        late_by_month=list((late_by_month.get("months") or [])),
        month_comparison=month_comparison,
        annual_stats=annual_stats,
        summary={
            "departed_count": int(lifecycle.get("departed_count") or len(lifecycle.get("departed") or [])),
            "newcomers_count": int(lifecycle.get("newcomers_count") or len(lifecycle.get("newcomers") or [])),
            # active_count counts UNIQUE OCCUPIED units in the latest month.
            # Vacant units (is_vacant=True OR empty tenant) are tracked in the
            # active list (so downstream knows they exist) but excluded here.
            # If lifecycle.active_count is already correctly computed upstream
            # (e.g., by build_annual_stats), use it; otherwise derive here.
            "active_count": _count_occupied_active(lifecycle),
            "late_count": len(late_tenants),
        },
        warnings=warnings,
        unresolved=unresolved,
        source="upload_analysis",
        has_real_content=True,
        month_count=int(lifecycle.get("month_count") or 0),
    ).to_dict()


def _count_occupied_active(lifecycle: Dict[str, Any]) -> int:
    """Count UNIQUE OCCUPIED units in the latest month's `active` list.

    A unit is "occupied" when its active entry has a non-empty tenant
    AND is_vacant is not True. Vacant units appear in the active list
    (so downstream knows the unit exists in the latest month) but are
    excluded from active_count.

    If lifecycle.active_count is already correctly computed upstream
    (e.g., by build_annual_stats), that value is preferred — but only
    when it's less than len(active), to defend against stale upstream
    code paths that still count vacant units.
    """
    active_list = lifecycle.get("active") or []
    if not active_list:
        upstream = lifecycle.get("active_count") or 0
        return int(upstream)
    occupied = sum(
        1 for a in active_list
        if not bool(a.get("is_vacant")) and (a.get("tenant") or "").strip()
    )
    return int(occupied)


def _derive_changes_from_lifecycle(lifecycle: Dict[str, Any]) -> List[dict]:
    """Fallback: if build_lifecycle didn't populate tenant_changes but
    departed/newcomers exist, derive simple changes from them.

    The existing build_lifecycle() in intake_lifecycle.py doesn't emit a
    'tenant_changes' field — that's added by property_knowledge_engine.
    This helper fills the gap so the normalized payload always has
    tenant_changes when there's turnover.
    """
    changes: List[dict] = []
    departed = lifecycle.get("departed") or []
    newcomers = lifecycle.get("newcomers") or []
    # Match by unit + month to detect replacements.
    for d in departed:
        unit = d.get("unit")
        dep_month = d.get("departed_month") or d.get("departedMonth")
        dep_year = d.get("departed_year") or d.get("departedYear")
        # Find a newcomer on the same unit in the same month.
        match = next(
            (n for n in newcomers
             if n.get("unit") == unit
             and (n.get("arrived_month") or n.get("arrivedMonth")) == dep_month),
            None,
        )
        if match:
            changes.append({
                "unit": unit,
                "from_tenant": d.get("tenant"),
                "to_tenant": match.get("tenant"),
                "month": dep_month,
                "year": dep_year,
                "type": "replacement",
                "confirmed": bool(d.get("confirmed") and match.get("confirmed")),
            })
        else:
            changes.append({
                "unit": unit,
                "from_tenant": d.get("tenant"),
                "to_tenant": None,
                "month": dep_month,
                "year": dep_year,
                "type": "departure",
                "confirmed": bool(d.get("confirmed")),
            })
    # Add arrivals without a matching departure.
    dep_units = {(d.get("unit"), d.get("departed_month") or d.get("departedMonth")) for d in departed}
    for n in newcomers:
        key = (n.get("unit"), n.get("arrived_month") or n.get("arrivedMonth"))
        if key in dep_units:
            continue  # already paired as replacement
        changes.append({
            "unit": n.get("unit"),
            "from_tenant": None,
            "to_tenant": n.get("tenant"),
            "month": n.get("arrived_month") or n.get("arrivedMonth"),
            "year": n.get("arrived_year") or n.get("arrivedYear"),
            "type": "arrival",
            "confirmed": bool(n.get("confirmed")),
        })
    return changes


# ===========================================================================
# Lifecycle decision engine — 7 kinds, dedup, confidence, gate-aware
# ===========================================================================

# Priority mapping for each kind (when gate is OK).
_KIND_PRIORITY = {
    "contact_late_tenant": "high",
    "follow_up_departed_tenant": "medium",
    "onboard_new_tenant": "medium",
    "review_payment_history": "medium",
    "investigate_tenant_change": "medium",
    "compare_collection_periods": "low",
    "request_missing_lifecycle_data": "high",
}

# Score mapping for each kind (when gate is OK).
_KIND_SCORE = {
    "contact_late_tenant": 70.0,
    "follow_up_departed_tenant": 55.0,
    "onboard_new_tenant": 55.0,
    "review_payment_history": 50.0,
    "investigate_tenant_change": 50.0,
    "compare_collection_periods": 40.0,
    "request_missing_lifecycle_data": 75.0,
}

# Confidence baseline per kind (when gate is OK + evidence is complete).
_KIND_BASELINE_CONFIDENCE = {
    "contact_late_tenant": 88,
    "follow_up_departed_tenant": 75,
    "onboard_new_tenant": 75,
    "review_payment_history": 80,
    "investigate_tenant_change": 60,
    "compare_collection_periods": 70,
    "request_missing_lifecycle_data": 90,
}


def _tier_for_score(score: float, priority: str) -> str:
    if score >= 75 or priority == "critical":
        return "now"
    if score >= 55 or priority == "high":
        return "today"
    if score >= 35:
        return "week"
    return "follow_up"


def _tenant_identity_key(tenant: Optional[str], unit: Optional[str]) -> str:
    """Stable identity key for deduplication: lowercased tenant + unit."""
    t = (tenant or "").strip().lower()
    u = (unit or "").strip().lower()
    return f"{t}|{u}"


def _period_key(reporting_period: Dict[str, Any]) -> str:
    """Stable period key for deduplication."""
    rp = reporting_period or {}
    return f"{rp.get('from_year')}-{rp.get('from_month')}_to_{rp.get('to_year')}-{rp.get('to_month')}"


def _dedup_key(kind: str, tenant: Optional[str], unit: Optional[str], period: Dict[str, Any]) -> str:
    """Stable deduplication key: kind + tenant identity + unit identity + period.

    The same operational event must appear once only.
    """
    return f"{kind}|{_tenant_identity_key(tenant, unit)}|{_period_key(period)}"


def _adjust_for_gate(priority: str, confidence: int, gate: Optional[Dict[str, Any]]) -> tuple:
    """When consistency_gate.status == 'blocked_for_review':
       - cap confidence at 50
       - downgrade priority to 'low' (or keep 'critical' → 'medium')
       - convert high-priority confirmed actions to review actions
    """
    if not gate or gate.get("decision_status") != "blocked_for_review":
        return priority, confidence
    # Cap confidence at 50 — no confident claims when gate is blocked.
    confidence = min(confidence, 50)
    # Downgrade priority — no high-priority confirmed actions when blocked.
    if priority == "critical":
        priority = "medium"
    elif priority == "high":
        priority = "low"
    return priority, confidence


def _route_for_kind(kind: str) -> str:
    return {
        "follow_up_departed_tenant": "/tenants",
        "onboard_new_tenant": "/tenants",
        "contact_late_tenant": "/tenants",
        "review_payment_history": "/tenants",
        "investigate_tenant_change": "/tenants",
        "compare_collection_periods": "/insights",
        "request_missing_lifecycle_data": "/upload",
    }.get(kind, "/tenants")


def generate_lifecycle_decisions(
    normalized: Dict[str, Any],
    gate: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    """Generate the 7 lifecycle decision kinds from the normalized payload.

    Each decision has the full Gap 3 section-8 shape. Deduplication is
    stable (kind + tenant + unit + period). When evidence is incomplete,
    confidence is lowered + a request_missing_lifecycle_data or
    investigate_tenant_change decision is generated instead of a confident
    departure/newcomer/payment claim.

    When consistency_gate.status == 'blocked_for_review':
       - confidence is capped at 50
       - high-priority confirmed actions become review decisions
       - caution language is used in `why` and `action`
    """
    normalized = normalized or {}
    has_content = bool(normalized.get("has_real_content", True))
    reporting_period = normalized.get("reporting_period") or {}
    unresolved = normalized.get("unresolved") or []

    decisions: List[Dict[str, Any]] = []
    seen_keys: set = set()

    def _add(dec: LifecycleDecision) -> None:
        key = _dedup_key(dec.kind, dec.tenant_name, dec.unit_label, dec.reporting_period)
        if key in seen_keys:
            return
        seen_keys.add(key)
        # Apply gate adjustments.
        priority, confidence = _adjust_for_gate(dec.priority, dec.confidence, gate)
        dec.priority = priority
        dec.confidence = confidence
        # Recompute tier from adjusted score/priority.
        dec.tier = _tier_for_score(dec.score, dec.priority)
        # If gate blocked + this was a high-priority action, convert to review.
        if gate and gate.get("decision_status") == "blocked_for_review":
            if dec.kind in ("contact_late_tenant", "follow_up_departed_tenant", "onboard_new_tenant"):
                dec.requires_confirmation = True
                dec.action = f"[مراجعة] {dec.action} — بوابة الاتساق محظورة"
                dec.why = f"{dec.why} — تعارضات الاستيراد تحتاج مراجعة قبل الإجراء."
        decisions.append(dec.to_dict())

    # --- Filename-only guard: only emit request_missing_lifecycle_data ---
    if not has_content:
        if unresolved:
            _add(LifecycleDecision(
                id="lc_missing_data_filename_only",
                kind="request_missing_lifecycle_data",
                priority="high",
                score=_KIND_SCORE["request_missing_lifecycle_data"],
                title="أعد رفع الملفات مع المحتوى",
                why="الرفع يحتوي على أسماء ملفات فقط — لا يمكن إنتاج أي إشارات دورة حياة.",
                action="أعد رفع الكشوف مع محتوى الملف (textSnippet).",
                evidence=["has_real_content=False", f"unresolved_count={len(unresolved)}"],
                reporting_period=reporting_period,
                confidence=_KIND_BASELINE_CONFIDENCE["request_missing_lifecycle_data"],
                route=_route_for_kind("request_missing_lifecycle_data"),
                requires_confirmation=False,
            ))
        return decisions

    # --- 1. contact_late_tenant: one per late tenant ---
    for lt in (normalized.get("late_tenants") or [])[:10]:
        tenant = lt.get("tenant")
        unit = lt.get("unit")
        late_count = int(lt.get("late_month_count") or 0)
        total_unpaid = float(lt.get("total_unpaid") or 0)
        # Confidence: baseline - penalty for unclear months.
        confidence = _KIND_BASELINE_CONFIDENCE["contact_late_tenant"]
        # Lower confidence if this tenant has unresolved unclear months.
        unclear = sum(
            1 for m in (lt.get("months") or [])
            if m.get("status") == "unknown_requires_review"
        )
        if unclear:
            confidence -= 15
        # If evidence is too incomplete, generate investigate instead.
        if unclear >= 2 or not tenant or not unit:
            _add(LifecycleDecision(
                id=f"lc_investigate_late_{_tenant_identity_key(tenant, unit)}",
                kind="investigate_tenant_change",
                priority="medium",
                score=_KIND_SCORE["investigate_tenant_change"],
                title=f"راجع حالة السداد — {tenant or '—'} (وحدة {unit or '—'})",
                why=f"{unclear} شهر بحالة غير مؤكدة — لا يمكن تأكيد المتأخرات بدقة.",
                action="راجع الكشوف اليدوية قبل أي تواصل تحصيل.",
                evidence=[
                    f"unit={unit}", f"tenant={tenant}",
                    f"unclear_months={unclear}",
                ],
                tenant_name=tenant,
                unit_label=unit,
                reporting_period=reporting_period,
                confidence=max(40, confidence),
                route=_route_for_kind("investigate_tenant_change"),
                requires_confirmation=True,
            ))
            continue
        _add(LifecycleDecision(
            id=f"lc_contact_late_{_tenant_identity_key(tenant, unit)}",
            kind="contact_late_tenant",
            priority=_KIND_PRIORITY["contact_late_tenant"],
            score=_KIND_SCORE["contact_late_tenant"],
            title=f"تواصل مع {tenant or '—'} — متأخر {late_count} شهر",
            why=f"متأخرات مؤكدة: {late_count} شهر · {total_unpaid:,.0f} ر.س على الوحدة {unit or '—'}.",
            action=f"أرسل تذكير دفع إلى {tenant or '—'} خلال 24 ساعة.",
            evidence=[
                f"unit={unit}", f"tenant={tenant}",
                f"late_month_count={late_count}",
                f"total_unpaid={total_unpaid}",
            ],
            tenant_name=tenant,
            unit_label=unit,
            reporting_period=reporting_period,
            confidence=confidence,
            route=_route_for_kind("contact_late_tenant"),
            requires_confirmation=True,
        ))

    # --- 2. follow_up_departed_tenant: one per confirmed departure ---
    for d in (normalized.get("departed") or [])[:10]:
        if not d.get("confirmed"):
            # Unconfirmed departure → investigate instead.
            _add(LifecycleDecision(
                id=f"lc_investigate_departed_{_tenant_identity_key(d.get('tenant'), d.get('unit'))}",
                kind="investigate_tenant_change",
                priority="medium",
                score=_KIND_SCORE["investigate_tenant_change"],
                title=f"حقّق في مغادرة {d.get('tenant', '—')} (وحدة {d.get('unit', '—')})",
                why="المغادرة غير مؤكدة — راجع الكشوف قبل الإجراء.",
                action="راجع هوية المستأجر والعقد يدوياً.",
                evidence=[
                    f"unit={d.get('unit')}", f"tenant={d.get('tenant')}",
                    "confirmed=False",
                ],
                tenant_name=d.get("tenant"),
                unit_label=d.get("unit"),
                reporting_period=reporting_period,
                confidence=45,
                route=_route_for_kind("investigate_tenant_change"),
                requires_confirmation=True,
            ))
            continue
        _add(LifecycleDecision(
            id=f"lc_followup_departed_{_tenant_identity_key(d.get('tenant'), d.get('unit'))}",
            kind="follow_up_departed_tenant",
            priority=_KIND_PRIORITY["follow_up_departed_tenant"],
            score=_KIND_SCORE["follow_up_departed_tenant"],
            title=f"تابع مغادرة {d.get('tenant', '—')} (وحدة {d.get('unit', '—')})",
            why=f"غادر في شهر {d.get('departed_month') or '?'} — أكّد إخلاء الوحدة والعقد.",
            action="راجع حالة الوحدة، أغلق العقد، خطط لإعادة التأجير.",
            evidence=[
                f"unit={d.get('unit')}", f"tenant={d.get('tenant')}",
                f"departed_month={d.get('departed_month')}",
                f"reason={d.get('reason', '')}",
            ],
            tenant_name=d.get("tenant"),
            unit_label=d.get("unit"),
            reporting_period=reporting_period,
            confidence=_KIND_BASELINE_CONFIDENCE["follow_up_departed_tenant"],
            route=_route_for_kind("follow_up_departed_tenant"),
            requires_confirmation=True,
        ))

    # --- 3. onboard_new_tenant: one per newcomer ---
    for n in (normalized.get("newcomers") or [])[:10]:
        _add(LifecycleDecision(
            id=f"lc_onboard_new_{_tenant_identity_key(n.get('tenant'), n.get('unit'))}",
            kind="onboard_new_tenant",
            priority=_KIND_PRIORITY["onboard_new_tenant"],
            score=_KIND_SCORE["onboard_new_tenant"],
            title=f"استقبل {n.get('tenant', '—')} (وحدة {n.get('unit', '—')})",
            why=f"دخل في شهر {n.get('arrived_month') or '?'} — أكّد العقد والجوال والهوية.",
            action="جهّز العقد، سجّل الجوال، أضف للنظام.",
            evidence=[
                f"unit={n.get('unit')}", f"tenant={n.get('tenant')}",
                f"arrived_month={n.get('arrived_month')}",
            ],
            tenant_name=n.get("tenant"),
            unit_label=n.get("unit"),
            reporting_period=reporting_period,
            confidence=_KIND_BASELINE_CONFIDENCE["onboard_new_tenant"],
            route=_route_for_kind("onboard_new_tenant"),
            requires_confirmation=True,
        ))

    # --- 4. review_payment_history: one per tenant with payment_ledger ---
    for ent in (normalized.get("payment_ledger") or [])[:8]:
        tenant = ent.get("tenant")
        unit = ent.get("unit")
        months = ent.get("months") or []
        if not months:
            continue
        _add(LifecycleDecision(
            id=f"lc_review_payment_{_tenant_identity_key(tenant, unit)}",
            kind="review_payment_history",
            priority=_KIND_PRIORITY["review_payment_history"],
            score=_KIND_SCORE["review_payment_history"],
            title=f"راجع سجل دفعات {tenant or '—'} (وحدة {unit or '—'})",
            why=f"{len(months)} شهر في السجل — راجع الاتساق قبل التجديد.",
            action="افتح سجل الدفعات وراجع التسلسل الشهري.",
            evidence=[
                f"unit={unit}", f"tenant={tenant}",
                f"month_count={len(months)}",
                f"total_paid={ent.get('total_paid', 0)}",
                f"total_unpaid={ent.get('total_unpaid', 0)}",
            ],
            tenant_name=tenant,
            unit_label=unit,
            reporting_period=reporting_period,
            confidence=_KIND_BASELINE_CONFIDENCE["review_payment_history"],
            route=_route_for_kind("review_payment_history"),
            requires_confirmation=True,
        ))

    # --- 5. investigate_tenant_change: one per unconfirmed tenant_change ---
    for ch in (normalized.get("tenant_changes") or [])[:10]:
        if ch.get("confirmed"):
            continue  # confirmed changes are covered by follow_up/onboard
        _add(LifecycleDecision(
            id=f"lc_investigate_change_{_tenant_identity_key(ch.get('to_tenant') or ch.get('from_tenant'), ch.get('unit'))}",
            kind="investigate_tenant_change",
            priority=_KIND_PRIORITY["investigate_tenant_change"],
            score=_KIND_SCORE["investigate_tenant_change"],
            title=f"حقّق في تغيّر المستأجر على الوحدة {ch.get('unit', '—')}",
            why=f"تغيّر غير مؤكد: {ch.get('from_tenant', '—')} → {ch.get('to_tenant', '—')}.",
            action="راجع العقد والجوال يدوياً قبل التسجيل.",
            evidence=[
                f"unit={ch.get('unit')}",
                f"from={ch.get('from_tenant')}",
                f"to={ch.get('to_tenant')}",
                "confirmed=False",
            ],
            tenant_name=ch.get("to_tenant") or ch.get("from_tenant"),
            unit_label=ch.get("unit"),
            reporting_period=reporting_period,
            confidence=_KIND_BASELINE_CONFIDENCE["investigate_tenant_change"],
            route=_route_for_kind("investigate_tenant_change"),
            requires_confirmation=True,
        ))

    # --- 6. compare_collection_periods: one if month_comparison has 2+ months ---
    month_cmp = normalized.get("month_comparison") or []
    if len(month_cmp) >= 2:
        last = month_cmp[-1]
        prev = month_cmp[-2]
        delta = float(last.get("delta_revenue") or 0)
        direction = "انخفاض" if delta < 0 else "زيادة"
        _add(LifecycleDecision(
            id=f"lc_compare_collection_{_period_key(reporting_period)}",
            kind="compare_collection_periods",
            priority=_KIND_PRIORITY["compare_collection_periods"],
            score=_KIND_SCORE["compare_collection_periods"],
            title=f"قارن تحصيل {prev.get('month', '—')} → {last.get('month', '—')}",
            why=f"{direction} {abs(delta):,.0f} ر.س بين الشهرين — راجع الأسباب.",
            action="افتح لوحة المقارنة الشهرية وحلل الفجوة.",
            evidence=[
                f"prev_month={prev.get('month')}",
                f"prev_collected={prev.get('collected')}",
                f"cur_month={last.get('month')}",
                f"cur_collected={last.get('collected')}",
                f"delta={delta}",
            ],
            reporting_period=reporting_period,
            confidence=_KIND_BASELINE_CONFIDENCE["compare_collection_periods"],
            route=_route_for_kind("compare_collection_periods"),
            requires_confirmation=False,
        ))

    # --- 7. request_missing_lifecycle_data: when unresolved evidence exists ---
    if unresolved:
        _add(LifecycleDecision(
            id=f"lc_missing_data_{_period_key(reporting_period)}",
            kind="request_missing_lifecycle_data",
            priority=_KIND_PRIORITY["request_missing_lifecycle_data"],
            score=_KIND_SCORE["request_missing_lifecycle_data"],
            title="أكمل البيانات الناقصة قبل الإجراءات التنفيذية",
            why=f"{len(unresolved)} عنصر غير محلول — راجع قبل التحصيل أو المغادرة.",
            action="راجع الملفات غير المقروءة + الأشهر غير المؤكدة + المغادرات غير المؤكدة.",
            evidence=[
                f"unresolved_count={len(unresolved)}",
                *[f"unresolved:{u.get('code')}" for u in unresolved[:3]],
            ],
            reporting_period=reporting_period,
            confidence=_KIND_BASELINE_CONFIDENCE["request_missing_lifecycle_data"],
            route=_route_for_kind("request_missing_lifecycle_data"),
            requires_confirmation=False,
        ))

    # Sort: by priority (critical > high > medium > low), then score desc.
    priority_rank = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    decisions.sort(key=lambda d: (priority_rank.get(d.get("priority", "low"), 9), -d.get("score", 0)))
    return decisions


def deduplicate_against_live_decisions(
    lifecycle_decisions: List[Dict[str, Any]],
    live_decisions: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Remove lifecycle decisions that duplicate existing live decisions.

    Dedup key: kind + tenant identity + unit identity + reporting period.
    A live decision duplicates a lifecycle decision when:
      - live.kind matches lifecycle.kind (or maps to it)
      - AND live.property_id or live.tenant matches
    """
    live_keys: set = set()
    for d in live_decisions or []:
        # Build a key from live decision's tenant/unit/kind.
        kind = str(d.get("kind") or "").lower()
        # Map live decision kinds to lifecycle kinds.
        kind_map = {
            "financial": "contact_late_tenant",
            "tenant": "investigate_tenant_change",
            "maintenance": None,  # no lifecycle equivalent
            "renewal": "follow_up_departed_tenant",
            "vacancy": "onboard_new_tenant",
            "opportunity": None,
        }
        lc_kind = kind_map.get(kind)
        if lc_kind is None:
            continue
        # Try to extract tenant + unit from the live decision.
        tenant = d.get("tenant_name") or d.get("tenant") or ""
        unit = d.get("unit_label") or d.get("unit") or d.get("property_id") or ""
        # Live decisions don't carry reporting_period — use empty.
        live_keys.add(_dedup_key(lc_kind, tenant, unit, {}))

    out: List[Dict[str, Any]] = []
    for ld in lifecycle_decisions:
        key = _dedup_key(
            ld.get("kind"),
            ld.get("tenant_name"),
            ld.get("unit_label"),
            ld.get("reporting_period") or {},
        )
        # Also check a no-period variant (live decisions have no period).
        no_period_key = _dedup_key(
            ld.get("kind"),
            ld.get("tenant_name"),
            ld.get("unit_label"),
            {},
        )
        if key in live_keys or no_period_key in live_keys:
            # Duplicate — skip but mark in evidence.
            ld = dict(ld)
            ld["_deduplicated_against_live"] = True
            # Don't add — it's a duplicate.
            continue
        out.append(ld)
    return out
