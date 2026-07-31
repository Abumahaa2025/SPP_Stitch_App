"""Property Knowledge Engine — canonical facts from import snapshot (any client)."""

from __future__ import annotations

from typing import Any, Dict, List, Literal

from adapters.upload_analysis.intake_classifier import month_label

Lang = Literal["ar", "en"]


def _f(v: Any, default: float = 0.0) -> float:
    try:
        return float(v or 0)
    except (TypeError, ValueError):
        return default


def _tenant_key(name: str) -> str:
    return "".join((name or "").lower().split())


def _ml(month: int, year: int, lang: Lang) -> str:
    base = month_label(int(month or 0), lang)
    if year:
        return f"{base} {year}".strip()
    return base


def _status_label_ar(status: str) -> str:
    return {
        "paid": "مدفوع",
        "partial": "سداد جزئي",
        "unpaid_confirmed": "متأخر مؤكد",
        "unpaid": "متأخر مؤكد",
        "vacated": "إخلاء",
        "not_due": "غير مستحق",
        "unknown_requires_review": "يحتاج مراجعة",
        "pending": "يحتاج مراجعة",
    }.get(status or "", status or "—")


def _build_tenant_cards(snapshot: dict, lang: Lang) -> List[dict]:
    """Full tenant cards from payment ledger — Property Knowledge source of truth."""
    pl = snapshot.get("payment_ledger") or {}
    if isinstance(pl, dict) and "ledger" in pl:
        ledger = pl.get("ledger") or {}
    else:
        ledger = pl if isinstance(pl, dict) else {}

    # Index confirmed occupancy moves by unit for "last important change".
    lc = snapshot.get("lifecycle") or {}
    moves_by_unit: Dict[str, List[dict]] = {}
    for d in lc.get("departed") or []:
        moves_by_unit.setdefault(str(d.get("unit") or ""), []).append(
            {
                "kind": "departure",
                "label": (
                    f"استبدال/خروج: {d.get('tenant')} — {d.get('reason') or ''}"
                    if lang == "ar"
                    else f"Exit/replace: {d.get('tenant')}"
                ),
                "month": d.get("departed_month"),
                "year": d.get("departed_year"),
            }
        )
    for n in lc.get("newcomers") or []:
        moves_by_unit.setdefault(str(n.get("unit") or ""), []).append(
            {
                "kind": "arrival",
                "label": (
                    f"دخول: {n.get('tenant')}"
                    if lang == "ar"
                    else f"Arrival: {n.get('tenant')}"
                ),
                "month": n.get("arrived_month"),
                "year": n.get("arrived_year"),
            }
        )

    cards: List[dict] = []
    for ent in ledger.values():
        months_out = []
        confirmed_arrears = 0.0
        confirmed_months = 0
        last_status_flip = ""
        prev_st = ""
        for m in ent.get("months") or []:
            st = m.get("status") or "unknown_requires_review"
            rem = float(m.get("remaining") or 0)
            if st in ("unpaid_confirmed", "partial", "unpaid"):
                confirmed_arrears += rem
                confirmed_months += 1
            label = _ml(int(m.get("month") or 0), int(m.get("year") or 0), lang)
            if prev_st and prev_st != st:
                last_status_flip = (
                    f"{label}: {_status_label_ar(prev_st) if lang == 'ar' else prev_st} → {_status_label_ar(st) if lang == 'ar' else st}"
                )
            prev_st = st
            months_out.append(
                {
                    "month": m.get("month"),
                    "year": m.get("year"),
                    "label": label,
                    "status": st,
                    "status_label": _status_label_ar(st) if lang == "ar" else st,
                    "due": _f(m.get("due")),
                    "paid": _f(m.get("paid")),
                    "remaining": rem if st in ("unpaid_confirmed", "partial", "unpaid") else 0.0,
                    "pay_status_raw": m.get("pay_status_raw") or "",
                }
            )
        months_out.sort(key=lambda x: (int(x.get("year") or 0), int(x.get("month") or 0)))
        first = months_out[0] if months_out else {}
        last = months_out[-1] if months_out else {}

        unit = str(ent.get("unit") or "—")
        unit_moves = sorted(
            moves_by_unit.get(unit) or [],
            key=lambda x: (int(x.get("year") or 0), int(x.get("month") or 0)),
        )
        last_move = unit_moves[-1] if unit_moves else None
        if confirmed_arrears > 0:
            last_important = (
                f"متأخرات مؤكدة: {confirmed_months} شهر · {confirmed_arrears:,.0f} ر.س"
                if lang == "ar"
                else f"Confirmed arrears: {confirmed_months} mo · {confirmed_arrears:,.0f}"
            )
        elif last_move:
            last_important = last_move.get("label") or ""
        elif last_status_flip:
            last_important = last_status_flip
        else:
            last_important = (
                f"آخر ظهور في الكشوف: {last.get('label') or '—'}"
                if lang == "ar"
                else f"Last seen in sheets: {last.get('label') or '—'}"
            )

        cards.append(
            {
                "id": f"{ent.get('unit')}|{ent.get('contract') or ent.get('phone') or ent.get('tenant')}",
                "tenant": ent.get("tenant") or "",
                "tenant_raw": ent.get("tenant_raw") or ent.get("tenant") or "",
                "is_vacant": bool(ent.get("is_vacant")) or not (ent.get("tenant") or "").strip(),
                "property": ent.get("property") or ent.get("property_raw") or "",
                "property_raw": ent.get("property_raw") or ent.get("property") or "",
                "unit": unit,
                "phone": (ent.get("phone") or "").strip(),
                "contract": (ent.get("contract") or "").strip(),
                "rent": _f(ent.get("rent")),
                # Contract calendar dates often absent from rent rolls — never invent.
                "contract_start": first.get("label") or "",
                "contract_end": last.get("label") or "",
                "contract_start_label": first.get("label") or "",
                "contract_end_label": last.get("label") or "",
                "first_seen_label": first.get("label") or "",
                "last_seen_label": last.get("label") or "",
                "dates_note": (
                    "بداية/نهاية العقد = أول/آخر ظهور في الكشوف (تاريخ العقد التقويمي غير متوفر في الملفات المرفوعة)"
                    if lang == "ar"
                    else "Contract start/end = first/last sheet appearance (calendar dates not in uploads)"
                ),
                "months": months_out,
                "confirmed_arrears": round(confirmed_arrears, 2),
                "confirmed_late_months": confirmed_months,
                "last_important_change": last_important,
            }
        )
    cards.sort(key=lambda c: (str(c.get("unit") or ""), str(c.get("tenant") or "")))
    return cards


def _ledger_quality(snapshot: dict) -> dict:
    pl = snapshot.get("payment_ledger") or {}
    ledger = (pl.get("ledger") if isinstance(pl, dict) and "ledger" in pl else pl) or {}
    unknown = 0
    vacated = 0
    confirmed_late = 0
    paid = 0
    total_months = 0
    for ent in (ledger.values() if isinstance(ledger, dict) else []):
        for m in ent.get("months") or []:
            total_months += 1
            st = m.get("status") or ""
            if st == "unknown_requires_review":
                unknown += 1
            elif st == "vacated":
                vacated += 1
            elif st in ("unpaid_confirmed", "partial", "unpaid"):
                confirmed_late += 1
            elif st == "paid":
                paid += 1
    # Collection recommendations only when no unclear payment months remain.
    collection_recs_allowed = unknown == 0
    return {
        "total_month_rows": total_months,
        "unknown_month_count": unknown,
        "vacated_month_count": vacated,
        "confirmed_late_month_count": confirmed_late,
        "paid_month_count": paid,
        "collection_recs_allowed": collection_recs_allowed,
        "ledger_trust": "ok" if unknown == 0 else "needs_review",
    }


def _normalize_late_tenant(row: dict) -> dict:
    months = row.get("months") or []
    unpaid = [m for m in months if (m.get("status") or "") in ("unpaid_confirmed", "partial", "unpaid")]
    return {
        "tenant": row.get("tenant") or row.get("Tenant") or "—",
        "unit": row.get("unit") or "—",
        "phone": (row.get("phone") or "").strip(),
        "contract": (row.get("contract") or "").strip(),
        "late_month_count": int(row.get("lateMonthCount") or row.get("late_month_count") or len(unpaid)),
        "total_unpaid": _f(row.get("totalUnpaid") or row.get("total_unpaid")),
        "months": unpaid,
        "has_partial": any((m.get("status") or "") == "partial" for m in unpaid),
        "consecutive_late": _count_consecutive_late(unpaid),
    }


def _count_consecutive_late(unpaid: List[dict]) -> int:
    if not unpaid:
        return 0
    sorted_m = sorted(unpaid, key=lambda m: (int(m.get("year") or 0), int(m.get("month") or 0)))
    best = cur = 1
    for i in range(1, len(sorted_m)):
        prev = sorted_m[i - 1]
        cur_m = sorted_m[i]
        pk = int(prev.get("year") or 0) * 100 + int(prev.get("month") or 0)
        ck = int(cur_m.get("year") or 0) * 100 + int(cur_m.get("month") or 0)
        if ck - pk == 1 or (prev.get("month") == 12 and cur_m.get("month") == 1 and int(cur_m.get("year") or 0) == int(prev.get("year") or 0) + 1):
            cur += 1
            best = max(best, cur)
        else:
            cur = 1
    return best


def _detect_tenant_changes(departed: List[dict], newcomers: List[dict]) -> List[dict]:
    """One event per real switch — no duplicate arrival for the same replacement."""
    changes: List[dict] = []
    replacement_keys: set = set()
    for d in departed:
        reason = d.get("reason") or ""
        unit = d.get("unit")
        month = d.get("departedMonth") or d.get("departed_month")
        year = d.get("departedYear") or d.get("departed_year")
        confirmed = bool(d.get("confirmed"))
        if "استبدال" in reason or "replacement" in reason.lower():
            new_t = reason.split("—")[-1].strip() if "—" in reason else ""
            key = f"{unit}|{month}|{year}|{new_t}"
            replacement_keys.add(key)
            changes.append(
                {
                    "unit": unit,
                    "from_tenant": d.get("tenant"),
                    "to_tenant": new_t or None,
                    "month": month,
                    "year": year,
                    "type": "replacement",
                    "confirmed": confirmed,
                }
            )
        else:
            changes.append(
                {
                    "unit": unit,
                    "from_tenant": d.get("tenant"),
                    "to_tenant": None,
                    "month": month,
                    "year": year,
                    "type": "departure",
                    "confirmed": confirmed,
                }
            )
    for n in newcomers:
        unit = n.get("unit")
        month = n.get("arrivedMonth") or n.get("arrived_month")
        year = n.get("arrivedYear") or n.get("arrived_year")
        tenant = n.get("tenant")
        key = f"{unit}|{month}|{year}|{tenant}"
        if key in replacement_keys:
            continue
        changes.append(
            {
                "unit": unit,
                "from_tenant": None,
                "to_tenant": tenant,
                "month": month,
                "year": year,
                "type": "arrival",
                "confirmed": bool(n.get("confirmed")),
            }
        )
    return changes


def _collection_by_month(monthly: List[dict]) -> List[dict]:
    out = []
    for m in monthly:
        expected = _f(m.get("expected") or m.get("rent"))
        collected = _f(m.get("collected"))
        rate = round(collected / expected * 100, 1) if expected else 0.0
        out.append(
            {
                "month": int(m.get("month") or 0),
                "year": int(m.get("year") or 0),
                "expected": expected,
                "collected": collected,
                "late_count": int(m.get("lateCount") or m.get("late_count") or 0),
                "collection_rate_pct": rate,
            }
        )
    out.sort(key=lambda x: x["year"] * 100 + x["month"])
    return out


def _contract_gaps(active: List[dict], late: List[dict]) -> dict:
    missing_phone = []
    missing_contract = []
    for row in active + late:
        unit = row.get("unit") or "—"
        tenant = row.get("tenant") or "—"
        if not (row.get("phone") or "").strip():
            missing_phone.append({"unit": unit, "tenant": tenant})
        if not (row.get("contract") or "").strip():
            missing_contract.append({"unit": unit, "tenant": tenant})
    return {
        "missing_phone": missing_phone,
        "missing_contract": missing_contract,
    }


def build_property_knowledge(snapshot: dict, lang: Lang = "ar") -> dict:
    """Build structured property knowledge from any import snapshot."""
    snapshot = snapshot or {}
    lc = snapshot.get("lifecycle") or {}
    stats = snapshot.get("stats") or {}
    pb = snapshot.get("payment_board") or {}
    ann = snapshot.get("annual") or {}

    departed = lc.get("departed") or []
    active = lc.get("active") or []
    newcomers = lc.get("newcomers") or lc.get("newInLastMonth") or []

    late_raw = snapshot.get("late_tenants") or pb.get("lateTenants") or []
    late_tenants = [_normalize_late_tenant(x) for x in late_raw if x]

    collection = _collection_by_month(snapshot.get("monthly_breakdown") or [])
    tenant_changes = _detect_tenant_changes(departed, newcomers)

    units_needing_review = 0
    for w in snapshot.get("quality_log") or []:
        if "مراجعة" in str(w) or "review" in str(w).lower():
            units_needing_review += 1

    period_from = period_to = None
    if collection:
        period_from = _ml(collection[0]["month"], collection[0]["year"], lang)
        period_to = _ml(collection[-1]["month"], collection[-1]["year"], lang)

    return {
        "meta": {
            "source": snapshot.get("source"),
            "batch_id": snapshot.get("batch_id"),
            "lang": lang,
            "month_count": int(lc.get("monthCount") or lc.get("month_count") or len(collection)),
            "period_from": period_from,
            "period_to": period_to,
            "files_count": int(snapshot.get("files_count") or 0),
        },
        "units": {
            "total": int(stats.get("uniqueUnits") or stats.get("unique_units") or 0),
            "residential": int(stats.get("apartmentCount") or stats.get("apartment_count") or 0),
            "commercial": int(stats.get("shopCount") or stats.get("shop_count") or 0),
            "active_count": len(active),
            "needs_review_count": units_needing_review,
        },
        "collection": {
            "by_month": collection,
            "total_expected": _f(ann.get("totalExpected") or ann.get("total_expected")),
            "total_collected": _f(ann.get("totalCollected") or ann.get("total_collected")),
            "total_unpaid": _f(pb.get("totalUnpaidAllMonths") or pb.get("total_unpaid")),
        },
        "late": {
            "tenant_count": len(late_tenants),
            "tenants": late_tenants,
            "total_unpaid": sum(t["total_unpaid"] for t in late_tenants),
        },
        "lifecycle": {
            "departed_count": len(departed),
            "newcomers_count": len(newcomers),
            "tenant_changes": tenant_changes,
            "departed": departed[:50],
            "newcomers": newcomers[:50],
            "active": active[:100],
        },
        "contracts": _contract_gaps(active, late_tenants),
        "quality": {
            "warnings": list(snapshot.get("quality_log") or [])[:20],
            "parse_errors": list(snapshot.get("parse_errors") or [])[:10],
            "files_without_content": list(snapshot.get("files_without_content") or [])[:10],
            "merge_count": int(pb.get("mergeCount") or pb.get("merge_count") or 0),
        },
        "maintenance": {
            "entries": (snapshot.get("maintenance_log") or [])[:50],
            "total": sum(_f(x.get("amount")) for x in (snapshot.get("maintenance_log") or [])),
            "count": len(snapshot.get("maintenance_log") or []),
        },
        "files": list(snapshot.get("file_classifications") or [])[:20],
        "tenants": _build_tenant_cards(snapshot, lang),
        "ledger_quality": _ledger_quality(snapshot),
    }
