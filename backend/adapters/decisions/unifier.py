"""Decision Unifier — Gap 4.

Normalizes all four decision sources into ONE authoritative shape,
deduplicates by stable key, merges duplicates (preserving evidence),
applies a deterministic score, and runs the consistency gate.

This module does NOT call any LLM. Scores are computed from
priority + urgency + confidence + financial impact + lifecycle severity
+ contract risk + maintenance risk + data-quality penalty
+ consistency-gate penalty.

Public entry point: unify_decisions(...)
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

# ===========================================================================
# Constants
# ===========================================================================

# The 4 allowed source names. No other source is permitted in the unified list.
UNIFIED_DECISION_SOURCES = ("koil", "lifecycle", "live", "executive_intelligence")

PRIORITY_RANK = {"critical": 0, "high": 1, "medium": 2, "low": 3}
PRIORITY_SCORE = {"critical": 100, "high": 75, "medium": 50, "low": 25}

# Map lifecycle decision kinds → unified kinds.
# Some lifecycle kinds map to themselves; others collapse to a generic kind.
LIFECYCLE_TO_UNIFIED_KIND_MAP = {
    "follow_up_departed_tenant": "follow_up_departed_tenant",
    "onboard_new_tenant": "onboard_new_tenant",
    "contact_late_tenant": "contact_late_tenant",
    "review_payment_history": "review_payment_history",
    "investigate_tenant_change": "investigate_tenant_change",
    "compare_collection_periods": "compare_collection_periods",
    "request_missing_lifecycle_data": "request_missing_lifecycle_data",
}

# Map live decision kinds → unified kinds.
LIVE_TO_UNIFIED_KIND_MAP = {
    "financial": "contact_late_tenant",  # late rent → contact late tenant
    "tenant": "investigate_tenant_change",
    "maintenance": "maintenance",
    "renewal": "follow_up_departed_tenant",
    "vacancy": "onboard_new_tenant",
    "opportunity": "opportunity",
}

# Urgency baseline per unified kind (0-100).
KIND_URGENCY = {
    "contact_late_tenant": 85,
    "follow_up_departed_tenant": 60,
    "onboard_new_tenant": 55,
    "review_payment_history": 50,
    "investigate_tenant_change": 50,
    "compare_collection_periods": 40,
    "request_missing_lifecycle_data": 75,
    "maintenance": 70,
    "renewal": 80,
    "vacancy": 55,
    "opportunity": 45,
    "tenant": 50,
    "financial": 70,
}

# Lifecycle severity per kind (0-100).
KIND_LIFECYCLE_SEVERITY = {
    "contact_late_tenant": 80,
    "follow_up_departed_tenant": 70,
    "onboard_new_tenant": 40,
    "review_payment_history": 40,
    "investigate_tenant_change": 50,
    "compare_collection_periods": 30,
    "request_missing_lifecycle_data": 60,
    "maintenance": 50,
    "renewal": 70,
    "vacancy": 60,
    "opportunity": 30,
    "tenant": 40,
    "financial": 70,
}


def derive_tier(score: float, priority: str = "medium") -> str:
    """Map score + priority → tier (now | today | week | follow_up)."""
    if score >= 75 or priority == "critical":
        return "now"
    if score >= 55 or priority == "high":
        return "today"
    if score >= 35:
        return "week"
    return "follow_up"


def _safe_str(v: Any) -> str:
    return str(v or "").strip().lower()


def _safe_float(v: Any, default: float = 0.0) -> float:
    try:
        return float(v) if v is not None else default
    except (TypeError, ValueError):
        return default


def _safe_int(v: Any, default: int = 0) -> int:
    try:
        return int(float(v)) if v is not None else default
    except (TypeError, ValueError):
        return default


# ===========================================================================
# UnifiedDecision dataclass
# ===========================================================================

@dataclass
class UnifiedDecision:
    """One authoritative smart decision.

    All four decision sources normalize to this shape. Duplicates merge
    into a single UnifiedDecision with combined evidence + provenance.
    """

    id: str
    source: str = ""  # one of UNIFIED_DECISION_SOURCES (or "merged" after merge)
    kind: str = ""
    priority: str = "medium"
    score: float = 0.0
    tier: str = "follow_up"
    title: str = ""
    why: str = ""
    action: str = ""
    evidence: List[str] = field(default_factory=list)
    affected_entities: List[str] = field(default_factory=list)
    tenant_id: Optional[str] = None
    tenant_name: Optional[str] = None
    unit_id: Optional[str] = None
    unit_label: Optional[str] = None
    property_id: Optional[str] = None
    reporting_period: Optional[Dict[str, Any]] = None
    financial_impact: float = 0.0
    confidence: int = 70
    route: str = "/tenants"
    requires_confirmation: bool = True
    status: str = "proposed"
    dedupe_key: str = ""
    blocked_by_gate: bool = False
    created_from_analysis_id: Optional[str] = None
    # Provenance — populated during merge.
    provenance: Dict[str, Any] = field(default_factory=lambda: {
        "sources": [],
        "source_decision_ids": [],
        "analysis_id": None,
        "evidence_count": 0,
    })

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
            "affected_entities": list(self.affected_entities),
            "tenant_id": self.tenant_id,
            "tenant_name": self.tenant_name,
            "unit_id": self.unit_id,
            "unit_label": self.unit_label,
            "property_id": self.property_id,
            "reporting_period": dict(self.reporting_period) if self.reporting_period else None,
            "financial_impact": self.financial_impact,
            "confidence": self.confidence,
            "route": self.route,
            "requires_confirmation": self.requires_confirmation,
            "status": self.status,
            "dedupe_key": self.dedupe_key,
            "blocked_by_gate": self.blocked_by_gate,
            "created_from_analysis_id": self.created_from_analysis_id,
            "provenance": dict(self.provenance),
        }


# ===========================================================================
# Per-source normalizers
# ===========================================================================

def normalize_koil_decision(
    koil_decision: Dict[str, Any],
    analysis_id: Optional[str] = None,
    reasoning: Optional[Dict[str, Any]] = None,
    property_knowledge: Optional[Dict[str, Any]] = None,
) -> UnifiedDecision:
    """Normalize a Koïl smart_decision into the unified shape.

    Koïl decisions are minimal: {id, priority, title, action}. We derive
    kind from the title/action text (best-effort) and confidence from
    the parent reasoning object.

    When property_knowledge is provided, we try to match tenant names
    mentioned in the title/action against the PK tenant cards, so Koïl
    decisions can merge with lifecycle decisions for the same tenant.
    """
    kd = koil_decision or {}
    title = str(kd.get("title") or "")
    action = str(kd.get("action") or "")
    combined_text = title + " " + action
    # Best-effort kind inference from title/action text.
    kind = _infer_kind_from_text(combined_text)
    priority = str(kd.get("priority") or "medium").lower()
    if priority not in PRIORITY_RANK:
        priority = "medium"
    confidence = 75
    if reasoning and isinstance(reasoning, dict):
        confidence = _safe_int(reasoning.get("confidence"), 75)
    # Try to extract tenant + unit from the text.
    tenant_name, unit_label = _extract_tenant_unit_from_text(combined_text)
    # If we have property_knowledge, try to match tenant names mentioned
    # in the title/action against the PK tenant cards.
    if property_knowledge and isinstance(property_knowledge, dict):
        cards = property_knowledge.get("tenants") or []
        for card in cards:
            card_tenant = str(card.get("tenant") or "")
            if card_tenant and card_tenant in combined_text:
                tenant_name = card_tenant
                unit_label = unit_label or str(card.get("unit") or "")
                break
    ud = UnifiedDecision(
        id=str(kd.get("id") or f"koil_{title[:20]}"),
        source="koil",
        kind=kind,
        priority=priority,
        title=title,
        why=str(kd.get("reason") or kd.get("why") or ""),
        action=action,
        evidence=[],
        tenant_name=tenant_name,
        unit_label=unit_label,
        confidence=confidence,
        route=_route_for_kind(kind),
        requires_confirmation=True,
        created_from_analysis_id=analysis_id,
    )
    ud.score = compute_score(ud, confidence_override=confidence)
    ud.tier = derive_tier(ud.score, ud.priority)
    ud.dedupe_key = compute_dedupe_key(ud)
    ud.affected_entities = _build_affected_entities(ud)
    ud.provenance = {
        "sources": ["koil"],
        "source_decision_ids": [ud.id],
        "analysis_id": analysis_id,
        "evidence_count": len(ud.evidence),
    }
    return ud


def normalize_lifecycle_decision(
    lifecycle_decision: Dict[str, Any],
    analysis_id: Optional[str] = None,
) -> UnifiedDecision:
    """Normalize a lifecycle decision into the unified shape.

    Lifecycle decisions already have most unified fields; we just remap
    the kind and ensure all fields are present.
    """
    ld = lifecycle_decision or {}
    raw_kind = str(ld.get("kind") or "")
    kind = LIFECYCLE_TO_UNIFIED_KIND_MAP.get(raw_kind, raw_kind or "tenant")
    priority = str(ld.get("priority") or "medium").lower()
    if priority not in PRIORITY_RANK:
        priority = "medium"
    confidence = _safe_int(ld.get("confidence"), 70)
    score = _safe_float(ld.get("score"), 0.0)
    tier = str(ld.get("tier") or "follow_up")
    reporting_period = ld.get("reporting_period")
    if reporting_period is not None and not isinstance(reporting_period, dict):
        reporting_period = None
    ud = UnifiedDecision(
        id=str(ld.get("id") or f"lc_{kind}_{ld.get('tenant_name')}_{ld.get('unit_label')}"),
        source="lifecycle",
        kind=kind,
        priority=priority,
        score=score,
        tier=tier,
        title=str(ld.get("title") or ""),
        why=str(ld.get("why") or ""),
        action=str(ld.get("action") or ""),
        evidence=list(ld.get("evidence") or []),
        tenant_id=ld.get("tenant_id"),
        tenant_name=ld.get("tenant_name"),
        unit_id=ld.get("unit_id"),
        unit_label=ld.get("unit_label"),
        property_id=ld.get("property_id"),
        reporting_period=reporting_period,
        confidence=confidence,
        route=str(ld.get("route") or _route_for_kind(kind)),
        requires_confirmation=bool(ld.get("requires_confirmation", True)),
        status=str(ld.get("status") or "proposed"),
        created_from_analysis_id=analysis_id,
    )
    # Recompute score deterministically (don't trust the source's score).
    ud.score = compute_score(ud, confidence_override=confidence)
    ud.tier = derive_tier(ud.score, ud.priority)
    ud.dedupe_key = compute_dedupe_key(ud)
    # Build affected_entities list.
    ud.affected_entities = _build_affected_entities(ud)
    ud.provenance = {
        "sources": ["lifecycle"],
        "source_decision_ids": [ud.id],
        "analysis_id": analysis_id,
        "evidence_count": len(ud.evidence),
    }
    return ud


def normalize_live_decision(
    live_decision: Dict[str, Any],
    analysis_id: Optional[str] = None,
) -> UnifiedDecision:
    """Normalize a live operational decision into the unified shape.

    Live decisions come from map_decisions_from_app_data and have:
    {id, priority, kind, title, reason, impact, recommended_action,
     confidence, property_id, created_at}
    """
    ld = live_decision or {}
    raw_kind = str(ld.get("kind") or "").lower()
    kind = LIVE_TO_UNIFIED_KIND_MAP.get(raw_kind, raw_kind or "tenant")
    priority = str(ld.get("priority") or "medium").lower()
    if priority not in PRIORITY_RANK:
        priority = "medium"
    confidence = _safe_int(ld.get("confidence"), 70)
    # Live decisions carry property_id but not tenant/unit — try to derive.
    property_id = ld.get("property_id")
    # Title may contain "unit X — tenant Y" pattern.
    title = str(ld.get("title") or "")
    reason = str(ld.get("reason") or "")
    tenant_name, unit_label = _extract_tenant_unit_from_text(title + " " + reason)
    ud = UnifiedDecision(
        id=str(ld.get("id") or f"live_{kind}_{property_id or 'unknown'}"),
        source="live",
        kind=kind,
        priority=priority,
        title=title,
        why=reason,
        action=str(ld.get("recommended_action") or ld.get("action") or ""),
        evidence=[
            f"impact={ld.get('impact', '')}",
            f"created_at={ld.get('created_at', '')}",
        ],
        tenant_name=tenant_name,
        unit_label=unit_label,
        property_id=property_id,
        confidence=confidence,
        route=_route_for_kind(kind),
        requires_confirmation=True,
        created_from_analysis_id=analysis_id,
    )
    ud.score = compute_score(ud, confidence_override=confidence)
    ud.tier = derive_tier(ud.score, ud.priority)
    ud.dedupe_key = compute_dedupe_key(ud)
    ud.affected_entities = _build_affected_entities(ud)
    ud.provenance = {
        "sources": ["live"],
        "source_decision_ids": [ud.id],
        "analysis_id": analysis_id,
        "evidence_count": len(ud.evidence),
    }
    return ud


def normalize_executive_decision(
    ranked_item: Dict[str, Any],
    analysis_id: Optional[str] = None,
) -> UnifiedDecision:
    """Normalize an executive ranked_item into the unified shape.

    Executive ranked items come from build_ranked_items and have:
    {id, source, kind, priority, score, tier, title, why, action,
     impact_aed, property_id, route}
    """
    ri = ranked_item or {}
    kind = str(ri.get("kind") or "tenant")
    priority = str(ri.get("priority") or "medium").lower()
    if priority not in PRIORITY_RANK:
        priority = "medium"
    confidence = 70  # executive ranked items don't carry confidence
    financial_impact = _safe_float(ri.get("impact_aed"), 0.0)
    ud = UnifiedDecision(
        id=str(ri.get("id") or f"exec_{kind}_{ri.get('property_id') or 'unknown'}"),
        source="executive_intelligence",
        kind=kind,
        priority=priority,
        score=_safe_float(ri.get("score"), 0.0),
        tier=str(ri.get("tier") or "follow_up"),
        title=str(ri.get("title") or ""),
        why=str(ri.get("why") or ""),
        action=str(ri.get("action") or ""),
        evidence=[
            f"impact_aed={financial_impact}",
            f"source={ri.get('source', 'executive')}",
        ],
        property_id=ri.get("property_id"),
        financial_impact=financial_impact,
        confidence=confidence,
        route=str(ri.get("route") or _route_for_kind(kind)),
        requires_confirmation=True,
        created_from_analysis_id=analysis_id,
    )
    # Recompute score deterministically.
    ud.score = compute_score(ud, confidence_override=confidence)
    ud.tier = derive_tier(ud.score, ud.priority)
    ud.dedupe_key = compute_dedupe_key(ud)
    ud.affected_entities = _build_affected_entities(ud)
    ud.provenance = {
        "sources": ["executive_intelligence"],
        "source_decision_ids": [ud.id],
        "analysis_id": analysis_id,
        "evidence_count": len(ud.evidence),
    }
    return ud


# ===========================================================================
# Dedupe key + merge
# ===========================================================================

def compute_dedupe_key(decision: UnifiedDecision) -> str:
    """Stable dedupe key: kind|tenant|unit|property|period|action_target.

    The same operational event must produce the same dedupe_key so it
    merges into one decision.
    """
    tenant = _safe_str(decision.tenant_name) if decision.tenant_name else _safe_str(decision.tenant_id)
    unit = _safe_str(decision.unit_label) if decision.unit_label else _safe_str(decision.unit_id)
    prop = _safe_str(decision.property_id)
    # Reporting period: use from_year-from_month_to_to_year-to_month.
    rp = decision.reporting_period or {}
    if isinstance(rp, dict) and rp:
        period = f"{rp.get('from_year')}-{rp.get('from_month')}_to_{rp.get('to_year')}-{rp.get('to_month')}"
    else:
        period = ""
    # Action target: first significant word of the action (the verb).
    # This is more lenient than the full action text - "أرسل تذكير" and
    # "أرسل تذكير اليوم" both produce "أرسل".
    action_text = _safe_str(decision.action)
    action_target = ""
    if action_text:
        words = action_text.split()
        if words:
            action_target = words[0][:20]
    return f"{decision.kind}|{tenant}|{unit}|{prop}|{period}|{action_target}"


def _highest_priority(a: str, b: str) -> str:
    """Return the higher priority (lower rank number = higher)."""
    ra = PRIORITY_RANK.get(a, 9)
    rb = PRIORITY_RANK.get(b, 9)
    return a if ra <= rb else b


def merge_duplicates(decisions: List[UnifiedDecision]) -> List[UnifiedDecision]:
    """Merge decisions that share the same dedupe_key.

    Merge rules:
      - preserve all source names
      - preserve all evidence
      - use the highest valid confidence
      - use the highest priority
      - use the highest score
      - preserve the safest requires_confirmation value (True if any)
      - never merge two different tenants or units (enforced by dedupe_key)

    Returns a new list with duplicates merged. Each merged decision has
    a provenance block listing all source decision ids.
    """
    by_key: Dict[str, UnifiedDecision] = {}
    order: List[str] = []

    def _period_less_key(key: str) -> str:
        """Strip the reporting_period AND action_target components from a dedupe_key.

        Used for fuzzy matching when one source carries a period or different
        action wording and another doesn't — they should still merge if
        kind+tenant+unit+property all match. The action_target is the weakest
        signal (different sources phrase the same action differently).
        """
        parts = key.split("|")
        if len(parts) >= 6:
            parts[4] = ""  # zero out the period component
            parts[5] = ""  # zero out the action_target component
            return "|".join(parts)
        return key

    for ud in decisions:
        key = ud.dedupe_key
        if not key:
            # No dedupe key — keep as-is, never merge.
            ud.id = ud.id or f"unified_{len(order)}"
            order.append(ud.id)
            by_key[ud.id] = ud
            continue
        # Try exact match first.
        if key in by_key:
            existing = by_key[key]
        else:
            # Try fuzzy match (period-stripped) — allows a Koïl decision
            # with no reporting_period to merge with a lifecycle decision
            # that has one, as long as kind+tenant+unit+property+action match.
            fuzzy_key = _period_less_key(key)
            existing = None
            for existing_key, existing_ud in by_key.items():
                if _period_less_key(existing_key) == fuzzy_key:
                    existing = existing_ud
                    break
        if existing is None:
            by_key[key] = ud
            order.append(key)
            continue
        # Merge into existing.
        # NEVER merge different tenants or units (defensive — dedupe_key
        # already encodes tenant+unit, but double-check).
        if (
            (existing.tenant_name and ud.tenant_name
             and _safe_str(existing.tenant_name) != _safe_str(ud.tenant_name))
            or (existing.unit_label and ud.unit_label
                and _safe_str(existing.unit_label) != _safe_str(ud.unit_label))
        ):
            # Different tenant/unit — don't merge. Keep as separate decision
            # with a unique id.
            ud.id = f"{ud.id}_dup{len(order)}"
            ud.dedupe_key = f"{key}#dup{len(order)}"
            by_key[ud.id] = ud
            order.append(ud.id)
            continue
        # Merge: combine evidence, take highest priority/score/confidence.
        existing.evidence = list(existing.evidence) + list(ud.evidence)
        existing.affected_entities = list(set(existing.affected_entities + ud.affected_entities))
        existing.priority = _highest_priority(existing.priority, ud.priority)
        existing.score = max(existing.score, ud.score)
        existing.confidence = max(existing.confidence, ud.confidence)
        existing.requires_confirmation = existing.requires_confirmation or ud.requires_confirmation
        existing.financial_impact = max(existing.financial_impact, ud.financial_impact)
        # Entity refs: ALWAYS prefer lifecycle source's refs (richest).
        # Lifecycle sources carry tenant_name, unit_label, reporting_period
        # that other sources (executive, koil, live) often lack.
        ud_sources = ud.provenance.get("sources", [])
        ud_is_lifecycle = "lifecycle" in ud_sources
        existing_is_lifecycle = "lifecycle" in existing.provenance.get("sources", [])
        if ud_is_lifecycle and not existing_is_lifecycle:
            # Lifecycle source always wins for entity refs.
            if ud.tenant_name:
                existing.tenant_name = ud.tenant_name
                existing.tenant_id = ud.tenant_id
            if ud.unit_label:
                existing.unit_label = ud.unit_label
                existing.unit_id = ud.unit_id
            if ud.reporting_period:
                existing.reporting_period = ud.reporting_period
        else:
            # Fill in missing entity refs from the new decision.
            if not existing.tenant_name and ud.tenant_name:
                existing.tenant_name = ud.tenant_name
                existing.tenant_id = ud.tenant_id
            if not existing.unit_label and ud.unit_label:
                existing.unit_label = ud.unit_label
                existing.unit_id = ud.unit_id
            if not existing.reporting_period and ud.reporting_period:
                existing.reporting_period = ud.reporting_period
        if not existing.property_id and ud.property_id:
            existing.property_id = ud.property_id
        # Take the longer title/why/action (more informative).
        if len(ud.title) > len(existing.title):
            existing.title = ud.title
        if len(ud.why) > len(existing.why):
            existing.why = ud.why
        if len(ud.action) > len(existing.action):
            existing.action = ud.action
        # Provenance: merge sources + source_decision_ids.
        existing.provenance["sources"] = list(set(existing.provenance["sources"] + ud.provenance.get("sources", [])))
        existing.provenance["source_decision_ids"] = list(set(
            existing.provenance["source_decision_ids"] + ud.provenance.get("source_decision_ids", [])
        ))
        existing.provenance["evidence_count"] = len(existing.evidence)
        # Recompute tier from the new highest score.
        existing.tier = derive_tier(existing.score, existing.priority)
        # Mark as merged if multiple sources.
        if len(existing.provenance["sources"]) > 1:
            existing.source = "merged"

    return [by_key[k] for k in order]


# ===========================================================================
# Deterministic score calculation
# ===========================================================================

def compute_score(
    decision: UnifiedDecision,
    confidence_override: Optional[int] = None,
    unresolved_count: int = 0,
    gate_blocked: bool = False,
) -> float:
    """Deterministic score calculation — no LLM.

    score = (
        priority_score * 0.30 +
        urgency_score * 0.20 +
        confidence * 0.15 +
        financial_score * 0.15 +
        lifecycle_severity * 0.10 +
        contract_risk * 0.05 +
        maintenance_risk * 0.05
    )
    - data_quality_penalty: -10 if unresolved_count > 0
    - consistency_gate_penalty: -25 if gate_blocked
    Capped at [0, 100].
    """
    priority_score = PRIORITY_SCORE.get(decision.priority, 50)
    urgency = KIND_URGENCY.get(decision.kind, 50)
    confidence = confidence_override if confidence_override is not None else decision.confidence
    # Financial score: scale financial_impact to 0-100 (cap at 100).
    # Use 10000 as the scale (so 10000 SAR impact = 100 points).
    financial_score = min(100.0, decision.financial_impact / 100.0) if decision.financial_impact > 0 else 0.0
    lifecycle_severity = KIND_LIFECYCLE_SEVERITY.get(decision.kind, 30)
    # Contract risk: infer from kind.
    contract_risk = 30
    if decision.kind in ("follow_up_departed_tenant", "renewal"):
        contract_risk = 80
    elif decision.kind == "contact_late_tenant":
        contract_risk = 60
    # Maintenance risk: infer from kind.
    maintenance_risk = 20
    if decision.kind == "maintenance":
        maintenance_risk = 80
    elif decision.kind in ("investigate_tenant_change", "review_payment_history"):
        maintenance_risk = 40

    score = (
        priority_score * 0.30
        + urgency * 0.20
        + confidence * 0.15
        + financial_score * 0.15
        + lifecycle_severity * 0.10
        + contract_risk * 0.05
        + maintenance_risk * 0.05
    )
    # Penalties.
    if unresolved_count > 0:
        score -= 10
    if gate_blocked:
        score -= 25
    return round(max(0.0, min(100.0, score)), 1)


# ===========================================================================
# Consistency gate application
# ===========================================================================

def apply_consistency_gate_to_unified(
    decisions: List[UnifiedDecision],
    gate: Optional[Dict[str, Any]],
) -> List[UnifiedDecision]:
    """Apply the consistency gate to the unified decision list.

    If gate.status == 'blocked_for_review':
      - blocked_by_gate = true
      - cap confidence at 50
      - downgrade priority (critical→medium, high→low)
      - force requires_confirmation = true
      - replace unsafe operational action with review wording
      - do not send reminders, update wallet, or assign maintenance automatically
    """
    if not gate or gate.get("decision_status") != "blocked_for_review":
        return decisions

    for ud in decisions:
        ud.blocked_by_gate = True
        # Cap confidence at 50.
        ud.confidence = min(ud.confidence, 50)
        # Downgrade priority.
        if ud.priority == "critical":
            ud.priority = "medium"
        elif ud.priority == "high":
            ud.priority = "low"
        # Force requires_confirmation.
        ud.requires_confirmation = True
        # Replace unsafe operational action with review wording for
        # high-confidence action kinds (contact_late, follow_up_departed,
        # onboard_new, maintenance).
        if ud.kind in ("contact_late_tenant", "follow_up_departed_tenant", "onboard_new_tenant", "maintenance"):
            ud.action = f"[مراجعة] {ud.action} — بوابة الاتساق محظورة"
            ud.why = f"{ud.why} — تعارضات الاستيراد تحتاج مراجعة قبل الإجراء."
        # Recompute score with gate penalty.
        ud.score = compute_score(ud, gate_blocked=True)
        ud.tier = derive_tier(ud.score, ud.priority)
    return decisions


# ===========================================================================
# Helpers
# ===========================================================================

def _route_for_kind(kind: str) -> str:
    return {
        "contact_late_tenant": "/tenants",
        "follow_up_departed_tenant": "/tenants",
        "onboard_new_tenant": "/tenants",
        "review_payment_history": "/tenants",
        "investigate_tenant_change": "/tenants",
        "compare_collection_periods": "/insights",
        "request_missing_lifecycle_data": "/upload",
        "maintenance": "/maintenance",
        "renewal": "/contracts",
        "vacancy": "/portfolio",
        "opportunity": "/insights",
        "tenant": "/tenants",
        "financial": "/",
    }.get(kind, "/tenants")


def _infer_kind_from_text(text: str) -> str:
    """Best-effort kind inference from title/action text (for Koïl decisions)."""
    t = (text or "").lower()
    if any(w in t for w in ("متأخر", "late", "تحصيل", "collection")):
        return "contact_late_tenant"
    if any(w in t for w in ("غادر", "departed", "depart")):
        return "follow_up_departed_tenant"
    if any(w in t for w in ("دخل", "newcomer", "new tenant", "استقبل")):
        return "onboard_new_tenant"
    if any(w in t for w in ("صيانة", "maintenance", "repair", "hvac")):
        return "maintenance"
    if any(w in t for w in ("تجديد", "renewal", "renew")):
        return "renewal"
    if any(w in t for w in ("شاغر", "vacant", "vacancy")):
        return "vacancy"
    if any(w in t for w in ("فرصة", "opportunity", "uplift")):
        return "opportunity"
    return "tenant"


def _extract_tenant_unit_from_text(text: str) -> Tuple[Optional[str], Optional[str]]:
    """Extract tenant name + unit label from a text like 'unit 101 — tenant A'."""
    import re
    # Pattern: "unit X — tenant Y" or "وحدة X — Y"
    m = re.search(r"(?:unit|وحدة)\s+([A-Za-z0-9\-]+)\s*[—\-–]\s*([^\s,]+)", text or "", re.IGNORECASE)
    if m:
        return m.group(2), m.group(1)
    # Pattern: just "unit X"
    m = re.search(r"(?:unit|وحدة)\s+([A-Za-z0-9\-]+)", text or "", re.IGNORECASE)
    if m:
        return None, m.group(1)
    return None, None


def _build_affected_entities(ud: UnifiedDecision) -> List[str]:
    """Build a list of affected entity references for the decision."""
    out: List[str] = []
    if ud.tenant_id:
        out.append(f"tenant:{ud.tenant_id}")
    elif ud.tenant_name:
        out.append(f"tenant:{ud.tenant_name}")
    if ud.unit_id:
        out.append(f"unit:{ud.unit_id}")
    elif ud.unit_label:
        out.append(f"unit:{ud.unit_label}")
    if ud.property_id:
        out.append(f"property:{ud.property_id}")
    return out


# ===========================================================================
# Main entry point
# ===========================================================================

def unify_decisions(
    *,
    koil_smart_decisions: Optional[List[Dict[str, Any]]] = None,
    koil_reasoning: Optional[Dict[str, Any]] = None,
    lifecycle_decisions: Optional[List[Dict[str, Any]]] = None,
    live_decisions: Optional[List[Dict[str, Any]]] = None,
    executive_ranked_items: Optional[List[Dict[str, Any]]] = None,
    consistency_gate: Optional[Dict[str, Any]] = None,
    analysis_id: Optional[str] = None,
    unresolved_count: int = 0,
    property_knowledge: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    """Unify all four decision sources into ONE authoritative list.

    Pipeline:
      1. Normalize each source into UnifiedDecision.
      2. Compute dedupe_key for each.
      3. Merge duplicates (preserve evidence, take highest priority/score/confidence).
      4. Apply consistency gate (cap confidence, downgrade priority, review wording).
      5. Sort by priority (critical first) then score (desc).

    Returns a list of unified decision dicts (ready to persist in ai_state).
    """
    normalized: List[UnifiedDecision] = []

    # 1. Koïl recommendations
    for kd in (koil_smart_decisions or []):
        try:
            normalized.append(normalize_koil_decision(
                kd, analysis_id=analysis_id, reasoning=koil_reasoning,
                property_knowledge=property_knowledge,
            ))
        except Exception:
            continue

    # 2. Lifecycle decisions
    for ld in (lifecycle_decisions or []):
        try:
            normalized.append(normalize_lifecycle_decision(ld, analysis_id=analysis_id))
        except Exception:
            continue

    # 3. Live operational decisions
    for ld in (live_decisions or []):
        try:
            normalized.append(normalize_live_decision(ld, analysis_id=analysis_id))
        except Exception:
            continue

    # 4. Executive ranked items
    for ri in (executive_ranked_items or []):
        try:
            normalized.append(normalize_executive_decision(ri, analysis_id=analysis_id))
        except Exception:
            continue

    # Merge duplicates.
    merged = merge_duplicates(normalized)

    # Recompute scores with data-quality penalty if unresolved.
    if unresolved_count > 0:
        for ud in merged:
            ud.score = compute_score(ud, unresolved_count=unresolved_count)
            ud.tier = derive_tier(ud.score, ud.priority)

    # Apply consistency gate.
    merged = apply_consistency_gate_to_unified(merged, consistency_gate)

    # Sort: by priority (critical first), then score desc, then title.
    merged.sort(key=lambda ud: (PRIORITY_RANK.get(ud.priority, 9), -ud.score, ud.title))

    return [ud.to_dict() for ud in merged]
