"""Standing UtilityAccount entity (Domain Model §5.20 / Phase 2 GAP-M03).

In-memory + optional Mongo persistence. Does not invent Sheets columns.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional
from uuid import uuid4

UtilityKind = Literal["electricity", "water"]
ResponsibleParty = Literal["tenant", "owner", "included"]
AccountStatus = Literal[
    "linked", "billing", "due", "overdue", "settled", "transferred", "closed"
]

_memory_accounts: Dict[str, Dict[str, Any]] = {}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def reset_memory_store() -> None:
    _memory_accounts.clear()


def validate_account(payload: Dict[str, Any]) -> Dict[str, Any]:
    kind = str(payload.get("utility_kind") or "").strip().lower()
    if kind not in ("electricity", "water"):
        raise ValueError("utility_kind_invalid")
    account_number = str(payload.get("account_number") or "").strip()
    if not account_number:
        raise ValueError("account_number_required")
    unit_id = str(payload.get("unit_id") or "").strip() or None
    building_id = str(payload.get("building_id") or "").strip() or None
    if not unit_id and not building_id:
        raise ValueError("service_target_required")
    responsible = str(payload.get("responsible_party") or "tenant").strip().lower()
    if responsible not in ("tenant", "owner", "included"):
        raise ValueError("responsible_party_invalid")
    return {
        "utility_kind": kind,
        "account_number": account_number,
        "meter_number": str(payload.get("meter_number") or "").strip() or None,
        "unit_id": unit_id,
        "building_id": building_id,
        "property_id": str(payload.get("property_id") or "").strip() or None,
        "responsible_party": responsible,
        "provider": str(payload.get("provider") or "").strip() or None,
        "current_balance": float(payload.get("current_balance") or 0) or None,
        "due_date": str(payload.get("due_date") or "").strip() or None,
        "payment_channel": str(payload.get("payment_channel") or "").strip() or None,
        "status": str(payload.get("status") or "linked").strip().lower() or "linked",
    }


def upsert_account(payload: Dict[str, Any], *, account_id: Optional[str] = None) -> Dict[str, Any]:
    fields = validate_account(payload)
    now = _now()
    aid = account_id or str(payload.get("id") or "") or f"ua_{uuid4().hex[:12]}"
    prev = _memory_accounts.get(aid)
    record = {
        "id": aid,
        **fields,
        "created_at": (prev or {}).get("created_at") or now,
        "updated_at": now,
    }
    if record["status"] not in (
        "linked",
        "billing",
        "due",
        "overdue",
        "settled",
        "transferred",
        "closed",
    ):
        record["status"] = "linked"
    _memory_accounts[aid] = record
    return dict(record)


def list_accounts(
    *,
    utility_kind: Optional[str] = None,
    unit_id: Optional[str] = None,
    property_id: Optional[str] = None,
) -> List[Dict[str, Any]]:
    rows = list(_memory_accounts.values())
    if utility_kind:
        rows = [r for r in rows if r.get("utility_kind") == utility_kind]
    if unit_id:
        rows = [r for r in rows if r.get("unit_id") == unit_id]
    if property_id:
        rows = [r for r in rows if r.get("property_id") == property_id]
    rows.sort(key=lambda r: r.get("updated_at") or "")
    return [dict(r) for r in rows]


def get_account(account_id: str) -> Optional[Dict[str, Any]]:
    row = _memory_accounts.get(account_id)
    return dict(row) if row else None
