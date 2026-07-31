"""Map Koil reasoning → executive report sections + smart decisions."""

from __future__ import annotations

import re
from typing import Any, Dict, List, Literal, Optional

Lang = Literal["ar", "en"]


def humanize_evidence(evidence: Optional[List[Any]], lang: Lang = "ar") -> List[str]:
    """Turn technical tokens into property-manager language for the owner."""
    ar = lang == "ar"
    out: List[str] = []
    for raw in evidence or []:
        s = str(raw).strip()
        if not s:
            continue
        # Already human Arabic source lines
        if s.startswith("المصدر:") or s.lower().startswith("source:"):
            out.append(s)
            continue
        s = re.sub(r"\bunit=([^\s,|]+)", r"الوحدة \1" if ar else r"unit \1", s, flags=re.I)
        s = re.sub(r"\btenant=([^\s,|]+)", r"المستأجر \1" if ar else r"tenant \1", s, flags=re.I)
        s = re.sub(
            r"\bmonth=(\d{1,2})/(\d{4})",
            lambda m: f"شهر {m.group(1)}/{m.group(2)}" if ar else f"month {m.group(1)}/{m.group(2)}",
            s,
            flags=re.I,
        )
        s = re.sub(r"\bconsecutive=\d+", "", s, flags=re.I)
        s = re.sub(r"\bfrom=([^\s,|]+)", r"من \1" if ar else r"from \1", s, flags=re.I)
        s = re.sub(r"\bto=([^\s,|]+)", r"إلى \1" if ar else r"to \1", s, flags=re.I)
        s = re.sub(r"\bdeparted=\d+", "", s, flags=re.I)
        s = re.sub(r"[·|]{2,}", "·", s)
        s = re.sub(r"\s{2,}", " ", s).strip(" ·|")
        if s:
            out.append(s)
    return out[:8]


def _fmt_evidence(evidence: Optional[List[Any]], lang: Lang = "ar") -> str:
    parts = humanize_evidence(evidence, lang)
    if not parts:
        return ""
    prefix = "المصدر" if lang == "ar" else "Source"
    return f"{prefix}: " + " · ".join(parts[:6])


def _item(label: str, value: str, evidence: Optional[List[Any]] = None, lang: Lang = "ar") -> dict:
    ev_list = humanize_evidence(evidence, lang)
    display = value
    ev_line = _fmt_evidence(ev_list, lang)
    if ev_line:
        display = f"{value}\n{ev_line}"
    out: Dict[str, Any] = {"label": label, "value": display}
    if ev_list:
        out["evidence"] = ev_list[:8]
    return out


def _sec(key: str, title: str, items: List[dict], summary: str = "") -> dict:
    out: Dict[str, Any] = {"key": key, "title": title, "items": items}
    if summary:
        out["summary"] = summary
    return out


def _confidence_level(score: float, gate_status: str, lang: Lang) -> str:
    ar = lang == "ar"
    if gate_status == "blocked_for_review":
        return "يحتاج مراجعتك" if ar else "Needs your review"
    if score >= 85:
        return "مؤكد" if ar else "Confirmed"
    if score >= 70:
        return "مرجح" if ar else "Likely"
    return "يحتاج مراجعتك" if ar else "Needs your review"


def _status_tier(
    late_n: int,
    unpaid: float,
    rate: float,
    gate_blocked: bool,
    review_n: int,
) -> str:
    """جيدة | تحتاج متابعة | حرجة — owner-facing only."""
    if gate_blocked:
        return "تحتاج متابعة"
    if late_n >= 5 or unpaid >= 30_000 or (rate and rate < 70):
        return "حرجة"
    if late_n >= 1 or unpaid > 0 or review_n >= 2 or (rate and rate < 85):
        return "تحتاج متابعة"
    return "جيدة"


def build_executive_brief(
    knowledge: dict,
    reasoning: dict,
    gate: Optional[dict] = None,
    lang: Lang = "ar",
    metrics: Optional[dict] = None,
) -> dict:
    """Owner decision brief — Property Knowledge only. No client-specific rules."""
    knowledge = knowledge or {}
    reasoning = reasoning or {}
    gate = gate or {}
    metrics = metrics or {}
    ar = lang == "ar"

    units = knowledge.get("units") or {}
    late = knowledge.get("late") or {}
    coll = knowledge.get("collection") or {}
    maint = knowledge.get("maintenance") or {}
    lc = knowledge.get("lifecycle") or {}
    meta = knowledge.get("meta") or {}
    quality = knowledge.get("quality") or {}
    contracts = knowledge.get("contracts") or {}

    total_units = int(units.get("total") or metrics.get("units") or 0)
    active = int(units.get("active_count") or metrics.get("occupied_units") or 0)
    occupancy = (
        round(float(metrics.get("occupancy_pct") or 0))
        if metrics.get("occupancy_pct") is not None
        else (round(active / total_units * 100) if total_units else 0)
    )
    late_n = int(late.get("tenant_count") or metrics.get("late_tenants") or 0)
    unpaid = float(late.get("total_unpaid") or coll.get("total_unpaid") or metrics.get("late_value") or 0)
    collected = float(coll.get("total_collected") or metrics.get("collected") or 0)
    expected = float(coll.get("total_expected") or metrics.get("total_revenue_annual") or 0)
    rate = int(metrics.get("collection_rate_pct") or 0) or (
        round(collected / expected * 100) if expected else 0
    )
    maint_total = float(maint.get("total") or metrics.get("total_expenses") or 0)
    maint_count = int(maint.get("count") or len(maint.get("entries") or []) or 0)
    expired_n = int(metrics.get("contracts_expired") or 0)
    expiring_n = int(metrics.get("contracts_expiring_soon") or 0)

    period = ""
    if meta.get("period_from") and meta.get("period_to"):
        period = f"{meta['period_from']} → {meta['period_to']}"

    gate_blocked = gate.get("decision_status") == "blocked_for_review"
    lq = knowledge.get("ledger_quality") or {}
    collection_ok = bool(lq.get("collection_recs_allowed", False)) if lq else False
    unknown_n = int(lq.get("unknown_month_count") or 0)

    # --- Critical confirmed arrears (facts — never hidden by collection gate) ---
    late_tenants = list(late.get("tenants") or [])
    critical_tenants = sorted(
        late_tenants,
        key=lambda t: (-int(t.get("consecutive_late") or t.get("late_month_count") or 0), -float(t.get("total_unpaid") or 0)),
    )
    critical_names: List[str] = []
    for lt in critical_tenants[:3]:
        if (int(lt.get("consecutive_late") or lt.get("late_month_count") or 0) >= 2) or float(lt.get("total_unpaid") or 0) >= 3000:
            critical_names.append(
                f"{lt.get('tenant') or '—'} (وحدة {lt.get('unit') or '—'} · {float(lt.get('total_unpaid') or 0):,.0f})"
                if ar
                else f"{lt.get('tenant') or '—'} (unit {lt.get('unit') or '—'} · {float(lt.get('total_unpaid') or 0):,.0f})"
            )
    if late_n and not critical_names and critical_tenants:
        # Always surface at least the top confirmed case as a fact (not outreach).
        lt = critical_tenants[0]
        critical_names.append(
            f"{lt.get('tenant') or '—'} (وحدة {lt.get('unit') or '—'} · {float(lt.get('total_unpaid') or 0):,.0f})"
            if ar
            else f"{lt.get('tenant') or '—'} (unit {lt.get('unit') or '—'} · {float(lt.get('total_unpaid') or 0):,.0f})"
        )

    arrears_block = {
        "count": late_n,
        "total": round(unpaid, 2),
        "critical_names": critical_names,
        "label": (
            f"متأخرات مؤكدة: {late_n} مستأجر · {unpaid:,.0f} ر.س"
            if late_n
            else ("لا متأخرات مؤكدة" if ar else "No confirmed arrears")
        )
        if ar
        else (
            f"Confirmed arrears: {late_n} · {unpaid:,.0f}"
            if late_n
            else "No confirmed arrears"
        ),
    }

    # --- Occupancy moves (confirmed clear switches only) ---
    confirmed_out: List[str] = []
    confirmed_in: List[str] = []
    confirmed_replacements: List[str] = []
    for ch in lc.get("tenant_changes") or []:
        if not ch.get("confirmed"):
            continue
        unit = ch.get("unit") or "—"
        if ch.get("type") == "departure" and ch.get("from_tenant"):
            confirmed_out.append(f"{ch.get('from_tenant')} (وحدة {unit})" if ar else f"{ch.get('from_tenant')} (unit {unit})")
        elif ch.get("type") == "arrival" and ch.get("to_tenant"):
            confirmed_in.append(f"{ch.get('to_tenant')} (وحدة {unit})" if ar else f"{ch.get('to_tenant')} (unit {unit})")
        elif ch.get("type") == "replacement":
            confirmed_replacements.append(
                f"{ch.get('from_tenant') or '—'} → {ch.get('to_tenant') or '—'} (وحدة {unit})"
                if ar
                else f"{ch.get('from_tenant') or '—'} → {ch.get('to_tenant') or '—'} (unit {unit})"
            )

    # --- Manager answers (< 1 minute) ---
    what_happened_parts: List[str] = []
    if period:
        what_happened_parts.append(
            f"خلال {period}: {total_units} وحدة · إشغال {occupancy}% · تحصيل {rate}%."
            if ar
            else f"Over {period}: {total_units} units · occupancy {occupancy}% · collection {rate}%."
        )
    else:
        what_happened_parts.append(
            f"{total_units} وحدة · إشغال {occupancy}% · تحصيل {rate}%."
            if ar
            else f"{total_units} units · occupancy {occupancy}% · collection {rate}%."
        )
    if expected:
        what_happened_parts.append(
            f"المحصّل {collected:,.0f} من أصل {expected:,.0f} ر.س."
            if ar
            else f"Collected {collected:,.0f} of {expected:,.0f}."
        )
    if late_n:
        what_happened_parts.append(arrears_block["label"])
    elif unknown_n:
        what_happened_parts.append(
            f"لا متأخرات مؤكدة — لكن {unknown_n} شهر سداد غير واضح."
            if ar
            else f"No confirmed arrears — {unknown_n} unclear payment months."
        )
    if maint_count:
        what_happened_parts.append(
            f"صيانة/مصروفات: {maint_count} سجل · {maint_total:,.0f} ر.س."
            if ar
            else f"Maintenance: {maint_count} · {maint_total:,.0f}."
        )
    what_happened = " ".join(what_happened_parts)

    move_n = len(confirmed_out) + len(confirmed_in) + len(confirmed_replacements)
    if move_n:
        what_changed = (
            f"تغيّر إشغال مؤكد: {len(confirmed_replacements)} استبدال · {len(confirmed_out)} خروج · {len(confirmed_in)} دخول."
            if ar
            else f"Confirmed moves: {len(confirmed_replacements)} replacements · {len(confirmed_out)} exits · {len(confirmed_in)} arrivals."
        )
    else:
        what_changed = (
            "لا تغيّر إشغال مؤكد (اختلاف الأسماء وحده لا يُحسب خروجًا)."
            if ar
            else "No confirmed occupancy change (name spelling alone is not a move)."
        )

    who_left = (
        ("خرج: " + " · ".join(confirmed_out[:5]))
        if confirmed_out
        else (("استبدال: " + " · ".join(confirmed_replacements[:4])) if confirmed_replacements else ("لا خروج مؤكد." if ar else "No confirmed exit."))
    ) if ar else (
        ("Left: " + " · ".join(confirmed_out[:5]))
        if confirmed_out
        else (("Replaced: " + " · ".join(confirmed_replacements[:4])) if confirmed_replacements else "No confirmed exit.")
    )
    who_entered = (
        ("دخل: " + " · ".join(confirmed_in[:5]))
        if confirmed_in
        else (("استبدال إلى: " + " · ".join((ch.split("→")[-1].strip() for ch in confirmed_replacements[:4]))) if confirmed_replacements else ("لا دخول مؤكد." if ar else "No confirmed arrival."))
    ) if ar else (
        ("Entered: " + " · ".join(confirmed_in[:5]))
        if confirmed_in
        else "No confirmed arrival."
    )

    if late_n:
        biggest_problem = arrears_block["label"]
        if critical_names:
            biggest_problem += (" — الحرجة: " if ar else " — critical: ") + " · ".join(critical_names)
        if unknown_n:
            biggest_problem += (
                f" · ملاحظة: {unknown_n} شهر غير واضح يمنع توصيات التحصيل الآلية"
                if ar
                else f" · note: {unknown_n} unclear months block auto collection advice"
            )
    elif unknown_n:
        biggest_problem = (
            f"حالات سداد غير واضحة ({unknown_n} شهرًا) — لا توصيات تحصيل حتى تتضح"
            if ar
            else f"Unclear payment months ({unknown_n}) — no collection advice yet"
        )
    elif gate_blocked:
        biggest_problem = "تعارض بيانات يمنع قرارات آلية" if ar else "Data conflicts block automated decisions"
    elif maint_total >= 10000:
        biggest_problem = f"مصروفات صيانة مرتفعة: {maint_total:,.0f} ر.س" if ar else f"High maintenance: {maint_total:,.0f}"
    else:
        biggest_problem = "لا مشكلة تشغيلية حرجة مؤكدة الآن" if ar else "No confirmed critical operating issue"

    # --- Needs review ---
    needs_review: List[str] = []
    if unknown_n:
        needs_review.append(
            f"وضّح {unknown_n} شهر سداد غير واضح قبل أي تواصل تحصيل"
            if ar
            else f"Clarify {unknown_n} unclear payment months before any collection outreach"
        )
    for c in (gate.get("conflicts") or [])[:2]:
        if c.get("detail"):
            needs_review.append(str(c["detail"]))
    if late_n and not collection_ok:
        needs_review.append(
            f"راجع حالات المتأخرين المؤكدين ({late_n}) يدويًا — لا تواصل آلي حتى يكتمل الدفتر"
            if ar
            else f"Review {late_n} confirmed late cases manually — no auto outreach until ledger is clear"
        )
    for row in (contracts.get("missing_phone") or [])[:2]:
        needs_review.append(
            f"الوحدة {row.get('unit')}: الجوال ناقص"
            if ar
            else f"Unit {row.get('unit')}: missing phone"
        )
    seen: set = set()
    uniq_review: List[str] = []
    for line in needs_review:
        if line in seen:
            continue
        seen.add(line)
        uniq_review.append(line)
    needs_review = uniq_review[:5]
    if not needs_review:
        needs_review = ["لا يوجد ما يحتاج مراجعتك الآن" if ar else "Nothing needs your review now"]

    status_label = _status_tier(
        late_n,
        unpaid,
        float(rate),
        gate_blocked or (not collection_ok and late_n == 0),
        len([x for x in needs_review if "لا يوجد" not in x and "Nothing" not in x]),
    )
    if ar:
        if late_n:
            property_status = f"حالة العقار: {status_label} — {arrears_block['label']}."
            if not collection_ok:
                property_status += " توصيات التحصيل الآلية متوقفة حتى تتضح الأشهر غير الواضحة."
        elif not collection_ok:
            property_status = "حالة العقار: تحتاج متابعة — دفتر الدفعات فيه أشهر غير واضحة؛ لا متأخرات مؤكدة للعرض كتحصيل."
        elif gate_blocked:
            property_status = "حالة العقار: تحتاج متابعة — تعارض في البيانات."
        else:
            property_status = {
                "جيدة": f"حالة العقار: جيدة — التحصيل {rate}% ولا ضغط تحصيل مؤكد.",
                "تحتاج متابعة": f"حالة العقار: تحتاج متابعة — راقب الأرقام والمراجعات.",
                "حرجة": f"حالة العقار: حرجة — أولوية المراجعة قبل أي قرار آخر.",
            }.get(status_label, f"حالة العقار: {status_label}.")
        if period:
            property_status = f"{property_status} ({period})"
    else:
        property_status = f"Status: {status_label}" + (f" — {arrears_block['label']}" if late_n else "") + (f" ({period})" if period else "")

    # --- Actions today (3–5): facts first; outreach only if collection_ok ---
    actions: List[str] = []
    if not collection_ok and unknown_n:
        actions.append(
            "راجع الأشهر ذات حالة السداد غير الواضحة قبل أي تحصيل"
            if ar
            else "Review unclear payment months before any collection"
        )
    if late_n:
        if collection_ok:
            for name in critical_names[:2]:
                actions.append(
                    f"تابع التحصيل مع: {name}"
                    if ar
                    else f"Follow up collection with: {name}"
                )
        else:
            actions.append(
                f"اطّلع على المتأخرات المؤكدة ({late_n} · {unpaid:,.0f} ر.س) دون تواصل آلي"
                if ar
                else f"Review confirmed arrears ({late_n} · {unpaid:,.0f}) without auto outreach"
            )
    if confirmed_replacements or confirmed_out or confirmed_in:
        actions.append(
            f"أكد تغييرات الإشغال ({move_n} حالة مؤكدة)"
            if ar
            else f"Confirm occupancy moves ({move_n} confirmed)"
        )
    if expiring_n or expired_n:
        actions.append(
            f"راجع العقود ({expired_n} منتهية · {expiring_n} قريبة)"
            if ar
            else f"Review contracts ({expired_n} expired · {expiring_n} expiring)"
        )
    if maint_count > 0 and maint_total > 0 and len(actions) < 5:
        actions.append(
            f"راجع الصيانة ({maint_count} · {maint_total:,.0f} ر.س)"
            if ar
            else f"Review maintenance ({maint_count} · {maint_total:,.0f})"
        )
    for r in sorted(
        reasoning.get("recommendations") or [],
        key=lambda x: {"critical": 0, "high": 1, "medium": 2, "low": 3}.get(str(x.get("priority") or "medium"), 9),
    ):
        if "whatsapp" in (r.get("action_key") or "") and not collection_ok:
            continue
        action = (r.get("action") or "").strip()
        if action and action not in actions:
            actions.append(action)
        if len(actions) >= 5:
            break
    actions = actions[:5]
    if not actions:
        actions = ["لا إجراء عاجل — راقب الأرقام فقط" if ar else "No urgent action — monitor figures only"]

    story_lines = [what_happened, what_changed, biggest_problem]
    if critical_names:
        story_lines.append(("الحالات الحرجة: " if ar else "Critical cases: ") + " · ".join(critical_names))

    props_n = int(metrics.get("properties") or 0)
    tenants_n = int(metrics.get("tenants") or len(knowledge.get("tenants") or []) or 0)
    contracts_n = int(
        metrics.get("contracts")
        or metrics.get("contracts_count")
        or len(lc.get("active") or [])
        or tenants_n
        or 0
    )
    rents_n = float(metrics.get("rents") or expected or 0)
    remaining_n = float(metrics.get("remaining") or max(0.0, expected - collected))
    missing_phone_n = len(contracts.get("missing_phone") or [])
    missing_contract_n = len(contracts.get("missing_contract") or [])
    gaps_n = missing_phone_n + missing_contract_n + unknown_n

    key_numbers = [
        {"label": "العقارات" if ar else "Properties", "value": str(props_n)},
        {"label": "الوحدات" if ar else "Units", "value": str(total_units or "—")},
        {"label": "المستأجرون" if ar else "Tenants", "value": str(tenants_n)},
        {"label": "العقود" if ar else "Contracts", "value": str(contracts_n)},
        {
            "label": "الإيجارات" if ar else "Rents",
            "value": f"{rents_n:,.0f} ر.س" if ar else f"{rents_n:,.0f} SAR",
        },
        {
            "label": "المحصل" if ar else "Collected",
            "value": f"{collected:,.0f} ر.س" if ar else f"{collected:,.0f} SAR",
        },
        {
            "label": "المتبقي" if ar else "Remaining",
            "value": f"{remaining_n:,.0f} ر.س" if ar else f"{remaining_n:,.0f} SAR",
        },
        {
            "label": "المتأخرون" if ar else "Late tenants",
            "value": str(late_n),
        },
        {
            "label": "عقود منتهية / قريبة" if ar else "Expired / expiring",
            "value": f"{expired_n} / {expiring_n}",
        },
        {
            "label": "النواقص" if ar else "Gaps",
            "value": str(gaps_n),
        },
    ]

    conf = float(reasoning.get("confidence") or 80)
    if gate_blocked or not collection_ok:
        conf = min(conf, 65)
    gate_status = str(gate.get("decision_status") or "ok")
    level = _confidence_level(conf, "blocked_for_review" if not collection_ok else gate_status, lang)

    return {
        "title": "تقرير كويل التنفيذي" if ar else "Koil executive report",
        "status_label": status_label,
        "property_status": property_status,
        "story": story_lines,
        "what_happened": what_happened,
        "what_changed": what_changed,
        "who_left": who_left,
        "who_entered": who_entered,
        "biggest_problem": biggest_problem,
        "top_decision": actions[0],
        "decisions_today": actions,
        "actions_today": actions,
        "arrears": arrears_block,
        "critical_cases": critical_names,
        # Live engine snapshots for the in-app upload path (not a static UI stub).
        "engines": {
            "collection": {
                "rate_pct": rate,
                "collected": round(collected, 2),
                "expected": round(expected, 2),
                "remaining": round(remaining_n, 2),
            },
            "late": {
                "tenant_count": late_n,
                "total_unpaid": round(unpaid, 2),
                "critical_names": critical_names,
            },
            "lifecycle": {
                "departed_count": int(metrics.get("departed_count") or len(lc.get("departed") or [])),
                "newcomers_count": int(metrics.get("newcomers_count") or len(lc.get("newcomers") or [])),
                "confirmed_moves": move_n,
                "who_left": who_left,
                "who_entered": who_entered,
                "replacements": confirmed_replacements[:8],
            },
            "maintenance": {"count": maint_count, "total": round(maint_total, 2)},
            "contracts": {
                "count": contracts_n,
                "expired": expired_n,
                "expiring_soon": expiring_n,
                "missing_phone": missing_phone_n,
                "missing_contract": missing_contract_n,
            },
            "quality": {"warning_count": len(quality.get("warnings") or [])},
            "tenant_cards": {"count": len(knowledge.get("tenants") or [])},
            "ledger_quality": {
                "unknown_month_count": unknown_n,
                "collection_recs_allowed": collection_ok,
            },
            "gaps": {
                "missing_phone": missing_phone_n,
                "missing_contract": missing_contract_n,
                "unknown_month_count": unknown_n,
                "total": gaps_n,
            },
        },
        "key_numbers": key_numbers,
        "needs_review": needs_review,
        "confidence": conf,
        "confidence_level": level,
        "decision_status": gate_status,
        "collection_recs_allowed": collection_ok,
        "period": period,
        "top_risk": biggest_problem,
        "top_action": actions[0],
        "meta": {
            "properties": props_n,
            "units": total_units,
            "tenants": tenants_n,
            "contracts": contracts_n,
            "rents": round(rents_n, 2),
            "collected": round(collected, 2),
            "remaining": round(remaining_n, 2),
            "occupancy_pct": occupancy,
            "late_tenants": late_n,
            "late_total": unpaid,
            "maintenance_count": maint_count,
            "maintenance_total": maint_total,
            "collection_rate_pct": rate,
            "contracts_expired": expired_n,
            "contracts_expiring_soon": expiring_n,
            "missing_phone": missing_phone_n,
            "missing_contract": missing_contract_n,
            "gaps": gaps_n,
            "unknown_month_count": unknown_n,
            "confirmed_moves": move_n,
        },
    }


def enrich_metrics_for_summary(
    metrics: Optional[dict],
    knowledge: Optional[dict] = None,
) -> dict:
    """Additive metrics fields for the unified owner summary screen (no UI contract break)."""
    m = dict(metrics or {})
    knowledge = knowledge or {}
    lc = knowledge.get("lifecycle") or {}
    contracts = knowledge.get("contracts") or {}
    maint = knowledge.get("maintenance") or {}
    active = list(lc.get("active") or [])
    tenants_pk = list(knowledge.get("tenants") or [])

    missing_phone = len(contracts.get("missing_phone") or [])
    missing_contract = len(contracts.get("missing_contract") or [])
    unknown_n = int((knowledge.get("ledger_quality") or {}).get("unknown_month_count") or 0)

    if m.get("contracts") is None and m.get("contracts_count") is None:
        m["contracts"] = len(active) or int(m.get("tenants") or len(tenants_pk) or 0)
    m.setdefault("contracts_count", int(m.get("contracts") or 0))

    if m.get("rents") is None:
        m["rents"] = float(m.get("total_revenue_annual") or 0)

    # Upload without prior portfolio still implies one property once units exist
    # (matches Apply materialisation and GAS stats default).
    if int(m.get("properties") or 0) == 0 and int(m.get("units") or 0) > 0:
        m["properties"] = 1

    if m.get("maintenance_count") is None and "count" in maint:
        m["maintenance_count"] = int(maint.get("count") or 0)
    if m.get("maintenance_total") is None and "total" in maint:
        m["maintenance_total"] = float(maint.get("total") or 0)
    if m.get("maintenance_open") is None and m.get("maintenance_count") is not None:
        m["maintenance_open"] = int(m.get("maintenance_count") or 0)

    # Recompute gaps only when knowledge carries gap sources; otherwise keep
    # already-enriched metrics (build_unified_summary may re-enter without PK).
    has_gap_source = bool(contracts) or "ledger_quality" in knowledge
    if has_gap_source:
        m["missing_phone"] = missing_phone
        m["missing_contract"] = missing_contract
        m["gaps"] = missing_phone + missing_contract + unknown_n
    else:
        m.setdefault("missing_phone", int(m.get("missing_phone") or 0))
        m.setdefault("missing_contract", int(m.get("missing_contract") or 0))
        if m.get("gaps") is None:
            m["gaps"] = int(m["missing_phone"]) + int(m["missing_contract"])
    return m


def _first_present_int(*vals: object, default: int = 0) -> int:
    for v in vals:
        if v is not None:
            try:
                return int(v)
            except (TypeError, ValueError):
                continue
    return default


def _first_present_float(*vals: object, default: float = 0.0) -> float:
    for v in vals:
        if v is not None:
            try:
                return float(v)
            except (TypeError, ValueError):
                continue
    return default


def _derive_data_status(
    *,
    knowledge: dict,
    brief: dict,
    gate: Optional[dict],
    gaps: int,
) -> dict:
    """Map real gate/ledger/quality signals — never invent demo statuses."""
    gate = gate or {}
    lq = knowledge.get("ledger_quality") or {}
    quality = knowledge.get("quality") or {}
    units_info = knowledge.get("units") or {}

    conflict_count = _first_present_int(
        gate.get("conflict_count"),
        len(gate.get("conflicts") or []) if gate.get("conflicts") is not None else None,
    )
    decision_status = str(gate.get("decision_status") or brief.get("decision_status") or "ok")
    unknown_months = _first_present_int(lq.get("unknown_month_count"))
    parse_errors = len(quality.get("parse_errors") or [])
    unread_files = len(quality.get("files_without_content") or [])
    units_review = _first_present_int(units_info.get("needs_review_count"))
    quality_warnings = len(quality.get("warnings") or [])
    ledger_trust = str(lq.get("ledger_trust") or ("needs_review" if unknown_months else "ok"))

    conflicting_n = conflict_count
    if decision_status == "blocked_for_review" and conflicting_n == 0:
        conflicting_n = 1
    incomplete_n = unknown_months + parse_errors + unread_files + int(gaps or 0)
    needs_review_n = units_review + quality_warnings + (1 if ledger_trust == "needs_review" else 0)
    if brief.get("collection_recs_allowed") is False and unknown_months == 0:
        needs_review_n += 1

    confirmed_late = _first_present_int(lq.get("confirmed_late_month_count"))
    paid_months = _first_present_int(lq.get("paid_month_count"))
    confirmed_n = paid_months + confirmed_late

    if conflicting_n > 0 or decision_status == "blocked_for_review":
        overall = "conflicting"
    elif incomplete_n > 0:
        overall = "incomplete"
    elif needs_review_n > 0:
        overall = "needs_review"
    else:
        overall = "confirmed"

    return {
        "overall": overall,
        "decision_status": decision_status,
        "ledger_trust": ledger_trust,
        "confirmed": confirmed_n,
        "needs_review": needs_review_n,
        "incomplete": incomplete_n,
        "conflicting": conflicting_n,
        "conflict_count": conflict_count,
        "unknown_month_count": unknown_months,
        "units_needs_review": units_review,
        "parse_errors": parse_errors,
        "files_without_content": unread_files,
        "quality_warnings": quality_warnings,
        "collection_recs_allowed": bool(
            lq.get("collection_recs_allowed")
            if lq.get("collection_recs_allowed") is not None
            else brief.get("collection_recs_allowed", True)
        ),
    }


def build_unified_summary(
    metrics: Optional[dict] = None,
    knowledge: Optional[dict] = None,
    brief: Optional[dict] = None,
    consistency_gate: Optional[dict] = None,
    executive_report: Optional[dict] = None,
) -> dict:
    """Official unified summary contract — real analysis numbers only (no demo)."""
    knowledge = knowledge or {}
    m = enrich_metrics_for_summary(metrics, knowledge)
    brief = brief or {}
    eng = brief.get("engines") or {}
    meta = brief.get("meta") or {}
    lq = knowledge.get("ledger_quality") or {}
    maint = knowledge.get("maintenance") or {}
    report = executive_report or {}

    properties = _first_present_int(m.get("properties"), meta.get("properties"))
    units = _first_present_int(m.get("units"), meta.get("units"))
    tenants = _first_present_int(m.get("tenants"), meta.get("tenants"))
    contracts = _first_present_int(m.get("contracts"), m.get("contracts_count"), meta.get("contracts"))
    rents = _first_present_float(m.get("rents"), meta.get("rents"), m.get("total_revenue_annual"))
    collected = _first_present_float(
        m.get("collected"), meta.get("collected"), (eng.get("collection") or {}).get("collected")
    )
    remaining = _first_present_float(
        m.get("remaining"),
        meta.get("remaining"),
        (eng.get("collection") or {}).get("remaining"),
        default=max(0.0, rents - collected),
    )
    late_tenants = _first_present_int(
        m.get("late_tenants"), meta.get("late_tenants"), (eng.get("late") or {}).get("tenant_count")
    )
    late_value = _first_present_float(
        m.get("late_value"), meta.get("late_total"), (eng.get("late") or {}).get("total_unpaid")
    )
    expired = _first_present_int(
        m.get("contracts_expired"), meta.get("contracts_expired"), (eng.get("contracts") or {}).get("expired")
    )
    expiring = _first_present_int(
        m.get("contracts_expiring_soon"),
        meta.get("contracts_expiring_soon"),
        (eng.get("contracts") or {}).get("expiring_soon"),
    )
    missing_phone = _first_present_int(
        m.get("missing_phone"), meta.get("missing_phone"), (eng.get("gaps") or {}).get("missing_phone")
    )
    missing_contract = _first_present_int(
        m.get("missing_contract"), meta.get("missing_contract"), (eng.get("gaps") or {}).get("missing_contract")
    )
    unknown_months = _first_present_int(
        lq.get("unknown_month_count"), meta.get("unknown_month_count"), (eng.get("gaps") or {}).get("unknown_month_count")
    )
    gaps = _first_present_int(
        m.get("gaps"),
        meta.get("gaps"),
        (eng.get("gaps") or {}).get("total"),
        default=missing_phone + missing_contract + unknown_months,
    )
    paid_months = _first_present_int(lq.get("paid_month_count"))
    payment_month_rows = _first_present_int(lq.get("total_month_rows"))
    confirmed_late_months = _first_present_int(lq.get("confirmed_late_month_count"))
    months_linked = _first_present_int(m.get("months_linked"))
    files_analyzed = _first_present_int(m.get("files_analyzed"))
    maintenance_count = _first_present_int(
        m.get("maintenance_count"), meta.get("maintenance_count"), maint.get("count"), (eng.get("maintenance") or {}).get("count")
    )
    maintenance_total = _first_present_float(
        m.get("maintenance_total"),
        meta.get("maintenance_total"),
        maint.get("total"),
        (eng.get("maintenance") or {}).get("total"),
        m.get("total_expenses"),
    )
    maintenance_open = _first_present_int(m.get("maintenance_open"), maintenance_count)
    section_count = len(report.get("sections") or [])
    occupancy = _first_present_float(m.get("occupancy_pct"), meta.get("occupancy_pct"))
    collection_rate = _first_present_int(m.get("collection_rate_pct"), meta.get("collection_rate_pct"))
    data_status = _derive_data_status(knowledge=knowledge, brief=brief, gate=consistency_gate, gaps=gaps)

    payments = {
        "collected": round(collected, 2),
        "remaining": round(remaining, 2),
        "expected": round(rents, 2),
        "collection_rate_pct": collection_rate,
        "months_linked": months_linked,
        "paid_month_count": paid_months,
        "payment_month_rows": payment_month_rows,
        "confirmed_late_month_count": confirmed_late_months,
    }
    arrears = {
        "late_tenants": late_tenants,
        "late_value": round(late_value, 2),
        "confirmed_late_month_count": confirmed_late_months,
    }
    maintenance = {
        "count": maintenance_count,
        "total": round(maintenance_total, 2),
        "open": maintenance_open,
    }
    reports = {
        "files_analyzed": files_analyzed,
        "months_linked": months_linked,
        "executive_ready": bool(brief.get("title") or section_count),
        "section_count": section_count,
        "count": 1 if (brief.get("title") or section_count) else 0,
    }
    gaps_detail = {
        "total": gaps,
        "missing_phone": missing_phone,
        "missing_contract": missing_contract,
        "unknown_month_count": unknown_months,
    }

    return {
        # Flat core — stable contract for summary / Apply / future OS foundation
        "properties": properties,
        "units": units,
        "tenants": tenants,
        "contracts": contracts,
        "rents": round(rents, 2),
        "collected": round(collected, 2),
        "remaining": round(remaining, 2),
        "late_tenants": late_tenants,
        "late_value": round(late_value, 2),
        "contracts_expired": expired,
        "contracts_expiring_soon": expiring,
        "missing_phone": missing_phone,
        "missing_contract": missing_contract,
        "gaps": gaps,
        "occupancy_pct": occupancy,
        "collection_rate_pct": collection_rate,
        "period": brief.get("period") or "",
        "files_analyzed": files_analyzed,
        "months_linked": months_linked,
        "maintenance_count": maintenance_count,
        "maintenance_total": round(maintenance_total, 2),
        "maintenance_open": maintenance_open,
        "paid_month_count": paid_months,
        "payment_month_rows": payment_month_rows,
        # Nested foundation blocks (same numbers — structured for OS builders)
        "payments": payments,
        "arrears": arrears,
        "maintenance": maintenance,
        "reports": reports,
        "gaps_detail": gaps_detail,
        "data_status": data_status,
    }


def _labels(lang: Lang) -> dict:
    if lang == "ar":
        return {
            "koil_brief": "كويل — الملخص التنفيذي",
            "koil_what": "ماذا حدث؟",
            "koil_why": "لماذا استنتجت ذلك؟",
            "koil_risks": "المخاطر حسب الأولوية",
            "koil_recommendations": "التوصيات العملية",
        }
    return {
        "koil_brief": "Koil — Executive brief",
        "koil_what": "What happened?",
        "koil_why": "Why did I conclude that?",
        "koil_risks": "Risks by priority",
        "koil_recommendations": "Practical recommendations",
    }


_SEV_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3}
_SEV_AR = {
    "critical": "حرج",
    "high": "مرتفع",
    "medium": "متوسط",
    "low": "منخفض",
}
_PRI_AR = {
    "critical": "حرج",
    "high": "مهم",
    "medium": "متوسط",
    "low": "لاحقاً",
    "urgent": "عاجل",
}


def koil_sections(reasoning: dict, lang: Lang = "ar") -> List[dict]:
    reasoning = reasoning or {}
    labels = _labels(lang)
    sections: List[dict] = []

    brief_items = [
        _item("كويل" if lang == "ar" else "Koil", reasoning.get("brief") or "—", lang=lang),
        _item(
            "ثقة الاستنتاج" if lang == "ar" else "Reasoning confidence",
            f"{reasoning.get('confidence', '—')}%",
            lang=lang,
        ),
    ]
    sections.append(_sec("koil_brief", labels["koil_brief"], brief_items))

    what_items = [
        _item(
            f"#{i + 1}",
            f.get("text") or "—",
            evidence=f.get("evidence"),
            lang=lang,
        )
        for i, f in enumerate(reasoning.get("what_happened") or [])
    ] or [_item("—", "—", lang=lang)]
    sections.append(_sec("koil_what", labels["koil_what"], what_items))

    why_items = [
        _item(
            f"#{i + 1}",
            f.get("text") or "—",
            evidence=f.get("evidence"),
            lang=lang,
        )
        for i, f in enumerate(reasoning.get("why") or [])
    ] or [
        _item(
            "—",
            "لا أسباب إضافية مكتشفة" if lang == "ar" else "No additional causes",
            lang=lang,
        )
    ]
    sections.append(_sec("koil_why", labels["koil_why"], why_items))

    risks = sorted(
        reasoning.get("risks") or [],
        key=lambda r: _SEV_ORDER.get(str(r.get("severity") or "medium"), 9),
    )
    risk_items = []
    for r in risks:
        sev = str(r.get("severity") or "—")
        sev_label = _SEV_AR.get(sev, sev) if lang == "ar" else sev
        risk_items.append(
            _item(
                f"[{sev_label}]",
                r.get("text") or "—",
                evidence=r.get("evidence"),
                lang=lang,
            )
        )
    if not risk_items:
        risk_items = [_item("—", "—", lang=lang)]
    sections.append(_sec("koil_risks", labels["koil_risks"], risk_items))

    recs = sorted(
        reasoning.get("recommendations") or [],
        key=lambda r: _SEV_ORDER.get(str(r.get("priority") or "medium"), 9),
    )
    rec_items = []
    for r in recs:
        pri = str(r.get("priority") or "—")
        pri_label = _PRI_AR.get(pri, pri) if lang == "ar" else pri
        action = r.get("action") or "—"
        reason = r.get("reason") or ""
        text = action if not reason else f"{action} — {reason}"
        rec_items.append(
            _item(
                f"[{pri_label}]",
                text,
                evidence=r.get("evidence"),
                lang=lang,
            )
        )
    if not rec_items:
        rec_items = [_item("—", "—", lang=lang)]
    sections.append(_sec("koil_recommendations", labels["koil_recommendations"], rec_items))

    return sections


def apply_koil_to_executive_report(
    executive_report: dict,
    reasoning: dict,
    lang: Lang = "ar",
    insert_after_keys: tuple = (
        "koil_understanding_ambiguities",
        "koil_understanding_relationships",
        "koil_understanding_files",
        "koil_understanding_summary",
        "files",
    ),
) -> dict:
    """Insert Koil reasoning sections into executive report (after understanding)."""
    executive_report = dict(executive_report or {})
    sections = list(executive_report.get("sections") or [])
    koil = koil_sections(reasoning, lang)

    insert_idx = 0
    for key in insert_after_keys:
        for i, sec in enumerate(sections):
            if sec.get("key") == key:
                insert_idx = max(insert_idx, i + 1)

    for i, ks in enumerate(koil):
        sections.insert(insert_idx + i, ks)

    executive_report["sections"] = sections
    return executive_report


def understanding_sections(understanding: dict, lang: Lang = "ar") -> List[dict]:
    understanding = understanding or {}
    if lang == "ar":
        titles = {
            "summary": "كويل — ماذا فهمت من الملفات؟",
            "files": "فهم كل ملف",
            "relationships": "كيف ربطت الأشهر؟",
            "ambiguities": "ما يحتاج مراجعتك",
        }
        mode_label = "وضع الفهم"
    else:
        titles = {
            "summary": "Koil — What I understood from the files",
            "files": "Per-file understanding",
            "relationships": "How months link",
            "ambiguities": "Needs your review",
        }
        mode_label = "Understanding mode"

    sections: List[dict] = []
    mode = understanding.get("mode") or "rules"
    mode_ar = (
        "ذكاء معزّز"
        if mode == "ai_enhanced" and lang == "ar"
        else ("AI enhanced" if mode == "ai_enhanced" else ("قواعد" if lang == "ar" else "Rules"))
    )

    summary_items = [
        _item("كويل" if lang == "ar" else "Koil", understanding.get("portfolio_summary") or "—", lang=lang),
        _item(mode_label, mode_ar, lang=lang),
        _item(
            "ثقة الفهم" if lang == "ar" else "Understanding confidence",
            f"{understanding.get('confidence', '—')}%",
            lang=lang,
        ),
    ]
    sections.append(_sec("koil_understanding_summary", titles["summary"], summary_items))

    file_items = []
    for f in understanding.get("files") or []:
        notes = " · ".join(f.get("notes") or []) or "—"
        file_items.append(
            _item(
                f.get("name") or "—",
                f"{f.get('understood_as') or '—'} ({f.get('confidence', '—')}%)",
                evidence=[notes] if notes and notes != "—" else None,
                lang=lang,
            )
        )
    if not file_items:
        file_items = [_item("—", "—", lang=lang)]
    sections.append(_sec("koil_understanding_files", titles["files"], file_items[:8]))

    rel_items = [
        _item(
            f"#{i + 1}",
            r.get("text") or "—",
            evidence=r.get("evidence"),
            lang=lang,
        )
        for i, r in enumerate(understanding.get("relationships") or [])
    ] or [
        _item(
            "—",
            "لا علاقات إضافية" if lang == "ar" else "No extra relationships",
            lang=lang,
        )
    ]
    sections.append(_sec("koil_understanding_relationships", titles["relationships"], rel_items[:8]))

    amb_items = [
        _item(
            "!" if a.get("needs_review") else "·",
            a.get("text") or "—",
            lang=lang,
        )
        for a in (understanding.get("ambiguities") or [])
    ] or [
        _item(
            "—",
            "لا غموض — جاهز للمراجعة" if lang == "ar" else "Clear — ready to review",
            lang=lang,
        )
    ]
    sections.append(_sec("koil_understanding_ambiguities", titles["ambiguities"], amb_items[:8]))

    return sections


def apply_understanding_to_executive_report(
    executive_report: dict,
    understanding: dict,
    lang: Lang = "ar",
    insert_before_key: str = "files",
) -> dict:
    """Place file-understanding block at the top of the report (before raw file list)."""
    executive_report = dict(executive_report or {})
    sections = list(executive_report.get("sections") or [])
    block = understanding_sections(understanding, lang)

    insert_idx = 0
    for i, sec in enumerate(sections):
        if sec.get("key") == insert_before_key:
            insert_idx = i
            break

    for i, us in enumerate(block):
        sections.insert(insert_idx + i, us)

    executive_report["sections"] = sections
    return executive_report


def reasoning_to_smart_decisions(reasoning: dict, lang: Lang = "ar") -> List[dict]:
    """Map Koil recommendations → smart_decisions for existing app UI."""
    out: List[dict] = []
    recs = sorted(
        reasoning.get("recommendations") or [],
        key=lambda r: _SEV_ORDER.get(str(r.get("priority") or "medium"), 9),
    )
    for r in recs:
        pri = r.get("priority") or "medium"
        if pri == "critical":
            sp = "critical"
        elif pri in ("high", "urgent"):
            sp = "high"
        elif pri == "medium":
            sp = "medium"
        else:
            sp = "low"
        evidence = [str(x) for x in (r.get("evidence") or []) if str(x).strip()]
        action = r.get("reason") or ""
        if evidence:
            prefix = "دليل" if lang == "ar" else "Evidence"
            action = f"{action} · {prefix}: " + " · ".join(evidence[:4]) if action else f"{prefix}: " + " · ".join(evidence[:4])
        out.append(
            {
                "id": r.get("id") or f"koil_{len(out)}",
                "priority": sp,
                "title": r.get("action") or "—",
                "action": action,
            }
        )
    return out[:8]
