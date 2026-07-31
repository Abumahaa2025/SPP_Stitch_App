"""Lifecycle Intelligence — Gap 3 completion.

Public API:
    build_normalized_lifecycle(deep, lang)         -> NormalizedLifecycle dict
    generate_lifecycle_decisions(normalized, gate) -> List[LifecycleDecision dict]
    deduplicate_against_live_decisions(lc, live)   -> filtered list
    LIFECYCLE_DECISION_KINDS                        -> the 7 allowed kinds
"""

from __future__ import annotations

from .normalizer import (
    LIFECYCLE_DECISION_KINDS,
    LifecycleDecision,
    NormalizedLifecycle,
    build_normalized_lifecycle,
    deduplicate_against_live_decisions,
    generate_lifecycle_decisions,
)

__all__ = [
    "LIFECYCLE_DECISION_KINDS",
    "LifecycleDecision",
    "NormalizedLifecycle",
    "build_normalized_lifecycle",
    "deduplicate_against_live_decisions",
    "generate_lifecycle_decisions",
]

__version__ = "lifecycle-intelligence-v1"
