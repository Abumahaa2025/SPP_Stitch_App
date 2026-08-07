"""Interface layer — UtilityAccount standing entity routes (thin)."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from adapters.utility_accounts import get_account, list_accounts, upsert_account

router = APIRouter(tags=["utility-accounts"])


class UtilityAccountUpsert(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: Optional[str] = None
    utility_kind: str
    account_number: str
    meter_number: Optional[str] = None
    unit_id: Optional[str] = None
    building_id: Optional[str] = None
    property_id: Optional[str] = None
    responsible_party: str = "tenant"
    provider: Optional[str] = None
    current_balance: Optional[float] = None
    due_date: Optional[str] = None
    payment_channel: Optional[str] = None
    status: str = "linked"


@router.get("/utility-accounts")
async def get_utility_accounts(
    utility_kind: Optional[str] = None,
    unit_id: Optional[str] = None,
    property_id: Optional[str] = None,
) -> Dict[str, Any]:
    rows = list_accounts(
        utility_kind=utility_kind,
        unit_id=unit_id,
        property_id=property_id,
    )
    return {"ok": True, "count": len(rows), "accounts": rows}


@router.get("/utility-accounts/{account_id}")
async def get_utility_account(account_id: str) -> Dict[str, Any]:
    row = get_account(account_id)
    if not row:
        raise HTTPException(404, {"ok": False, "error": "not_found"})
    return {"ok": True, "account": row}


@router.post("/utility-accounts")
async def post_utility_account(body: UtilityAccountUpsert) -> Dict[str, Any]:
    try:
        record = upsert_account(body.model_dump(), account_id=body.id)
    except ValueError as exc:
        raise HTTPException(422, {"ok": False, "error": str(exc)}) from exc
    return {"ok": True, "account": record}
