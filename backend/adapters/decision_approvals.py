"""Prepare auditable approvals for confirmed late-tenant decisions."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional


class ApprovalValidationError(ValueError):
    """A decision cannot be prepared safely from its persisted analysis."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


def _norm(value: Any) -> str:
    return str(value or "").strip().casefold()


def find_decision(ai_state: Dict[str, Any], decision_id: str) -> Optional[Dict[str, Any]]:
    """Find an exact unified decision inside one persisted analysis."""
    for decision in ai_state.get("unified_smart_decisions") or []:
        if str(decision.get("id") or "") == decision_id:
            return decision
    return None


def _find_confirmed_late_row(
    ai_state: Dict[str, Any],
    tenant: str,
    unit: str,
) -> Optional[Dict[str, Any]]:
    tenant_key = _norm(tenant)
    unit_key = _norm(unit)

    lifecycle = ai_state.get("normalized_lifecycle") or {}
    sources = [
        lifecycle.get("late_tenants") or [],
        ((ai_state.get("property_knowledge") or {}).get("late") or {}).get("tenants") or [],
    ]
    for rows in sources:
        for row in rows:
            row_tenant = row.get("tenant") or row.get("name")
            if _norm(row_tenant) == tenant_key and _norm(row.get("unit")) == unit_key:
                return row
    return None


def prepare_arabic_late_payment_message(
    tenant: str,
    unit: str,
    amount: float,
    late_month_count: int,
) -> str:
    """Build the fixed server-side Arabic reminder template."""
    return (
        f"السلام عليكم {tenant}، نود تذكيركم بمتبقي إيجار وحدة {unit} "
        f"بمبلغ {amount:,.0f} ر.س عن {late_month_count} شهر. "
        "يرجى السداد في أقرب وقت. شكراً لكم."
    )


def build_approval_record(
    ai_state: Dict[str, Any],
    decision: Dict[str, Any],
    *,
    approved_at: Optional[str] = None,
) -> Dict[str, Any]:
    """Validate and snapshot an approved-and-prepared contact decision."""
    if decision.get("kind") != "contact_late_tenant":
        raise ApprovalValidationError(
            "unsupported_decision_kind",
            "Only contact_late_tenant decisions can be approved",
        )
    if decision.get("requires_confirmation") is not True:
        raise ApprovalValidationError(
            "confirmation_not_required",
            "Decision does not require confirmation",
        )

    gate_status = _norm(decision.get("gate_status"))
    if decision.get("blocked_by_gate") is True or gate_status in {
        "blocked",
        "review_only",
        "blocked_for_review",
    }:
        raise ApprovalValidationError(
            "decision_blocked_by_gate",
            "Decision is blocked by the consistency gate",
        )

    tenant = str(decision.get("tenant_name") or decision.get("tenant") or "").strip()
    unit = str(decision.get("unit_label") or decision.get("unit") or "").strip()
    if not tenant or not unit:
        raise ApprovalValidationError(
            "decision_data_incomplete",
            "Decision tenant or unit is missing",
        )

    late_row = _find_confirmed_late_row(ai_state, tenant, unit)
    if not late_row:
        raise ApprovalValidationError(
            "decision_data_incomplete",
            "Confirmed arrears data is missing for the decision",
        )

    amount = float(late_row.get("total_unpaid") or late_row.get("rent") or 0)
    late_month_count = int(late_row.get("late_month_count") or 0)
    if amount <= 0 or late_month_count <= 0:
        raise ApprovalValidationError(
            "decision_data_incomplete",
            "Confirmed arrears amount or month count is missing",
        )

    analysis_id = str(ai_state.get("analysis_id") or "")
    decision_id = str(decision.get("id") or "")
    if not analysis_id or not decision_id:
        raise ApprovalValidationError(
            "decision_data_incomplete",
            "Analysis or decision identity is missing",
        )

    timestamp = approved_at or datetime.now(timezone.utc).isoformat()
    reason = str(decision.get("why") or "").strip() or (
        f"متأخرات مؤكدة: {late_month_count} شهر · {amount:,.0f} ر.س"
    )
    return {
        "_id": f"approval:{analysis_id}:{decision_id}",
        "approval_id": f"approval:{analysis_id}:{decision_id}",
        "analysis_id": analysis_id,
        "decision_id": decision_id,
        "decision_kind": "contact_late_tenant",
        "tenant": tenant,
        "unit": unit,
        "amount": amount,
        "currency": "SAR",
        "late_month_count": late_month_count,
        "phone": str(late_row.get("phone") or "").strip(),
        "reason": reason,
        "prepared_message": prepare_arabic_late_payment_message(
            tenant,
            unit,
            amount,
            late_month_count,
        ),
        "approved_at": timestamp,
        "status": "approved_and_prepared",
        "delivery_status": "not_sent",
    }
