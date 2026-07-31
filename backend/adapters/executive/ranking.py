"""Decision ranking engine — scores portfolio actions by business impact."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from adapters.mappers.brain_copy import (
    contract_renewal_action,
    contract_renewal_guidance,
    days_until,
    decision_action_ar,
    decision_detail_ar,
    decision_title_ar,
    fmt_money_ar,
)

_PRIORITY_SCORE = {"critical": 100, "high": 75, "medium": 50, "low": 25}

_TIER_EMOJI = {
    "now": "🔴",
    "today": "🟠",
    "week": "🟡",
    "follow_up": "🟢",
}


def _urgency_from_days(days: Optional[int]) -> float:
    if days is None:
        return 35.0
    if days < 0:
        return 100.0
    if days == 0:
        return 95.0
    if days <= 7:
        return 85.0
    if days <= 30:
        return 70.0
    if days <= 60:
        return 45.0
    return 20.0


def _contract_status_score(days: Optional[int], status: str) -> float:
    if days is not None and days < 0:
        return 100.0
    if status == "expiring" or (days is not None and days <= 30):
        return 80.0
    if status == "renewed":
        return 30.0
    return 15.0


def _health_risk_score(health: Optional[int]) -> float:
    if health is None:
        return 40.0
    return max(0.0, min(100.0, 100 - health))


def _financial_score(rent: float, max_rent: float) -> float:
    if max_rent <= 0:
        return 50.0
    return min(100.0, 100.0 * rent / max_rent)


def score_item(
    *,
    urgency: float,
    financial: float,
    contract: float,
    health_risk: float,
    priority: float,
    weights: Optional[Dict[str, float]] = None,
) -> float:
    w = weights or {
        "urgency": 0.30,
        "financial": 0.25,
        "contract": 0.20,
        "health": 0.10,
        "priority": 0.15,
    }
    total = (
        urgency * w["urgency"]
        + financial * w["financial"]
        + contract * w["contract"]
        + health_risk * w["health"]
        + priority * w["priority"]
    )
    return round(min(100.0, max(0.0, total)), 1)


def tier_for_score(score: float, priority: str = "medium") -> str:
    if score >= 75 or priority == "critical":
        return "now"
    if score >= 55 or priority == "high":
        return "today"
    if score >= 35:
        return "week"
    return "follow_up"


def agenda_caps(unit_count: int) -> Dict[str, int]:
    """Scale agenda size with portfolio — keeps executive view readable."""
    if unit_count <= 50:
        return {"now": 5, "today": 8, "week": 12, "follow_up": 15}
    if unit_count <= 150:
        return {"now": 6, "today": 12, "week": 18, "follow_up": 22}
    return {"now": 8, "today": 15, "week": 25, "follow_up": 30}


def _prop_map(properties: List[dict]) -> Dict[str, dict]:
    return {p["id"]: p for p in properties if p.get("id")}


def _tenant_by_property(tenants: List[dict]) -> Dict[str, dict]:
    out: Dict[str, dict] = {}
    for t in tenants:
        pid = t.get("property_id")
        if pid:
            out[pid] = t
    return out


def _route_for_kind(kind: str) -> str:
    return {
        "financial": "/",
        "maintenance": "/maintenance",
        "tenant": "/contracts",
        "renewal": "/contracts",
        "vacancy": "/portfolio",
        "opportunity": "/insights",
        "health": "/health",
    }.get(kind, "/")


def build_ranked_items(
    properties: List[dict],
    tenants: List[dict],
    contracts: List[dict],
    decisions: List[dict],
    *,
    lifecycle: Optional[Dict[str, Any]] = None,
) -> List[dict]:
    """Unified ranked queue from decisions, contracts, and portfolio signals.

    Gap 3: when a persisted ai_state lifecycle is provided (imported from
    upload analysis), inject tenant changes (departures / arrivals /
    replacements) as additional ranked items with source="lifecycle".
    These items close Gap 3 — without them, the executive agenda would
    miss turnover signals that contracts[].status alone cannot surface.
    Pre-Gap-3 behavior is fully preserved when lifecycle is None.
    """
    props = _prop_map(properties)
    tenant_map = _tenant_by_property(tenants)
    max_rent = max((float(p.get("monthly_revenue") or 0) for p in properties), default=1.0)
    items: List[dict] = []
    seen_keys: set[str] = set()

    for decision in decisions:
        pid = decision.get("property_id")
        prop = props.get(pid or "", {})
        rent = float(prop.get("monthly_revenue") or 0)
        contract = next((c for c in contracts if c.get("property_id") == pid), None)
        end_days = days_until((contract or {}).get("end", ""))
        priority = decision.get("priority", "medium")
        score = score_item(
            urgency=_urgency_from_days(end_days),
            financial=_financial_score(rent, max_rent),
            contract=_contract_status_score(end_days, (contract or {}).get("status", "")),
            health_risk=_health_risk_score(prop.get("health_score")),
            priority=_PRIORITY_SCORE.get(priority, 50),
        )
        key = f"d:{decision.get('id')}"
        seen_keys.add(key)
        kind = decision.get("kind", "financial")
        items.append(
            {
                "id": key,
                "source": "decision",
                "kind": kind,
                "priority": priority,
                "score": score,
                "tier": tier_for_score(score, priority),
                "title": decision_title_ar(decision),
                "why": decision_detail_ar(decision, contracts),
                "action": decision_action_ar(decision),
                "impact_aed": round(rent if kind == "financial" else rent * 0.15),
                "property_id": pid,
                "route": _route_for_kind(kind),
            }
        )

    for contract in contracts:
        if contract.get("status") != "expiring":
            continue
        pid = contract.get("property_id")
        key = f"c:{contract.get('id')}"
        if any(i.get("property_id") == pid and i.get("kind") in ("tenant", "financial") for i in items):
            continue
        prop = props.get(pid or "", {})
        tenant = tenant_map.get(pid or "", {})
        rent = float(contract.get("monthly_rent") or prop.get("monthly_revenue") or 0)
        end_days = days_until(contract.get("end", ""))
        score = score_item(
            urgency=_urgency_from_days(end_days),
            financial=_financial_score(rent, max_rent),
            contract=_contract_status_score(end_days, "expiring"),
            health_risk=_health_risk_score(prop.get("health_score")),
            priority=75 if end_days is not None and end_days <= 30 else 50,
        )
        subject = tenant.get("name") or prop.get("name") or "الوحدة"
        items.append(
            {
                "id": key,
                "source": "contract",
                "kind": "renewal",
                "priority": "high" if score >= 55 else "medium",
                "score": score,
                "tier": tier_for_score(score, "high" if end_days is not None and end_days <= 7 else "medium"),
                "title": f"جدّد عقد {subject}",
                "why": contract_renewal_guidance(end_days),
                "action": contract_renewal_action(end_days),
                "impact_aed": round(rent * 12 * 0.08),
                "property_id": pid,
                "route": "/contracts",
            }
        )

    for prop in properties:
        if prop.get("occupancy", 0) >= 0.5:
            continue
        pid = prop.get("id")
        key = f"v:{pid}"
        rent = float(prop.get("monthly_revenue") or 0)
        score = score_item(
            urgency=55.0,
            financial=_financial_score(rent, max_rent),
            contract=20.0,
            health_risk=_health_risk_score(prop.get("health_score")),
            priority=45.0,
        )
        items.append(
            {
                "id": key,
                "source": "vacancy",
                "kind": "vacancy",
                "priority": "medium",
                "score": score,
                "tier": tier_for_score(score, "medium"),
                "title": f"أطلق تسويق {prop.get('name')}",
                "why": "وحدة شاغرة — كل شهر تأخير يخسر إيراداً مباشراً.",
                "action": "انشر الإعلان وحدد زيارة خلال ٤٨ ساعة",
                "impact_aed": round(rent * 3),
                "property_id": pid,
                "route": "/portfolio",
            }
        )

    # --- Gap 3: inject lifecycle tenant changes as ranked items ---
    # Each tenant change (departure / arrival / replacement) becomes a
    # ranked item with source="lifecycle". Scored as medium urgency
    # (owner should review but it's not a fire). Replacements score
    # higher than pure departures (which may already be vacant).
    if lifecycle and isinstance(lifecycle, dict):
        changes = lifecycle.get("tenant_changes") or []
        for ch in changes[:20]:  # cap at 20 to avoid agenda flood
            if not isinstance(ch, dict):
                continue
            unit_label = str(ch.get("unit") or "")
            if not unit_label:
                continue
            # Find the property for this unit (best-effort match by name).
            pid = None
            rent = 0.0
            for p in properties:
                if str(p.get("name") or "") == unit_label or unit_label in str(p.get("name") or ""):
                    pid = p.get("id")
                    rent = float(p.get("monthly_revenue") or 0)
                    break
            ch_type = ch.get("type") or "change"
            from_t = ch.get("from_tenant") or "—"
            to_t = ch.get("to_tenant") or "—"
            # Replacements are more actionable than pure departures.
            urgency = 60.0 if ch_type == "replacement" else 45.0
            priority = "medium" if ch_type == "replacement" else "low"
            score = score_item(
                urgency=urgency,
                financial=_financial_score(rent, max_rent),
                contract=30.0,  # tenant change implies contract change
                health_risk=20.0,  # not a health signal
                priority=_PRIORITY_SCORE.get(priority, 25),
            )
            key = f"lc:{unit_label}:{ch_type}:{ch.get('month') or 0}:{ch.get('year') or 0}"
            if key in seen_keys:
                continue
            seen_keys.add(key)
            type_label = {
                "departure": "مغادرة",
                "arrival": "دخول",
                "replacement": "استبدال",
            }.get(ch_type, "تغيّر")
            items.append(
                {
                    "id": key,
                    "source": "lifecycle",
                    "kind": "tenant",
                    "priority": priority,
                    "score": score,
                    "tier": tier_for_score(score, priority),
                    "title": f"{type_label} على الوحدة {unit_label}",
                    "why": f"من {from_t} إلى {to_t} — أكّد الهوية والجوال قبل التحصيل.",
                    "action": "راجع ملف المستأجر والعقد",
                    "impact_aed": round(rent * 0.1),  # turnover cost ~10% of one month
                    "property_id": pid,
                    "route": "/tenants",
                }
            )

    items.sort(key=lambda x: (-x["score"], x.get("title", "")))
    return items


def attach_tier_emoji(item: dict) -> dict:
    tier = item.get("tier", "follow_up")
    item = dict(item)
    item["emoji"] = _TIER_EMOJI.get(tier, "🟢")
    return item
