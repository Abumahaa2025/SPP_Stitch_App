"""Unified Smart Decisions — Gap 4.

One authoritative decision pipeline that unifies all four decision sources:
  1. Koïl recommendations (reasoning_to_smart_decisions)
  2. Lifecycle decisions (generate_lifecycle_decisions)
  3. Live operational decisions (map_decisions_from_app_data)
  4. Executive ranked items (build_ranked_items)

Pipeline:
  Property Knowledge → Koïl Reasoning → Lifecycle → Executive Intelligence
  → Decision Unifier → Consistency Gate → Persisted Smart Decisions
  → Live SPP APIs

Public API:
    unify_decisions(...)            -> List[UnifiedDecision dict]
    LIFECYCLE_TO_UNIFIED_KIND_MAP   -> kind mapping table
    UNIFIED_DECISION_SOURCES        -> the 4 allowed source names
"""

from __future__ import annotations

from .unifier import (
    LIFECYCLE_TO_UNIFIED_KIND_MAP,
    LIVE_TO_UNIFIED_KIND_MAP,
    PRIORITY_RANK,
    PRIORITY_SCORE,
    UNIFIED_DECISION_SOURCES,
    UnifiedDecision,
    apply_consistency_gate_to_unified,
    compute_dedupe_key,
    compute_score,
    derive_tier,
    merge_duplicates,
    normalize_executive_decision,
    normalize_koil_decision,
    normalize_lifecycle_decision,
    normalize_live_decision,
    unify_decisions,
)

__all__ = [
    "LIFECYCLE_TO_UNIFIED_KIND_MAP",
    "LIVE_TO_UNIFIED_KIND_MAP",
    "PRIORITY_RANK",
    "PRIORITY_SCORE",
    "UNIFIED_DECISION_SOURCES",
    "UnifiedDecision",
    "apply_consistency_gate_to_unified",
    "compute_dedupe_key",
    "compute_score",
    "derive_tier",
    "merge_duplicates",
    "normalize_executive_decision",
    "normalize_koil_decision",
    "normalize_lifecycle_decision",
    "normalize_live_decision",
    "unify_decisions",
]

__version__ = "unified-decisions-v1"
