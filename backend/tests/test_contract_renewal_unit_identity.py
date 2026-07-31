"""Contract renewal must not invent a new physical unit (any client)."""

from __future__ import annotations

import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO))
sys.path.insert(0, str(REPO / "backend"))

from adapters.upload_analysis.intake_engine import analyze_statements_deep
from adapters.upload_analysis.intake_parser import (
    _stable_unit_identity_key,
    align_ambiguous_units_across_parsed_rolls,
    parse_unit_cell,
)
from beta_seed import beta_dataset


def _shop_row(tenant: str, contract: str, phone: str, rent: float = 2083.0) -> dict:
    info = parse_unit_cell("محل", "", tenant)
    row = {
        **info,
        "tenant": tenant,
        "contract": contract,
        "phone": phone,
        "rent": rent,
        "is_paid": True,
        "is_late": False,
        "pay_status": "دفع بنكي",
    }
    return row


def test_stable_key_ignores_contract_change_for_generic_shop():
    """Same tenant+phone on raw «محل» → same identity even if contract number changes."""
    a = _shop_row("مؤسسة ناصر للاختبار", "20165292264", "557928889")
    b = _shop_row("مؤسسة ناصر للاختبار", "20079948744", "557928889")
    assert _stable_unit_identity_key(a) == _stable_unit_identity_key(b)
    assert _stable_unit_identity_key(a).startswith("t:")


def test_different_tenants_same_phone_stay_distinct_shops():
    """Shared phone across two shops must not merge them."""
    a = _shop_row("مؤسسة عبدالرحمن", "20751359809", "557928889")
    b = _shop_row("مؤسسة ناصر", "20165292264", "557928889")
    assert _stable_unit_identity_key(a) != _stable_unit_identity_key(b)


def test_contract_renewal_does_not_create_fifth_shop_across_months():
    """
    Universal rule: renewing the contract number for the same tenant/phone
    on a generic commercial label keeps one physical unit across months.
    """
    tenant = "مؤسسة تجديد عقد تجريبي"
    phone = "551112233"
    other_shops = [
        _shop_row("محل أول ثابت", "11111111111", "550000001"),
        _shop_row("محل ثاني ثابت", "22222222222", "550000002"),
        _shop_row("محل ثالث ثابت", "33333333333", "550000003"),
    ]

    month1 = {
        "ok": True,
        "month": 1,
        "year": 2026,
        "file_name": "كشف_شهر_1.csv",
        "rows": other_shops + [_shop_row(tenant, "20165292264", phone)],
        "row_count": 4,
    }
    month2 = {
        "ok": True,
        "month": 2,
        "year": 2026,
        "file_name": "كشف_شهر_2.csv",
        "rows": other_shops + [_shop_row(tenant, "20079948744", phone)],
        "row_count": 4,
    }

    rolls = [month1, month2]
    align_ambiguous_units_across_parsed_rolls(rolls)

    units_m1 = {r["unit"] for r in month1["rows"]}
    units_m2 = {r["unit"] for r in month2["rows"]}
    assert units_m1 == units_m2
    assert len(units_m1) == 4

    renewed_m1 = next(r for r in month1["rows"] if r["tenant"] == tenant)
    renewed_m2 = next(r for r in month2["rows"] if r["tenant"] == tenant)
    assert renewed_m1["unit"] == renewed_m2["unit"]
    assert renewed_m1["contract"] != renewed_m2["contract"]


def test_intake_engine_unique_count_after_contract_renewal():
    """End-to-end intake: two months with contract renewal → still 4 unique shops."""
    # Include leading serial column like real owner sheets (stops header-merge eating data).
    csv1 = (
        "الرقم,رقم الشقة,الاسم,ايجار الشقة,رقم العقد,رقم الجوال,ايجار شهرمدفوع\n"
        "1,محل,مؤسسة أول ثابتة,2000,11111111111,550000001,دفع بنكي\n"
        "2,محل,مؤسسة ثاني ثابتة,2100,22222222222,550000002,دفع بنكي\n"
        "3,محل,مؤسسة ثالث ثابتة,1700,33333333333,550000003,دفع بنكي\n"
        "4,محل,مؤسسة تجديد العقد,2083,20165292264,557928889,دفع بنكي\n"
    )
    csv2 = (
        "الرقم,رقم الشقة,الاسم,ايجار الشقة,رقم العقد,رقم الجوال,ايجار شهرمدفوع\n"
        "1,محل,مؤسسة أول ثابتة,2000,11111111111,550000001,دفع بنكي\n"
        "2,محل,مؤسسة ثاني ثابتة,2100,22222222222,550000002,دفع بنكي\n"
        "3,محل,مؤسسة ثالث ثابتة,1700,33333333333,550000003,دفع بنكي\n"
        "4,محل,مؤسسة تجديد العقد,2083,20079948744,557928889,دفع بنكي\n"
    )
    files = [
        {"name": "كشف شهر 1-2026.csv", "textSnippet": csv1},
        {"name": "كشف شهر 2-2026.csv", "textSnippet": csv2},
    ]
    deep = analyze_statements_deep(files, beta_dataset("owner"))
    stats = deep.get("unique_unit_stats") or {}
    assert stats.get("shop_count") == 4, stats
    assert stats.get("unique_units") == 4, stats

    keys = set()
    for pr in deep.get("parsed_rolls") or []:
        for r in pr.get("rows") or []:
            if "تجديد" in (r.get("tenant") or ""):
                keys.add(r.get("unit"))
    assert len(keys) == 1, keys
