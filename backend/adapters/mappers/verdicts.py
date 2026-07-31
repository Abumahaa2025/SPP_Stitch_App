"""Dynamic Brain Verdicts from live Sheets-mapped portfolio data."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from adapters.mappers.brain_copy import (
    contract_renewal_action,
    contract_renewal_guidance,
    contract_sort_key,
    days_until,
    decision_action_ar,
    decision_detail_ar,
    decision_title_ar,
    fmt_money_ar,
    renewal_headline,
    sanitize_brain_text,
)

_PRIORITY = {"critical": 0, "high": 1, "medium": 2, "low": 3}


def _sorted_decisions(decisions: List[dict], kind: Optional[str] = None) -> List[dict]:
    rows = [d for d in decisions if not kind or d.get("kind") == kind]
    return sorted(rows, key=lambda d: _PRIORITY.get(d.get("priority", "low"), 9))


def _weakest(properties: List[dict]) -> Optional[dict]:
    return min(properties, key=lambda p: p.get("health_score", 100)) if properties else None


def _strongest_revenue(properties: List[dict]) -> Optional[dict]:
    return max(properties, key=lambda p: p.get("monthly_revenue", 0)) if properties else None


def _property_map(properties: List[dict]) -> Dict[str, dict]:
    return {p["id"]: p for p in properties if p.get("id")}


def _tenant_map(tenants: List[dict]) -> Dict[str, dict]:
    return {t["id"]: t for t in tenants if t.get("id")}


def _expiring_contracts(contracts: List[dict]) -> List[dict]:
    rows = [c for c in contracts if c.get("status") == "expiring"]
    rows.sort(key=lambda c: contract_sort_key(c.get("end", "")))
    return rows


def _verdict(headline: str, why: str, action: str, route: str) -> Dict[str, str]:
    return {
        "headline": sanitize_brain_text(headline),
        "why": sanitize_brain_text(why),
        "action": sanitize_brain_text(action),
        "route": route,
    }


def _tenant_name(tenant_id: str, tenants: Dict[str, dict]) -> str:
    tenant = tenants.get(tenant_id) or {}
    return str(tenant.get("name") or tenant.get("unit") or "")


def _property_label(prop_id: str, props: Dict[str, dict]) -> str:
    prop = props.get(prop_id) or {}
    return str(prop.get("name") or prop.get("address") or "الوحدة")


def _trim_action(decision: dict) -> str:
    text = decision_action_ar(decision)
    clean = " ".join(text.split())
    if len(clean) <= 120:
        return clean or "راجع التفاصيل"
    return clean[:119].rstrip() + "…"


def build_verdicts(
    properties: List[dict],
    tenants: List[dict],
    contracts: List[dict],
    decisions: List[dict],
    reports: List[dict],
    notifications: List[dict],
    *,
    lifecycle: Optional[Dict[str, Any]] = None,
    normalized_lifecycle: Optional[Dict[str, Any]] = None,
    unified_smart_decisions: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Optional[Dict[str, str]]]:
    """One recommendation per surface — derived only from live domain rows.

    Gap 3: when a persisted ai_state lifecycle is provided (imported from
    upload analysis), surface departures / newcomers / tenant_changes in
    the relevant verdicts (home, tenants, portfolio). Pre-Gap-3 behavior
    is fully preserved when lifecycle is None.

    Gap 3 (complete): when normalized_lifecycle is provided, add evidence
    fields to verdicts that have lifecycle backing:
        tenant, unit, previous_period, current_period,
        evidence_source, confidence
    These fields are additive — placed inside the relevant verdict object
    without changing the existing {headline, why, action, route} shape.
    """
    props_by_id = _property_map(properties)
    tenants_by_id = _tenant_map(tenants)
    ranked = _sorted_decisions(decisions)
    urgent = [d for d in ranked if d.get("priority") in ("critical", "high")]
    maintenance = _sorted_decisions(decisions, "maintenance")
    financial = _sorted_decisions(decisions, "financial")
    tenant_decisions = _sorted_decisions(decisions, "tenant")
    expiring = _expiring_contracts(contracts)
    weakest = _weakest(properties)
    top_rev = _strongest_revenue(properties)
    vacant = [p for p in properties if p.get("occupancy", 0) < 0.5]
    critical_props = [p for p in properties if p.get("health_score", 100) < 80]
    notif_ranked = sorted(
        notifications,
        key=lambda n: _PRIORITY.get(n.get("priority", "medium"), 9),
    )

    # --- Gap 3: extract lifecycle signals from persisted ai_state ---
    # When an import has been applied, lifecycle contains departed / newcomers /
    # tenant_changes detected by intake_lifecycle.build_lifecycle(). These
    # signals are NOT visible in contracts[].status (which only knows
    # "expiring") — surfacing them in verdicts closes Gap 3.
    #
    # Gap 3 (complete): when normalized_lifecycle is provided, use it as
    # the authoritative source. It takes precedence over the legacy
    # property_knowledge.lifecycle arg, and adds late_tenants + payment
    # ledger evidence to the verdicts.
    lc_departed: List[dict] = []
    lc_newcomers: List[dict] = []
    lc_changes: List[dict] = []
    lc_late_tenants: List[dict] = []
    lc_reporting_period: Dict[str, Any] = {}
    nl = normalized_lifecycle if isinstance(normalized_lifecycle, dict) else None
    if nl:
        lc_departed = list(nl.get("departed") or [])[:5]
        lc_newcomers = list(nl.get("newcomers") or [])[:5]
        lc_changes = list(nl.get("tenant_changes") or [])[:5]
        lc_late_tenants = list(nl.get("late_tenants") or [])[:5]
        lc_reporting_period = nl.get("reporting_period") or {}
        # Gap 3 (complete): when has_real_content is False (filename-only
        # upload), force all lifecycle event lists empty — no verdicts
        # should be generated from filename-only imports.
        if not nl.get("has_real_content", True):
            lc_departed = []
            lc_newcomers = []
            lc_changes = []
            lc_late_tenants = []
    elif lifecycle and isinstance(lifecycle, dict):
        lc_departed = list(lifecycle.get("departed") or [])[:5]
        lc_newcomers = list(lifecycle.get("newcomers") or [])[:5]
        lc_changes = list(lifecycle.get("tenant_changes") or [])[:5]

    # Gap 3 (complete): helper to attach evidence fields to a verdict.
    def _with_evidence(
        verdict: Optional[Dict[str, Any]],
        *,
        tenant: Optional[str] = None,
        unit: Optional[str] = None,
        previous_period: Optional[Dict[str, Any]] = None,
        current_period: Optional[Dict[str, Any]] = None,
        evidence_source: str = "normalized_lifecycle",
        confidence: int = 70,
    ) -> Optional[Dict[str, Any]]:
        """Attach additive evidence fields to a verdict without changing
        its existing {headline, why, action, route} shape."""
        if verdict is None:
            return None
        verdict["tenant"] = tenant
        verdict["unit"] = unit
        verdict["previous_period"] = previous_period
        verdict["current_period"] = current_period
        verdict["evidence_source"] = evidence_source
        verdict["confidence"] = confidence
        return verdict

    out: Dict[str, Optional[Dict[str, str]]] = {}

    # Gap 4: when unified_smart_decisions is provided, attach the top
    # unified decision id to the home verdict so the same operational
    # event keeps the same id across /api/decisions, /api/executive,
    # /api/briefing, /api/verdicts.
    _unified_top_id = None
    if unified_smart_decisions:
        for ud in unified_smart_decisions:
            if not ud.get("blocked_by_gate", False):
                _unified_top_id = ud.get("id")
                break
        if _unified_top_id is None and unified_smart_decisions:
            _unified_top_id = unified_smart_decisions[0].get("id")

    if len(urgent) >= 2:
        a, b = urgent[0], urgent[1]
        out["home"] = _verdict(
            headline=f"عالج {len(urgent)} قرارات عاجلة الآن.",
            why=f"ابدأ بـ {decision_title_ar(a)} ثم {decision_title_ar(b)}.",
            action=_trim_action(a),
            route="/",
        )
    elif urgent:
        d = urgent[0]
        out["home"] = _verdict(
            headline=decision_title_ar(d),
            why=decision_detail_ar(d, contracts),
            action=_trim_action(d),
            route="/maintenance" if d.get("kind") == "maintenance" else "/",
        )
    elif expiring:
        c = expiring[0]
        name = _tenant_name(c.get("tenant_id", ""), tenants_by_id)
        subject = name or _property_label(c.get("property_id", ""), props_by_id)
        end_days = days_until(c.get("end", ""))
        out["home"] = _verdict(
            headline=renewal_headline(subject, end_days),
            why=contract_renewal_guidance(end_days),
            action=contract_renewal_action(end_days),
            route="/contracts",
        )
    elif properties:
        occ = round(100 * sum(p.get("occupancy", 0) for p in properties) / len(properties))
        # Gap 3: when no urgent decisions but lifecycle shows tenant changes,
        # surface them as the home verdict. This is the only way the owner
        # sees imported turnover signals on the home screen.
        # Gap 3 (complete): also surface late tenants from normalized_lifecycle.
        if lc_late_tenants and nl:
            # Late tenant evidence takes precedence (more actionable than turnover).
            lt = lc_late_tenants[0]
            out["home"] = _verdict(
                headline=f"تواصل مع {lt.get('tenant', '—')} — متأخر {lt.get('late_month_count', 0)} شهر.",
                why=f"متأخرات مؤكدة على الوحدة {lt.get('unit', '—')} · {float(lt.get('total_unpaid') or 0):,.0f} ر.س.",
                action=f"أرسل تذكير دفع إلى {lt.get('tenant', '—')} اليوم.",
                route="/tenants",
            )
            # Gap 3 (complete): attach evidence fields.
            _with_evidence(
                out["home"],
                tenant=lt.get("tenant"),
                unit=lt.get("unit"),
                current_period=lc_reporting_period,
                evidence_source="normalized_lifecycle.late_tenants",
                confidence=88,
            )
        elif lc_departed or lc_newcomers:
            dep_n = len(lc_departed)
            new_n = len(lc_newcomers)
            headline = f"راجع {dep_n} مغادرة و{new_n} دخول من آخر استيراد."
            why_parts = []
            ev_tenant = None
            ev_unit = None
            if lc_departed:
                d = lc_departed[0]
                ev_tenant = d.get("tenant")
                ev_unit = d.get("unit")
                why_parts.append(
                    f"غادر: {d.get('tenant', '—')} (وحدة {d.get('unit', '—')})"
                )
            if lc_newcomers:
                n = lc_newcomers[0]
                if not ev_tenant:
                    ev_tenant = n.get("tenant")
                    ev_unit = n.get("unit")
                why_parts.append(
                    f"دخل: {n.get('tenant', '—')} (وحدة {n.get('unit', '—')})"
                )
            out["home"] = _verdict(
                headline=headline,
                why=" · ".join(why_parts) + " — أكّد الهويات والجوال قبل التحصيل.",
                action="راجع الكشوف المستوردة",
                route="/tenants",
            )
            # Gap 3 (complete): attach evidence fields.
            _with_evidence(
                out["home"],
                tenant=ev_tenant,
                unit=ev_unit,
                current_period=lc_reporting_period,
                evidence_source="normalized_lifecycle.departed_newcomers",
                confidence=75,
            )
        else:
            out["home"] = _verdict(
                headline="لا قرارات عاجلة اليوم.",
                why=f"راقب الإشغال عند {occ}% — المحفظة مستقرة.",
                action="راجع المحفظة",
                route="/portfolio",
            )
    else:
        out["home"] = None

    # Gap 4: attach the unified decision id to the home verdict so callers
    # can cross-reference /api/decisions, /api/executive, /api/briefing.
    if _unified_top_id and out.get("home"):
        out["home"]["unified_decision_id"] = _unified_top_id

    if weakest:
        out["portfolio"] = _verdict(
            headline=f"عالج {weakest.get('name')} أولاً.",
            why="الصحة الأضعف في المحفظة — راجع التحصيل أو الصيانة قبل بقية الوحدات.",
            action="افتح الوحدة واتخذ قراراً",
            route=f"/property/{weakest['id']}",
        )
    else:
        out["portfolio"] = None

    renewal_focus = next(
        (c for c in expiring if (days_until(c.get("end", "")) or 999) <= 30),
        None,
    )
    if renewal_focus:
        name = _tenant_name(renewal_focus.get("tenant_id", ""), tenants_by_id)
        unit = _property_label(renewal_focus.get("property_id", ""), props_by_id)
        end_days = days_until(renewal_focus.get("end", ""))
        subject = name or unit
        out["insights"] = _verdict(
            headline=renewal_headline(subject, end_days),
            why=contract_renewal_guidance(end_days),
            action=contract_renewal_action(end_days),
            route="/contracts",
        )
    elif top_rev and properties:
        out["insights"] = _verdict(
            headline=f"راجع تسعير {top_rev.get('name')}.",
            why="أعلى وحدة إيراداً — تحقق من إمكانية رفع الإيجار أو تجديد العقد.",
            action="افتح التحليلات",
            route="/insights",
        )
    elif reports:
        r = reports[0]
        out["insights"] = _verdict(
            headline=str(r.get("title") or "تقرير المحفظة"),
            why=str(r.get("highlight") or r.get("subtitle") or ""),
            action="افتح التقارير",
            route="/reports",
        )
    else:
        out["insights"] = None

    if weakest and weakest.get("health_score", 100) < 85:
        linked = next((d for d in ranked if d.get("property_id") == weakest.get("id")), None)
        why = decision_detail_ar(linked, contracts) if linked else ""
        if not why:
            why = "الصحة منخفضة — خطّط لتدخل خلال الأسبوع."
        out["health"] = _verdict(
            headline=f"عالج {weakest.get('name')} أولاً.",
            why=why,
            action="افتح الصحة واتخذ قراراً",
            route="/health",
        )
    elif properties:
        out["health"] = _verdict(
            headline="الصحة العامة مقبولة.",
            why=f"لا حاجة لتدخل عاجل — راقب {len(critical_props)} وحدة تحت المستهدف.",
            action="اعرض الترتيب",
            route="/health",
        )
    else:
        out["health"] = None

    if maintenance:
        m = maintenance[0]
        out["maintenance"] = _verdict(
            headline=decision_title_ar(m),
            why=decision_detail_ar(m, contracts),
            action=_trim_action(m),
            route="/maintenance",
        )
    else:
        out["maintenance"] = None

    low_health = sorted(critical_props, key=lambda p: p.get("health_score", 0))[:2]
    if low_health:
        names = "، ".join(p.get("name", "") for p in low_health)
        out["sensors"] = _verdict(
            headline=f"راجع {len(low_health)} وحدة ضعيفة الإشارة.",
            why=f"{names} — خطّط لتدخل قبل تفاقم المشكلة.",
            action="راجع الصحة",
            route="/health",
        )
    else:
        out["sensors"] = None

    renewal_tenant = None
    renewal_days: Optional[int] = None
    if expiring:
        c = expiring[0]
        renewal_tenant = tenants_by_id.get(c.get("tenant_id", ""))
        renewal_days = days_until(c.get("end", ""))
    if not renewal_tenant and tenants:
        renewal_tenant = min(tenants, key=lambda t: t.get("reliability", 100))
    if renewal_tenant:
        why = contract_renewal_guidance(renewal_days) if renewal_days is not None else (
            "راجع ملف المستأجر وخطّط للتجديد."
        )
        out["tenants"] = _verdict(
            headline=f"تواصل مع {renewal_tenant.get('name')} بخصوص التجديد.",
            why=why,
            action=contract_renewal_action(renewal_days) if renewal_days is not None else (
                "جهّز عرض التجديد"
            ),
            route="/tenants",
        )
    elif lc_changes:
        # Gap 3: no expiring contracts, but the import detected tenant
        # changes (departures / arrivals / replacements). Surface the
        # most recent one as the tenants verdict.
        ch = lc_changes[0]
        unit = ch.get("unit", "—")
        from_t = ch.get("from_tenant") or "—"
        to_t = ch.get("to_tenant") or "—"
        ch_type = ch.get("type") or "change"
        ch_confirmed = bool(ch.get("confirmed"))
        type_label = {
            "departure": "مغادرة",
            "arrival": "دخول",
            "replacement": "استبدال",
        }.get(ch_type, "تغيّر")
        out["tenants"] = _verdict(
            headline=f"{type_label} على الوحدة {unit} — راجع الملف.",
            why=f"من {from_t} إلى {to_t} — أكّد الهوية والجوال قبل أي تحصيل.",
            action="افتح ملف المستأجر وراجع العقد",
            route="/tenants",
        )
        # Gap 3 (complete): attach evidence fields to tenants verdict.
        _with_evidence(
            out["tenants"],
            tenant=to_t if to_t != "—" else from_t,
            unit=unit if unit != "—" else None,
            current_period=lc_reporting_period,
            evidence_source="normalized_lifecycle.tenant_changes",
            confidence=75 if ch_confirmed else 45,
        )
    elif lc_late_tenants and nl:
        # Gap 3 (complete): no renewal + no tenant_changes, but there are
        # late tenants from the import — surface the top one as tenants verdict.
        lt = lc_late_tenants[0]
        out["tenants"] = _verdict(
            headline=f"تواصل مع {lt.get('tenant', '—')} بخصوص المتأخرات.",
            why=f"متأخر {lt.get('late_month_count', 0)} شهر · {float(lt.get('total_unpaid') or 0):,.0f} ر.س على الوحدة {lt.get('unit', '—')}.",
            action=f"أرسل تذكير دفع إلى {lt.get('tenant', '—')} اليوم.",
            route="/tenants",
        )
        _with_evidence(
            out["tenants"],
            tenant=lt.get("tenant"),
            unit=lt.get("unit"),
            current_period=lc_reporting_period,
            evidence_source="normalized_lifecycle.late_tenants",
            confidence=88,
        )
    else:
        out["tenants"] = None

    if expiring:
        c = expiring[0]
        name = _tenant_name(c.get("tenant_id", ""), tenants_by_id)
        unit = _property_label(c.get("property_id", ""), props_by_id)
        end_days = days_until(c.get("end", ""))
        subject = name or unit
        out["contracts"] = _verdict(
            headline=renewal_headline(subject, end_days),
            why=contract_renewal_guidance(end_days),
            action=contract_renewal_action(end_days),
            route="/contracts",
        )
    else:
        out["contracts"] = None

    if notif_ranked:
        n = notif_ranked[0]
        out["notifications"] = _verdict(
            headline=str(n.get("title") or "تنبيه"),
            why=str(n.get("body") or ""),
            action="افتح الإشعارات",
            route="/notifications",
        )
    elif financial:
        f = financial[0]
        out["notifications"] = _verdict(
            headline=decision_title_ar(f),
            why=decision_detail_ar(f, contracts),
            action=_trim_action(f),
            route="/",
        )
    else:
        out["notifications"] = None

    if reports:
        r = reports[0]
        out["reports"] = _verdict(
            headline=str(r.get("title") or "تقرير جاهز"),
            why=str(r.get("highlight") or r.get("subtitle") or ""),
            action="اقرأ التقرير",
            route="/reports",
        )
    else:
        out["reports"] = None

    if tenant_decisions:
        t = tenant_decisions[0]
        out["knowledge"] = _verdict(
            headline=decision_title_ar(t),
            why=decision_detail_ar(t, contracts),
            action=_trim_action(t),
            route="/contracts",
        )
    else:
        out["knowledge"] = None

    if vacant:
        out["guides"] = _verdict(
            headline=f"{len(vacant)} وحدة شاغرة تحتاج تسويق.",
            why="، ".join(p.get("name", "") for p in vacant[:3]),
            action="افتح المحفظة",
            route="/portfolio",
        )
    else:
        out["guides"] = None

    if properties:
        out["owner"] = _verdict(
            headline="راجع أولويات المحفظة.",
            why=(
                f"{'عالج ' + str(len(urgent)) + ' قراراً عاجلاً' if urgent else 'لا قرارات عاجلة'} · "
                f"{'راجع ' + str(len(expiring)) + ' تجديداً' if expiring else 'التجديدات تحت السيطرة'}."
            ),
            action="افتح لوحة المالك",
            route="/owner",
        )
    else:
        out["owner"] = None

    # Gap D: Ensure ALL non-None verdicts have the 7 required traceability fields.
    # evidence_source and unified_decision_id are added here (gate adds the rest).
    # verdicts that already have these fields (from lifecycle branches) are not overwritten.
    for vkey, v in out.items():
        if not isinstance(v, dict):
            continue
        v.setdefault("evidence_source", "legacy")
        v.setdefault("unified_decision_id", _unified_top_id)

    return out
