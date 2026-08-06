"""Koil Action Executor — Layer 4: actually DO the next best thing.

Closes the loop that stopped at "approved_and_prepared / not_sent" for a
single decision kind (see ``adapters.decision_approvals``). This module:

  1. Can autonomously pick the single highest-value, unblocked decision
     from the unified list (``choose_best_action``) — this is what makes
     Koil an employee instead of a query box: it can decide what to work
     on next, not just answer when asked.
  2. Executes any decision kind (``execute_decision``), producing a real,
     channel-ready deliverable (WhatsApp deep link when a phone number is
     confirmed, or a task note) and a durable audit record.

Nothing here calls an external send API — this codebase has no messaging
credentials configured. "Execute" means: draft the professional content,
generate the one-tap WhatsApp deep link, advance the decision's status,
and write an auditable execution record with a follow-up date. That is a
real action a property employee performs, not a read-only summary.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from .action_registry import draft_action_content


class ActionExecutionError(ValueError):
    """A decision cannot be executed safely right now."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


def _norm(value: Any) -> str:
    return str(value or "").strip().casefold()


def _is_blocked(decision: Dict[str, Any]) -> bool:
    gate_status = _norm(decision.get("gate_status"))
    return bool(decision.get("blocked_by_gate")) or gate_status in {
        "blocked",
        "review_only",
        "blocked_for_review",
    }


def find_decision(ai_state: Dict[str, Any], decision_id: str) -> Optional[Dict[str, Any]]:
    for decision in ai_state.get("unified_smart_decisions") or []:
        if str(decision.get("id") or "") == decision_id:
            return decision
    return None


def choose_best_action(ai_state: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Pick the single highest-score, unblocked, not-yet-resolved decision.

    This is Koil deciding what to work on next by itself — the "auto"
    entry point used when the caller does not name a specific decision.
    """
    candidates = [
        d
        for d in (ai_state.get("unified_smart_decisions") or [])
        if not _is_blocked(d) and _norm(d.get("status")) not in {"resolved", "executed", "dismissed"}
    ]
    if not candidates:
        return None
    candidates.sort(key=lambda d: float(d.get("score") or 0), reverse=True)
    return candidates[0]


def _find_confirmed_row(ai_state: Dict[str, Any], tenant: str, unit: str) -> Dict[str, Any]:
    """Best-effort lookup of confirmed lifecycle facts for a tenant/unit.

    Mirrors ``adapters.decision_approvals._find_confirmed_late_row`` but is
    tolerant (returns {} instead of raising) since most decision kinds do
    not require arrears figures to be executable.
    """
    tenant_key = _norm(tenant)
    unit_key = _norm(unit)
    lifecycle = ai_state.get("normalized_lifecycle") or {}
    sources: List[List[Dict[str, Any]]] = [
        lifecycle.get("late_tenants") or [],
        ((ai_state.get("property_knowledge") or {}).get("late") or {}).get("tenants") or [],
    ]
    for rows in sources:
        for row in rows:
            row_tenant = row.get("tenant") or row.get("name")
            if _norm(row_tenant) == tenant_key and _norm(row.get("unit")) == unit_key:
                return row
    return {}


@dataclass
class ExecutionRecord:
    analysis_id: str
    decision_id: str
    decision_kind: str
    tenant: str
    unit: str
    channel: str
    message: str
    deep_link: Optional[str]
    phone: Optional[str]
    summary: str
    executed_by: str
    executed_at: str
    follow_up_at: Optional[str]
    note: Optional[str] = None
    status: str = "executed"
    delivery_status: str = "ready_to_send"  # becomes "sent" only via an external channel we don't own

    def to_dict(self) -> Dict[str, Any]:
        return {
            "_id": f"koil_exec:{self.analysis_id}:{self.decision_id}:{self.executed_at}",
            "analysis_id": self.analysis_id,
            "decision_id": self.decision_id,
            "decision_kind": self.decision_kind,
            "tenant": self.tenant,
            "unit": self.unit,
            "channel": self.channel,
            "message": self.message,
            "deep_link": self.deep_link,
            "phone": self.phone,
            "summary": self.summary,
            "executed_by": self.executed_by,
            "executed_at": self.executed_at,
            "follow_up_at": self.follow_up_at,
            "note": self.note,
            "status": self.status,
            "delivery_status": self.delivery_status,
        }


def execute_decision(
    ai_state: Dict[str, Any],
    decision: Dict[str, Any],
    *,
    executed_by: str = "koil",
    note: Optional[str] = None,
    now: Optional[datetime] = None,
) -> ExecutionRecord:
    """Execute one unified decision: draft real content + build an audit record.

    Raises ``ActionExecutionError`` when the decision is blocked by the
    consistency gate or is missing identity fields — same safety posture
    as ``adapters.decision_approvals.build_approval_record``, generalized
    to every decision kind instead of only ``contact_late_tenant``.
    """
    if _is_blocked(decision):
        raise ActionExecutionError(
            "decision_blocked_by_gate",
            "Decision is blocked by the consistency gate",
        )

    analysis_id = str(ai_state.get("analysis_id") or "")
    decision_id = str(decision.get("id") or "")
    if not analysis_id or not decision_id:
        raise ActionExecutionError(
            "decision_data_incomplete",
            "Analysis or decision identity is missing",
        )

    tenant = str(decision.get("tenant_name") or decision.get("tenant") or "").strip()
    unit = str(decision.get("unit_label") or decision.get("unit") or "").strip()

    confirmed_row = _find_confirmed_row(ai_state, tenant, unit) if tenant and unit else {}
    phone = str(confirmed_row.get("phone") or "").strip()

    content = draft_action_content(
        decision,
        phone=phone,
        extra={
            "total_unpaid": confirmed_row.get("total_unpaid") or confirmed_row.get("rent"),
            "late_month_count": confirmed_row.get("late_month_count"),
        },
    )

    ts = now or datetime.now(timezone.utc)
    executed_at = ts.isoformat()
    follow_up_at = (
        (ts + timedelta(hours=content.follow_up_hours)).isoformat()
        if content.follow_up_hours
        else None
    )

    return ExecutionRecord(
        analysis_id=analysis_id,
        decision_id=decision_id,
        decision_kind=str(decision.get("kind") or ""),
        tenant=tenant or "—",
        unit=unit or "—",
        channel=content.channel,
        message=content.message,
        deep_link=content.deep_link,
        phone=content.phone,
        summary=content.summary,
        executed_by=executed_by,
        executed_at=executed_at,
        follow_up_at=follow_up_at,
        note=note,
    )
