"""Link monthly rent rolls — lifecycle, MoM deltas, annual stats."""

from __future__ import annotations

import re
from typing import Any, Dict, List, Tuple


def month_sort_key(year: int, month: int) -> int:
    return (year or 0) * 100 + (month or 0)


def build_monthly_index(parsed_rolls: List[dict]) -> dict:
    by_key: Dict[str, dict] = {}
    for pr in parsed_rolls:
        if not pr.get("ok") or not pr.get("rows"):
            continue
        mk = month_sort_key(pr.get("year", 0), pr.get("month", 0))
        if not mk:
            mk = 900000 + parsed_rolls.index(pr)
        key = str(mk)
        if key not in by_key:
            by_key[key] = {
                "year": pr.get("year"),
                "month": pr.get("month"),
                "file_name": pr.get("file_name", ""),
                "rows": [],
                "units": {},
            }
        for r in pr["rows"]:
            unit = r.get("unit") or ""
            if not unit:
                continue
            by_key[key]["rows"].append(r)
            by_key[key]["units"][unit] = r
    keys = sorted(by_key.keys(), key=lambda k: int(k))
    return {"by_key": by_key, "keys": keys, "month_count": len(keys)}


def _tenant_key(name: str) -> str:
    return "".join((name or "").lower().split())


def _name_tokens(name: str) -> List[str]:
    return [t for t in re.split(r"\s+", (name or "").lower().strip()) if len(t) >= 2]


def _soft_name_same(a: str, b: str) -> bool:
    """Same-script soft match only — never invent bilingual transliteration."""
    ka, kb = _tenant_key(a), _tenant_key(b)
    if not ka or not kb:
        return False
    if ka == kb:
        return True
    shorter, longer = (ka, kb) if len(ka) <= len(kb) else (kb, ka)
    # Containment covers incomplete vs full Arabic name (نور محمد ⊂ نور محمد يونس).
    if len(shorter) >= 6 and shorter in longer:
        return True
    ta, tb = set(_name_tokens(a)), set(_name_tokens(b))
    if not ta or not tb:
        return False
    if ta <= tb or tb <= ta:
        smaller = ta if len(ta) <= len(tb) else tb
        # Require ≥2 tokens so a shared mid-name alone never merges strangers.
        return len(smaller) >= 2
    return False


def _norm_phone_digits(phone: str) -> str:
    from .intake_parser import normalize_saudi_phone

    info = normalize_saudi_phone(phone)
    return re.sub(r"\D", "", info.get("phone") or info.get("phone_raw") or "")


def _norm_contract(contract: str) -> str:
    c = re.sub(r"\s+", "", str(contract or "").strip())
    if not c or c.lower() in ("بدون", "لا", "-", "none", "nan"):
        return ""
    return c


def _phones_match(a: str, b: str) -> bool:
    pp, cp = _norm_phone_digits(a), _norm_phone_digits(b)
    return bool(len(pp) >= 8 and len(cp) >= 8 and (pp == cp or pp[-9:] == cp[-9:]))


def _same_tenant_identity(prev: dict, cur: dict) -> bool:
    """Same tenant on a unit: exact/soft name, or shared contract/phone. Generic — any client."""
    prev_n = prev.get("tenant") or ""
    cur_n = cur.get("tenant") or ""
    if _tenant_key(prev_n) == _tenant_key(cur_n):
        return True
    if _soft_name_same(prev_n, cur_n):
        return True
    pc, cc = _norm_contract(prev.get("contract") or ""), _norm_contract(cur.get("contract") or "")
    if pc and cc and pc == cc:
        return True
    if _phones_match(prev.get("phone") or "", cur.get("phone") or ""):
        return True
    return False


def _clear_identity_switch(prev: dict, cur: dict) -> bool:
    """True only when evidence shows a different person (not a spelling/bilingual flip)."""
    if _same_tenant_identity(prev, cur):
        return False
    pc, cc = _norm_contract(prev.get("contract") or ""), _norm_contract(cur.get("contract") or "")
    if pc and cc and pc != cc:
        return True
    pp, cp = _norm_phone_digits(prev.get("phone") or ""), _norm_phone_digits(cur.get("phone") or "")
    if len(pp) >= 8 and len(cp) >= 8 and pp[-9:] != cp[-9:]:
        return True
    # Names differ and both sides lack phone+contract — too weak; do not assert departure.
    return False


def _filter_false_turnover(departed: List[dict], newcomers: List[dict]) -> Tuple[List[dict], List[dict]]:
    """Drop departed/newcomer pairs that share unit+month and phone or contract."""
    drop_dep: set = set()
    drop_new: set = set()
    for i, d in enumerate(departed):
        for j, n in enumerate(newcomers):
            if str(d.get("unit") or "") != str(n.get("unit") or ""):
                continue
            if int(d.get("departed_month") or 0) != int(n.get("arrived_month") or 0):
                continue
            if int(d.get("departed_year") or 0) != int(n.get("arrived_year") or 0):
                continue
            same_c = _norm_contract(d.get("contract") or "") and (
                _norm_contract(d.get("contract") or "") == _norm_contract(n.get("contract") or "")
            )
            same_p = _phones_match(d.get("phone") or "", n.get("phone") or "")
            # Also soft-name + no opposing phone/contract evidence.
            soft = _soft_name_same(d.get("tenant") or "", n.get("tenant") or "")
            if same_c or same_p or soft:
                drop_dep.add(i)
                drop_new.add(j)
    return (
        [d for i, d in enumerate(departed) if i not in drop_dep],
        [n for j, n in enumerate(newcomers) if j not in drop_new],
    )


def _timeline_identity_key(unit: str, row: dict) -> str:
    contract = _norm_contract(row.get("contract") or "")
    if contract:
        return f"{unit}|c|{contract}"
    phone = _norm_phone_digits(row.get("phone") or "")
    if len(phone) >= 8:
        return f"{unit}|p|{phone[-9:]}"
    return f"{unit}|{_tenant_key(row.get('tenant') or unit)}"


def build_lifecycle(monthly_index: dict) -> dict:
    keys = monthly_index.get("keys") or []
    by_key = monthly_index.get("by_key") or {}
    timeline: Dict[str, dict] = {}
    departed: List[dict] = []
    newcomers: List[dict] = []
    active: List[dict] = []
    seen_dep: set = set()
    seen_new: set = set()
    unit_months: Dict[str, List[dict]] = {}

    for k in keys:
        snap = by_key[k]
        for unit, row in (snap.get("units") or {}).items():
            unit_months.setdefault(unit, []).append(
                {"month": snap["month"], "year": snap["year"], "row": row}
            )

    for unit, seq in unit_months.items():
        for i, cur in enumerate(seq):
            row = cur["row"]
            tenant = row.get("tenant") or ""  # normalized at parser: empty when vacant
            tid = _timeline_identity_key(unit, row)
            if tid not in timeline:
                timeline[tid] = {
                    "unit": unit,
                    "tenant": tenant,
                    "phone": row.get("phone", ""),
                    "contract": row.get("contract", ""),
                    "rent": row.get("rent", 0),
                    "first_month": cur["month"],
                    "first_year": cur["year"],
                    "last_month": cur["month"],
                    "last_year": cur["year"],
                    "months_present": 0,
                    "had_late": False,
                    "total_rent": 0.0,
                    "paid_rent": 0.0,
                    "name_aliases": [],
                }
            t = timeline[tid]
            if tenant and tenant not in t["name_aliases"]:
                t["name_aliases"].append(tenant)
            # Prefer Arabic / longer display name when available
            if tenant and (not t.get("tenant") or (any("\u0600" <= ch <= "\u06FF" for ch in tenant) and not any("\u0600" <= ch <= "\u06FF" for ch in str(t.get("tenant") or "")))):
                t["tenant"] = tenant
            t["last_month"] = cur["month"]
            t["last_year"] = cur["year"]
            t["months_present"] += 1
            if row.get("phone"):
                t["phone"] = row["phone"]
            if row.get("contract"):
                t["contract"] = row["contract"]
            if row.get("rent"):
                t["rent"] = row["rent"]
            if row.get("is_late"):
                t["had_late"] = True
            t["total_rent"] += float(row.get("rent") or 0)
            if row.get("is_paid"):
                t["paid_rent"] += float(row.get("rent") or 0)

            if i > 0:
                prev = seq[i - 1]["row"]
                prev_t = prev.get("tenant") or ""  # empty when vacant
                # Only assert occupancy change on clear identity switch (phone/contract diverge).
                if _clear_identity_switch(prev, row):
                    dep_k = f"{unit}|{_tenant_key(prev_t)}|{cur['month']}/{cur['year']}"
                    if dep_k not in seen_dep:
                        seen_dep.add(dep_k)
                        departed.append(
                            {
                                "unit": unit,
                                "tenant": prev_t,
                                "phone": prev.get("phone", ""),
                                "contract": prev.get("contract", ""),
                                "rent": prev.get("rent", 0),
                                "departed_month": cur["month"],
                                "departed_year": cur["year"],
                                "reason": f"استبدال — {tenant}" if tenant else "غادر — وحدة شاغرة",
                                "had_late": prev.get("is_late", False),
                                "stay_months": i,
                                "confirmed": True,
                            }
                        )
                    if tenant:
                        new_k = f"{unit}|{_tenant_key(tenant)}|{cur['month']}/{cur['year']}"
                        if new_k not in seen_new:
                            seen_new.add(new_k)
                            newcomers.append(
                                {
                                    "unit": unit,
                                    "tenant": tenant,
                                    "phone": row.get("phone", ""),
                                    "contract": row.get("contract", ""),
                                    "rent": row.get("rent", 0),
                                    "arrived_month": cur["month"],
                                    "arrived_year": cur["year"],
                                    "confirmed": True,
                                }
                            )

    new_in_last: List[dict] = []
    if keys:
        last = by_key[keys[-1]]
        prev = by_key[keys[-2]] if len(keys) > 1 else None
        for unit, row in (last.get("units") or {}).items():
            tenant = row.get("tenant") or ""
            is_vacant = bool(row.get("is_vacant")) or not (tenant or "").strip()
            tid = _timeline_identity_key(unit, row)
            t2 = timeline.get(tid, {})
            # Vacant units do NOT count as "active tenants" — they have no
            # tenant under contract. We still record the unit in the active
            # list (so downstream knows the unit exists in the latest month),
            # but mark it vacant and leave tenant="" so active_count derived
            # from "non-vacant active entries" is correct.
            active.append(
                {
                    "unit": unit,
                    "tenant": tenant,  # empty when vacant (normalized at parser)
                    "is_vacant": is_vacant,
                    "property": (row.get("property") or row.get("property_raw") or "").strip(),
                    "property_raw": (row.get("property_raw") or row.get("property") or "").strip(),
                    "phone": row.get("phone") or t2.get("phone", ""),
                    "contract": row.get("contract") or t2.get("contract", ""),
                    "rent": row.get("rent") or t2.get("rent", 0),
                    "since_month": t2.get("first_month") or last["month"],
                    "since_year": t2.get("first_year") or last["year"],
                    "stay_months": t2.get("months_present") or 1,
                    "is_late": row.get("is_late", False),
                    "is_paid": row.get("is_paid", False),
                    "payment_status": row.get("payment_status") or "",
                    "pay_status": "مسدد" if row.get("is_paid") else ("متأخر" if row.get("is_late") else "لم يسدد"),
                }
            )
        if prev:
            for unit, cur_row in (last.get("units") or {}).items():
                prev_row = (prev.get("units") or {}).get(unit)
                cur_t = cur_row.get("tenant") or ""
                prev_t = (prev_row or {}).get("tenant") or ""
                if prev_row and _clear_identity_switch(prev_row, cur_row):
                    new_in_last.append(
                        {
                            "unit": unit,
                            "tenant": cur_t,
                            "rent": cur_row.get("rent", 0),
                            "arrived_month": last["month"],
                            "arrived_year": last["year"],
                            "replaced": prev_t or "شاغرة",
                            "confirmed": True,
                        }
                    )

    departed, newcomers = _filter_false_turnover(departed, newcomers)

    return {
        "timeline": timeline,
        "departed": departed,
        "active": active,
        "newcomers": newcomers,
        "new_in_last_month": new_in_last,
        "last_month": by_key[keys[-1]]["month"] if keys else 0,
        "last_year": by_key[keys[-1]]["year"] if keys else 0,
        "month_count": len(keys),
    }


def build_annual_stats(parsed_rolls: List[dict], lifecycle: dict) -> dict:
    expected = 0.0
    collected = 0.0
    for pr in parsed_rolls:
        for r in pr.get("rows") or []:
            rent = float(r.get("rent") or 0)
            expected += rent
            if r.get("is_paid"):
                collected += rent
    # active_count counts UNIQUE occupied units in the latest month —
    # vacant units (is_vacant=True OR empty tenant) are excluded.
    active_list = lifecycle.get("active") or []
    active_count = sum(
        1 for a in active_list
        if not bool(a.get("is_vacant")) and (a.get("tenant") or "").strip()
    )
    return {
        "total_expected": round(expected),
        "total_collected": round(collected),
        "month_count": lifecycle.get("month_count") or 0,
        "departed_count": len(lifecycle.get("departed") or []),
        "active_count": active_count,
        "newcomers_count": len(lifecycle.get("newcomers") or []),
    }


def build_month_comparison(parsed_rolls: List[dict], expense_rolls: List[dict], lang: str) -> List[dict]:
    from .intake_classifier import month_label

    index = build_monthly_index(parsed_rolls)
    exp_by_month: Dict[int, float] = {}
    for er in expense_rolls:
        for r in er.get("rows") or []:
            m = extract_month_from_expense(er, r)
            exp_by_month[m] = exp_by_month.get(m, 0) + float(r.get("amount") or 0)

    out: List[dict] = []
    prev_rev = 0.0
    for k in index["keys"]:
        snap = index["by_key"][k]
        month = int(snap.get("month") or 0)
        rev = sum(float(r.get("rent") or 0) for r in snap.get("rows") or [])
        coll = sum(float(r.get("rent") or 0) for r in snap.get("rows") or [] if r.get("is_paid"))
        exp = exp_by_month.get(month, round(rev * 0.28))
        delta = round(rev - prev_rev) if prev_rev else 0
        out.append(
            {
                "month": month_label(month, lang),
                "month_num": month,
                "revenue": round(rev),
                "collected": round(coll),
                "expenses": round(exp),
                "delta_revenue": delta,
                "late_count": sum(1 for r in snap.get("rows") or [] if r.get("is_late")),
                "paid_count": sum(1 for r in snap.get("rows") or [] if r.get("is_paid")),
            }
        )
        prev_rev = rev
    return out


def extract_month_from_expense(er: dict, row: dict) -> int:
    from .intake_classifier import extract_month

    return extract_month(er.get("file_name") or "")


from .intake_parser import _is_commercial_unit_type, _text_mentions_commercial_keyword


def build_unique_unit_stats(monthly_index: dict) -> dict:
    """Count each physical unit once across all months (not per monthly file)."""
    units: set = set()
    shops: set = set()
    apartments: set = set()
    for k in monthly_index.get("keys") or []:
        snap = (monthly_index.get("by_key") or {}).get(k) or {}
        for u, row in (snap.get("units") or {}).items():
            units.add(u)
            unit_type = row.get("unit_type") or row.get("unitType") or "شقة"
            if _is_commercial_unit_type(unit_type) or _text_mentions_commercial_keyword(str(u)):
                shops.add(u)
            else:
                apartments.add(u)
    return {
        "unique_units": len(units),
        "shop_count": len(shops),
        "apartment_count": len(apartments),
    }


def _tenant_ledger_key(row: dict, unit: str) -> str:
    contract = _norm_contract(row.get("contract") or "")
    if contract and len(contract) > 2:
        return f"c|{contract}"
    phone = _norm_phone_digits(row.get("phone") or "")
    if len(phone) >= 8:
        return f"p|{phone[-9:]}"
    tenant = row.get("tenant") or unit
    return f"u|{unit}|{_tenant_key(tenant)}"


def _payment_month_status(row: dict) -> str:
    status = row.get("payment_status")
    if status in (
        "paid",
        "partial",
        "unpaid_confirmed",
        "not_due",
        "vacated",
        "unknown_requires_review",
    ):
        return status
    # Legacy fallback
    rent = float(row.get("rent") or 0)
    paid = float(row.get("paid") or 0)
    if row.get("is_paid") or (paid >= rent and rent > 0):
        return "paid"
    if 0 < paid < rent:
        return "partial"
    if row.get("is_late"):
        return "unpaid_confirmed"
    if not rent:
        return "not_due"
    return "unknown_requires_review"


def build_tenant_payment_ledger(parsed_rolls: List[dict]) -> dict:
    """Monthly payment record per tenant/unit — aggregates late months across files."""
    from .intake_classifier import month_label

    ledger: Dict[str, dict] = {}
    merge_count = 0
    month_seen: set = set()

    for pr in parsed_rolls:
        for r in pr.get("rows") or []:
            unit = r.get("unit") or ""
            if not unit:
                continue
            tk = _tenant_ledger_key(r, unit)
            tenant_val = (r.get("tenant") or "").strip()
            is_vacant = bool(r.get("is_vacant")) or not tenant_val
            property_val = (r.get("property") or r.get("property_raw") or "").strip()
            if tk not in ledger:
                ledger[tk] = {
                    "unit": unit,
                    "unit_type": r.get("unit_type") or "شقة",
                    "tenant": tenant_val,  # normalized: empty when vacant
                    "tenant_raw": r.get("tenant_raw") or r.get("tenant") or "",
                    "is_vacant": is_vacant,
                    "property": property_val,  # raw property/building cell (may be empty)
                    "property_raw": property_val,
                    "phone": r.get("phone") or "",
                    "contract": r.get("contract") or "",
                    "rent": r.get("rent") or 0,
                    "months": [],
                    "total_due": 0.0,
                    "total_paid": 0.0,
                    "total_unpaid": 0.0,
                    "late_month_count": 0,
                }
            ent = ledger[tk]
            if r.get("phone") and not ent["phone"]:
                ent["phone"] = r["phone"]
            if r.get("contract") and not ent["contract"]:
                ent["contract"] = r["contract"]
            if r.get("rent"):
                ent["rent"] = r["rent"]

            rent = float(r.get("rent") or 0)
            paid = float(r.get("paid") or 0)
            if r.get("is_paid") and not paid:
                paid = rent
            status = _payment_month_status(r)
            remaining = 0.0
            if status == "partial":
                remaining = max(0.0, rent - paid)
            elif status == "unpaid_confirmed":
                remaining = max(0.0, rent - paid) if paid else rent
            month_key = f"{pr.get('year')}-{pr.get('month')}|{unit}|{tk}"
            if month_key in month_seen:
                merge_count += 1
                continue
            month_seen.add(month_key)

            ent["months"].append(
                {
                    "month": pr.get("month"),
                    "year": pr.get("year"),
                    "due": rent,
                    "paid": paid,
                    "remaining": remaining,
                    "status": status,
                    "pay_status_raw": r.get("pay_status") or "",
                    "evidence": [
                        f"المصدر: {pr.get('file_name') or '—'}",
                        f"الوحدة {unit}",
                        f"خانة حالة الدفع: {r.get('pay_status') or '—'}",
                    ],
                }
            )
            ent["total_due"] += rent
            if status == "paid":
                ent["total_paid"] += paid or rent
            elif status == "partial":
                ent["total_paid"] += paid
            if status in ("unpaid_confirmed", "partial"):
                ent["total_unpaid"] += remaining
                ent["late_month_count"] += 1

    for ent in ledger.values():
        ent["months"].sort(key=lambda m: month_sort_key(m.get("year", 0), m.get("month", 0)))

    late_tenants: List[dict] = []
    for ent in ledger.values():
        unpaid = [m for m in ent["months"] if m["status"] in ("unpaid_confirmed", "partial")]
        if not unpaid:
            continue
        month_labels = " · ".join(
            f"{month_label(int(m.get('month') or 0), 'ar')} ({m.get('remaining') or m.get('due')} ر.س)"
            for m in unpaid
        )
        late_tenants.append(
            {
                **ent,
                "late_month_count": len(unpaid),
                "month_labels": month_labels,
                "oldest_month": unpaid[0],
            }
        )

    late_tenants.sort(
        key=lambda x: (
            -float(x.get("total_unpaid") or 0),
            -int(x.get("late_month_count") or 0),
            month_sort_key(
                (x.get("oldest_month") or {}).get("year", 0),
                (x.get("oldest_month") or {}).get("month", 0),
            ),
        )
    )
    return {
        "ledger": ledger,
        "late_tenants": late_tenants,
        "merge_count": merge_count,
        "tenant_count": len(ledger),
    }


def build_late_payments_by_month(payment_ledger: dict) -> dict:
    """Group unpaid/partial/pending amounts by calendar month — universal import rule."""
    from .intake_classifier import month_label as _ml

    ledger = payment_ledger.get("ledger") or {}
    month_map: dict = {}
    tenant_keys: set = set()

    for ent in ledger.values():
        for m in ent.get("months") or []:
            status = m.get("status") or ""
            if status not in ("unpaid_confirmed", "partial", "unpaid"):
                continue
            year = int(m.get("year") or 0)
            month = int(m.get("month") or 0)
            key = f"{year}-{month}"
            if key not in month_map:
                month_map[key] = {
                    "year": year,
                    "month": month,
                    "month_label": f"{_ml(month, 'ar')} {year}".strip(),
                    "items": [],
                    "month_total": 0.0,
                    "late_count": 0,
                }
            amt = float(m.get("remaining") or m.get("due") or 0)
            month_map[key]["items"].append(
                {
                    "tenant": ent.get("tenant") or "—",
                    "unit": ent.get("unit") or "—",
                    "contract": ent.get("contract") or "",
                    "phone": ent.get("phone") or "",
                    "amount": amt,
                    "status": status,
                    "rent": float(m.get("due") or 0),
                    "paid": float(m.get("paid") or 0),
                }
            )
            month_map[key]["month_total"] += amt
            month_map[key]["late_count"] += 1
            tenant_keys.add(f"{ent.get('tenant')}|{ent.get('unit')}")

    months = sorted(month_map.values(), key=lambda x: month_sort_key(x.get("year", 0), x.get("month", 0)))
    for mb in months:
        mb["items"].sort(key=lambda it: (-float(it.get("amount") or 0), str(it.get("unit") or "")))

    grand_total = sum(float(m.get("month_total") or 0) for m in months)
    return {
        "months": months,
        "grand_total": grand_total,
        "late_tenant_count": len(tenant_keys),
    }


def find_late_tenants(parsed_rolls: List[dict]) -> List[dict]:
    """Aggregate late tenants across all months (not last month only)."""
    ledger = build_tenant_payment_ledger(parsed_rolls)
    out: List[dict] = []
    for lt in ledger["late_tenants"]:
        out.append(
            {
                "unit": lt.get("unit"),
                "tenant": lt.get("tenant"),
                "rent": lt.get("rent"),
                "phone": lt.get("phone", ""),
                "contract": lt.get("contract", ""),
                "late_month_count": lt.get("late_month_count"),
                "total_unpaid": lt.get("total_unpaid"),
                "month_labels": lt.get("month_labels"),
                "months": lt.get("months"),
            }
        )
    return out


def maintenance_frequency(expense_rolls: List[dict]) -> List[Tuple[str, int, float]]:
    freq: Dict[str, List[float]] = {}
    for er in expense_rolls:
        for r in er.get("rows") or []:
            desc = (r.get("description") or "صيانة").strip()
            freq.setdefault(desc, []).append(float(r.get("amount") or 0))
    ranked = sorted(freq.items(), key=lambda x: (-len(x[1]), -sum(x[1])))
    return [(d, len(amts), round(sum(amts))) for d, amts in ranked[:8]]


def costliest_units(expense_rolls: List[dict], parsed_rolls: List[dict]) -> List[Tuple[str, float]]:
    totals: Dict[str, float] = {}
    for er in expense_rolls:
        for r in er.get("rows") or []:
            u = r.get("unit") or "عام"
            totals[u] = totals.get(u, 0) + float(r.get("amount") or 0)
    for pr in parsed_rolls:
        for r in pr.get("rows") or []:
            if r.get("is_late"):
                u = r.get("unit") or "?"
                totals[u] = totals.get(u, 0) + float(r.get("rent") or 0) * 0.5
    return sorted(totals.items(), key=lambda x: -x[1])[:5]
