"""Authoritative Consistency Gate — Gap 5.

Normalizes the existing consistency_gate.py output into ONE authoritative
persisted shape, adds entity-aware blocking, and applies the gate to all
live SPP intelligence outputs (unified decisions, briefing, verdicts,
executive brain, executive report).

Public API:
    normalize_gate_output(raw_gate, deep, knowledge, analysis_id) -> dict
    apply_gate_to_unified_decisions(decisions, normalized_gate) -> list
    apply_gate_to_briefing(brief, normalized_gate) -> dict
    apply_gate_to_verdicts(verdicts, normalized_gate) -> dict
    apply_gate_to_executive_brain(brain, normalized_gate) -> dict
    is_entity_blocked(decision, normalized_gate) -> bool
"""

from __future__ import annotations

from .normalizer import (
    GATE_VERSION,
    apply_gate_to_briefing,
    apply_gate_to_executive_brain,
    apply_gate_to_unified_decisions,
    apply_gate_to_verdicts,
    is_entity_blocked,
    normalize_gate_output,
)

__all__ = [
    "GATE_VERSION",
    "apply_gate_to_briefing",
    "apply_gate_to_executive_brain",
    "apply_gate_to_unified_decisions",
    "apply_gate_to_verdicts",
    "is_entity_blocked",
    "normalize_gate_output",
]

__version__ = "consistency-gate-v1"
