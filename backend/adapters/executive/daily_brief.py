"""Daily executive brief — what / why / outcome."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from adapters.mappers.brain_copy import fmt_money_ar, salutation_ar


def _owner_first_name(settings: Dict[str, Any]) -> str:
    for key in ("clientName", "propertyName"):
        raw = str(settings.get(key) or "").strip()
        if raw:
            return raw.split()[0]
    return ""


def _sum_impact(items: List[dict]) -> float:
    return sum(float(i.get("impact_aed") or 0) for i in items)


def build_daily_executive_brief(
    settings: Dict[str, Any],
    agenda: Dict[str, List[dict]],
    ranked_items: List[dict],
    opportunities: List[dict],
    unit_count: int,
    tenant_count: int,
    *,
    lifecycle: Optional[Dict[str, Any]] = None,
    normalized_lifecycle: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Daily executive brief — what / why / outcome.

    Gap 3: when a persisted ai_state lifecycle is provided (imported from
    upload analysis), turnover signals (departures / newcomers) are woven
    into the `what` and `why` narrative. Pre-Gap-3 behavior is fully
    preserved when lifecycle is None.

    Gap 3 (complete): when normalized_lifecycle is provided, late tenants
    + payment ledger + month comparison + annual stats are also woven
    into the narrative. The lifecycle provenance is attached to the
    response.
    """
    now = agenda.get("now") or []
    today = agenda.get("today") or []
    week = agenda.get("this_week") or []
    focus = now[:2] or today[:2] or week[:1]

    # Gap 3: extract lifecycle signals.
    departed_count = 0
    newcomers_count = 0
    if lifecycle and isinstance(lifecycle, dict):
        departed_count = int(lifecycle.get("departed_count") or len(lifecycle.get("departed") or []))
        newcomers_count = int(lifecycle.get("newcomers_count") or len(lifecycle.get("newcomers") or []))

    # Gap 3 (complete): extract normalized lifecycle signals.
    nl = normalized_lifecycle if isinstance(normalized_lifecycle, dict) else None
    late_count = 0
    mom_change: Optional[Dict[str, Any]] = None
    annual_stats: Dict[str, Any] = {}
    unresolved_count = 0
    if nl:
        nl_summary = nl.get("summary") or {}
        departed_count = int(nl_summary.get("departed_count") or departed_count)
        newcomers_count = int(nl_summary.get("newcomers_count") or newcomers_count)
        late_count = int(nl_summary.get("late_count") or 0)
        annual_stats = nl.get("annual_stats") or {}
        unresolved_count = len(nl.get("unresolved") or [])
        month_cmp = nl.get("month_comparison") or []
        if len(month_cmp) >= 2:
            last = month_cmp[-1]
            prev = month_cmp[-2]
            mom_change = {
                "prev_month": prev.get("month"),
                "cur_month": last.get("month"),
                "delta": last.get("delta_revenue"),
                "prev_collected": prev.get("collected"),
                "cur_collected": last.get("collected"),
            }

    if not focus:
        # Gap 3: even with no ranked decisions, if lifecycle has signals,
        # surface them so the owner sees imported turnover.
        # Gap 3 (complete): also surface late tenants + MoM change.
        signals = []
        if late_count:
            signals.append(f"{late_count} مستأجر متأخر")
        if departed_count or newcomers_count:
            signals.append(f"{departed_count} مغادرة و{newcomers_count} دخول")
        if mom_change:
            direction = "انخفاض" if (mom_change.get("delta") or 0) < 0 else "زيادة"
            signals.append(f"تحصيل {direction} {abs(mom_change.get('delta') or 0):,.0f}")
        if signals:
            what = f"راجع من آخر استيراد: {' · '.join(signals)}."
            why = (
                f"المحفظة ({unit_count} وحدة) لا قرارات عاجلة، لكن الكشوف "
                f"المستوردة رصدت إشارات — أكّد الهويات قبل التحصيل."
            )
            outcome = "تجنّب تحصيل من مستأجر مغادر أو خطأ في الهوية."
            brief: Dict[str, Any] = {
                "salutation": salutation_ar(),
                "owner_name": _owner_first_name(settings),
                "what": what.strip(),
                "why": why.strip(),
                "outcome": outcome.strip(),
                "focus_count": 0,
                "recoverable_aed": 0,
                # Gap 3: lifecycle provenance.
                "lifecycle_signals": {
                    "departed_count": departed_count,
                    "newcomers_count": newcomers_count,
                },
            }
            # Gap 3 (complete): extended provenance.
            if nl:
                brief["lifecycle_signals"].update({
                    "late_count": late_count,
                    "mom_change": mom_change,
                    "annual_stats": annual_stats,
                    "unresolved_count": unresolved_count,
                    "has_real_content": bool(nl.get("has_real_content", True)),
                })
            return brief
        return {
            "salutation": salutation_ar(),
            "owner_name": _owner_first_name(settings),
            "what": "لا قرارات عاجلة — راقب المحفظة واستغل الوقت للتخطيط.",
            "why": f"المحفظة ({unit_count} وحدة) مستقرة حالياً دون إجراء فوري.",
            "outcome": "تحافظ على التدفق النقدي وتتجنب تدخل غير ضروري.",
            "focus_count": 0,
            "recoverable_aed": 0,
        }

    actions = " · ".join(i.get("action", "") for i in focus[:3] if i.get("action"))
    titles = " · ".join(i.get("title", "") for i in focus[:3] if i.get("title"))
    recoverable = _sum_impact(now) + _sum_impact(today) * 0.5
    opp_hint = ""
    if opportunities:
        opp_hint = f" فرصة إضافية: {opportunities[0].get('title', '')}."

    # Gap 3: append lifecycle hint to `what` when signals exist.
    # Gap 3 (complete): also append late + MoM hints.
    lc_hints: List[str] = []
    if late_count:
        lc_hints.append(f"{late_count} متأخر")
    if departed_count or newcomers_count:
        lc_hints.append(f"{departed_count} مغادرة و{newcomers_count} دخول")
    if mom_change:
        direction = "انخفاض" if (mom_change.get("delta") or 0) < 0 else "زيادة"
        lc_hints.append(f"تحصيل {direction} {abs(mom_change.get('delta') or 0):,.0f}")
    lc_hint = (" · راجع من الاستيراد: " + " · ".join(lc_hints) + ".") if lc_hints else ""

    what = f"ابدأ بـ {len(now) or len(today)} إجراءً: {actions or titles}.{lc_hint}"
    why = (
        f"هذه العناصر الأعلى تأثيراً على {unit_count} وحدة و{tenant_count} مستأجر"
        f" — مرتبة حسب المال والعقد والصحة.{opp_hint}"
    )
    outcome = (
        f"تتوقع استعادة أو حماية ≈ {fmt_money_ar(recoverable)} ريال "
        f"عند إغلاق قائمة اليوم."
    )

    brief: Dict[str, Any] = {
        "salutation": salutation_ar(),
        "owner_name": _owner_first_name(settings),
        "what": what.strip(),
        "why": why.strip(),
        "outcome": outcome.strip(),
        "focus_count": len(now) + len(today),
        "recoverable_aed": round(recoverable),
    }
    # Gap 3: attach lifecycle provenance when signals exist.
    if departed_count or newcomers_count or late_count or mom_change:
        brief["lifecycle_signals"] = {
            "departed_count": departed_count,
            "newcomers_count": newcomers_count,
        }
        # Gap 3 (complete): extended provenance.
        if nl:
            brief["lifecycle_signals"].update({
                "late_count": late_count,
                "mom_change": mom_change,
                "annual_stats": annual_stats,
                "unresolved_count": unresolved_count,
                "has_real_content": bool(nl.get("has_real_content", True)),
            })
    return brief
