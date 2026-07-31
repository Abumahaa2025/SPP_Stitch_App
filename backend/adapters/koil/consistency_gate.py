"""Consistency Gate — block confident Koil risks/recs when facts conflict."""

from __future__ import annotations

from typing import Dict, List, Literal, Optional

Lang = Literal["ar", "en"]

CLASSIFICATION_MIN = 70
LATE_STATUSES = ("unpaid_confirmed", "partial", "unpaid")


def run_consistency_gate(
    deep: dict,
    knowledge: Optional[dict] = None,
    lang: Lang = "ar",
) -> dict:
    """Return decision_status ok | blocked_for_review with human-readable conflicts."""
    deep = deep or {}
    knowledge = knowledge or {}
    conflicts: List[dict] = []
    ar = lang == "ar"

    # 1) Classification confidence
    for fc in deep.get("file_classifications") or []:
        conf = int(fc.get("confidence") or 0)
        cat = fc.get("category") or ""
        if conf < CLASSIFICATION_MIN:
            conflicts.append(
                {
                    "code": "low_classification_confidence",
                    "file": fc.get("name"),
                    "detail": (
                        f"ثقة تصنيف منخفضة ({conf}%) لملف {fc.get('name')} → {cat}"
                        if ar
                        else f"Low classification confidence ({conf}%) for {fc.get('name')}"
                    ),
                }
            )

    # 2) No confirmed-paid month appears as overdue
    ledger = (deep.get("payment_ledger") or {}).get("ledger") or {}
    for ent in ledger.values():
        for m in ent.get("months") or []:
            raw = (m.get("pay_status_raw") or "").lower()
            status = m.get("status") or ""
            paid_markers = ("منص", "كاش", "بنك", "تحويل", "مسدد", "paid")
            if status in LATE_STATUSES and any(k in raw for k in paid_markers):
                conflicts.append(
                    {
                        "code": "paid_marked_overdue",
                        "unit": ent.get("unit"),
                        "detail": (
                            f"الوحدة {ent.get('unit')}: شهر {m.get('month')}/{m.get('year')} "
                            f"مدفوع في الكشف («{m.get('pay_status_raw')}») لكن حُسب متأخرًا"
                            if ar
                            else f"Unit {ent.get('unit')}: paid status marked overdue"
                        ),
                    }
                )

    # 3) Monthly summary totals vs payment ledger late totals
    late_by_month = deep.get("late_by_month") or {}
    ledger_unpaid = sum(float(e.get("total_unpaid") or 0) for e in ledger.values())
    board_total = float(late_by_month.get("grand_total") or 0)
    if ledger and abs(ledger_unpaid - board_total) > 1.0:
        conflicts.append(
            {
                "code": "ledger_board_mismatch",
                "detail": (
                    f"تعارض إجمالي المتأخرات: دفتر الدفعات {ledger_unpaid:,.0f} ≠ ملخص الأشهر {board_total:,.0f}"
                    if ar
                    else f"Late totals mismatch: ledger {ledger_unpaid:,.0f} vs board {board_total:,.0f}"
                ),
            }
        )

    # 4) Month comparison late_count vs ledger (soft — flag large gaps)
    month_cmp = deep.get("month_comparison") or []
    if not month_cmp:
        # portfolio may keep comparison elsewhere; skip if absent
        pass
    else:
        for mc in month_cmp:
            m = int(mc.get("month_num") or 0)
            if not m and isinstance(mc.get("month"), int):
                m = int(mc.get("month") or 0)
            y = int(mc.get("year") or 0)
            summary_late = int(mc.get("late_count") or 0)
            board_months = late_by_month.get("months") or []
            match = next(
                (
                    b
                    for b in board_months
                    if int(b.get("month") or 0) == m and (not y or int(b.get("year") or 0) == y)
                ),
                None,
            )
            board_late = int((match or {}).get("late_count") or 0)
            if match is not None and summary_late != board_late:
                conflicts.append(
                    {
                        "code": "monthly_summary_mismatch",
                        "detail": (
                            f"تعارض شهر {m}: ملخص {summary_late} متأخر ≠ دفتر {board_late}"
                            if ar
                            else f"Month {m} late count mismatch: summary {summary_late} vs ledger {board_late}"
                        ),
                    }
                )

    # 5) Identity: name-only flip in the same month with same contract/phone
    lc = deep.get("lifecycle") or {}
    for d in lc.get("departed") or []:
        unit = str(d.get("unit") or "")
        phone = (d.get("phone") or "").strip()
        contract = (d.get("contract") or "").strip()
        d_m = int(d.get("departed_month") or d.get("departedMonth") or 0)
        d_y = int(d.get("departed_year") or d.get("departedYear") or 0)
        for n in lc.get("newcomers") or []:
            if str(n.get("unit") or "") != unit:
                continue
            n_m = int(n.get("arrived_month") or n.get("arrivedMonth") or 0)
            n_y = int(n.get("arrived_year") or n.get("arrivedYear") or 0)
            if d_m != n_m or d_y != n_y:
                continue
            same_phone = phone and phone == (n.get("phone") or "").strip()
            same_contract = contract and contract == (n.get("contract") or "").strip()
            if same_phone or same_contract:
                conflicts.append(
                    {
                        "code": "false_tenant_turnover",
                        "unit": unit,
                        "detail": (
                            f"الوحدة {unit}: اعتُبر تغيّر مستأجر رغم تطابق العقد/الجوال "
                            f"({d.get('tenant')} ↔ {n.get('tenant')}) في {d_m}/{d_y}"
                            if ar
                            else f"Unit {unit}: false tenant change despite matching contract/phone"
                        ),
                    }
                )

    # Deduplicate by detail
    seen = set()
    uniq: List[dict] = []
    for c in conflicts:
        key = c.get("detail") or c.get("code")
        if key in seen:
            continue
        seen.add(key)
        uniq.append(c)

    # --- Gap 5: additional conflict detectors (additive) ---
    # These extend the existing gate without rewriting it. Each new detector
    # appends conflicts to `uniq` using the same {code, unit/detail} shape.

    # 6) Departed and active in the same period
    for d in (lc.get("departed") or []):
        unit = str(d.get("unit") or "")
        d_m = int(d.get("departed_month") or d.get("departedMonth") or 0)
        d_y = int(d.get("departed_year") or d.get("departedYear") or 0)
        for a in (lc.get("active") or []):
            if str(a.get("unit") or "") != unit:
                continue
            # If the same tenant appears as both departed and active.
            if d.get("tenant") and a.get("tenant") and d.get("tenant") == a.get("tenant"):
                detail = (
                    f"الوحدة {unit}: {d.get('tenant')} مُسجّل كمغادر ونشط في نفس الفترة"
                    if ar
                    else f"Unit {unit}: {d.get('tenant')} marked both departed and active"
                )
                if detail not in seen:
                    seen.add(detail)
                    uniq.append({"code": "departed_and_active", "unit": unit, "detail": detail})
                break

    # 7) Collected exceeds due without adjustment
    for ent in ledger.values():
        for m in ent.get("months") or []:
            due = float(m.get("due") or 0)
            paid = float(m.get("paid") or 0)
            if due > 0 and paid > due * 1.05:  # 5% tolerance
                detail = (
                    f"الوحدة {ent.get('unit')}: شهر {m.get('month')}/{m.get('year')} "
                    f"المحصّل ({paid:,.0f}) > المستحق ({due:,.0f})"
                    if ar
                    else f"Unit {ent.get('unit')}: collected {paid} exceeds due {due}"
                )
                if detail not in seen:
                    seen.add(detail)
                    uniq.append({"code": "collected_exceeds_due", "unit": ent.get("unit"), "detail": detail})

    # 8) Negative rent or maintenance values
    for ent in ledger.values():
        rent = float(ent.get("rent") or 0)
        if rent < 0:
            detail = (
                f"الوحدة {ent.get('unit')}: إيجار سالب ({rent})"
                if ar
                else f"Unit {ent.get('unit')}: negative rent ({rent})"
            )
            if detail not in seen:
                seen.add(detail)
                uniq.append({"code": "negative_value", "unit": ent.get("unit"), "detail": detail})
    for mr in (deep.get("maintenance_log") or []):
        amt = float(mr.get("amount") or 0)
        if amt < 0:
            detail = f"صيانة بقيمة سالبة ({amt}): {mr.get('description', '')}" if ar else f"Negative maintenance amount ({amt})"
            if detail not in seen:
                seen.add(detail)
                uniq.append({"code": "negative_value", "unit": mr.get("unit", ""), "detail": detail})

    # 9) Duplicate payment (same tenant+unit+month counted twice)
    month_seen: set = set()
    for ent in ledger.values():
        for m in ent.get("months") or []:
            mk = f"{ent.get('unit')}|{m.get('month')}|{m.get('year')}|{m.get('paid')}"
            if mk in month_seen and float(m.get("paid") or 0) > 0:
                detail = (
                    f"الوحدة {ent.get('unit')}: دفعة مكررة في شهر {m.get('month')}/{m.get('year')}"
                    if ar
                    else f"Unit {ent.get('unit')}: duplicate payment in month {m.get('month')}/{m.get('year')}"
                )
                if detail not in seen:
                    seen.add(detail)
                    uniq.append({"code": "duplicate_payment", "unit": ent.get("unit"), "detail": detail})
            month_seen.add(mk)

    # 10) Closed and open maintenance contradiction
    maint_entries = (knowledge.get("maintenance") or {}).get("entries") or []
    maint_by_desc: Dict[str, List[dict]] = {}
    for me in maint_entries:
        desc = str(me.get("description") or "")
        if desc:
            maint_by_desc.setdefault(desc, []).append(me)
    for desc, group in maint_by_desc.items():
        statuses = set(str(g.get("status") or "").lower() for g in group)
        if statuses & {"closed", "done", "مكتمل", "completed"} and statuses & {"open", "pending", "in_progress"}:
            unit = group[0].get("unit", "")
            detail = (
                f"الوحدة {unit}: صيانة «{desc}» مُسجّلة كمكتوبة ومفتوحة"
                if ar
                else f"Unit {unit}: maintenance '{desc}' marked both closed and open"
            )
            if detail not in seen:
                seen.add(detail)
                uniq.append({"code": "closed_and_open_maintenance", "unit": unit, "detail": detail})

    # 11) Expired and active contract simultaneously
    for c in (knowledge.get("lifecycle") or {}).get("active") or []:
        c_status = str(c.get("contract_status") or c.get("payment_status") or "").lower()
        if c_status in ("expired", "ended") and c.get("tenant"):
            unit = c.get("unit", "")
            detail = (
                f"الوحدة {unit}: عقد مُسجّل كمنتهي لكن المستأجر نشط"
                if ar
                else f"Unit {unit}: contract expired but tenant is active"
            )
            if detail not in seen:
                seen.add(detail)
                uniq.append({"code": "expired_and_active_contract", "unit": unit, "detail": detail})

    # 12) Filename-only lifecycle inference
    parsed_rolls = deep.get("parsed_rolls") or []
    has_real_content = any(int(pr.get("row_count") or 0) > 0 for pr in parsed_rolls)
    files_without = deep.get("files_without_content") or []
    if files_without and not has_real_content:
        detail = (
            "استنتاج دورة الحياة من أسماء الملفات فقط — لا يوجد محتوى"
            if ar
            else "Lifecycle inferred from filenames only — no file content"
        )
        if detail not in seen:
            seen.add(detail)
            uniq.append({"code": "filename_only_lifecycle", "detail": detail})

    status = "ok" if not uniq else "blocked_for_review"
    message = (
        "الاتساق سليم — يمكن إصدار مخاطر وتوصيات."
        if status == "ok" and ar
        else (
            "Consistency OK."
            if status == "ok"
            else (
                "كويل أوقف المخاطر/التوصيات حتى تُراجع التعارضات التالية:"
                if ar
                else "Koil blocked risks/recommendations pending review of conflicts:"
            )
        )
    )
    return {
        "decision_status": status,
        "message": message,
        "conflicts": uniq[:20],
        "conflict_count": len(uniq),
    }


def apply_gate_to_reasoning(reasoning: dict, gate: dict, lang: Lang = "ar") -> dict:
    """If blocked, replace risks/recs with explicit review items."""
    reasoning = dict(reasoning or {})
    if (gate or {}).get("decision_status") != "blocked_for_review":
        reasoning["decision_status"] = "ok"
        reasoning["consistency_gate"] = gate
        return reasoning

    ar = lang == "ar"
    conflicts = gate.get("conflicts") or []
    review_risks = [
        {
            "id": f"gate_{i}",
            "severity": "high",
            "text": c.get("detail") or c.get("code"),
            "evidence": [c.get("code") or "consistency_gate"],
            "confidence_level": "needs_review",
        }
        for i, c in enumerate(conflicts[:8])
    ]
    review_recs = [
        {
            "id": "rec_gate_review",
            "priority": "critical",
            "action": "راجع التعارضات قبل أي تحصيل أو إنذار" if ar else "Review conflicts before collection actions",
            "reason": gate.get("message") or "",
            "evidence": [c.get("detail") for c in conflicts[:5]],
            "action_key": "import:review",
            "confidence_level": "needs_review",
        }
    ]
    reasoning["decision_status"] = "blocked_for_review"
    reasoning["consistency_gate"] = gate
    reasoning["risks"] = review_risks
    reasoning["recommendations"] = review_recs
    reasoning["brief"] = gate.get("message") or reasoning.get("brief")
    return reasoning
