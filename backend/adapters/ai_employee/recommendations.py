"""AI Property Employee — Proactive Recommendations.

Generates proactive suggestions the assistant can surface without being asked.
Each suggestion is grounded in real portfolio data, has a confidence score,
an expected impact, and a single concrete next action.

Deterministic + rule-based — no LLM call, no extra latency, no extra cost.
This is the "the assistant should never provide generic answers" guarantee:
every suggestion cites a real property / tenant / contract.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import List, Optional

from .context_builder import EmployeeContext

# ----- Suggestion type -----
@dataclass
class Suggestion:
    """One proactive recommendation the AI Employee surfaces."""

    id: str
    category: str  # critical | important | follow_up | information
    kind: str      # payment_risk | contract_renewal | maintenance | vacancy | ...
    title: str
    reason: str
    action: str
    impact: str
    confidence: int  # 0..100
    property_id: Optional[str] = None
    tenant_id: Optional[str] = None
    contract_id: Optional[str] = None
    route: str = "/"
    evidence: List[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "category": self.category,
            "kind": self.kind,
            "title": self.title,
            "reason": self.reason,
            "action": self.action,
            "impact": self.impact,
            "confidence": self.confidence,
            "property_id": self.property_id,
            "tenant_id": self.tenant_id,
            "contract_id": self.contract_id,
            "route": self.route,
            "evidence": self.evidence,
        }


def _days_until(end_str: str) -> Optional[int]:
    """Return days from today to end_str (YYYY-MM-DD), or None if unparseable."""
    if not end_str or not isinstance(end_str, str):
        return None
    try:
        end = datetime.fromisoformat(end_str).date()
    except ValueError:
        # Try first 10 chars (ISO date)
        try:
            end = datetime.fromisoformat(end_str[:10]).date()
        except Exception:
            return None
    today = datetime.now(timezone.utc).date()
    return (end - today).days


# ----- Individual detectors -----

def _payment_risk_suggestions(ctx: EmployeeContext) -> List[Suggestion]:
    """Tenants with low reliability → payment delay risk."""
    out: List[Suggestion] = []
    for t in ctx.tenants:
        rel = int(t.get("reliability") or 0)
        if rel >= 70:
            continue
        rent = float(t.get("rent") or 0)
        confidence = min(95, 60 + (70 - rel))
        out.append(Suggestion(
            id=f"sugg_payment_{t.get('id')}",
            category="critical" if rel < 50 else "important",
            kind="payment_risk",
            title=f"Tenant {t.get('name')} — payment reliability {rel}/100",
            reason=(
                f"Reliability score {rel}/100 is below the 70 threshold. "
                f"Rent is {rent:,.0f} {ctx.snapshot.currency}/mo on unit {t.get('unit')}."
            ),
            action=f"Send a polite payment reminder to {t.get('name')} today and confirm receipt within 48h.",
            impact=f"Avoid up to {rent:,.0f} {ctx.snapshot.currency} of arrears this cycle.",
            confidence=confidence,
            property_id=t.get("property_id"),
            tenant_id=t.get("id"),
            route="/tenants",
            evidence=[
                f"tenant_id={t.get('id')}",
                f"reliability={rel}",
                f"rent={rent}",
                f"unit={t.get('unit')}",
            ],
        ))
    return out


def _contract_renewal_suggestions(ctx: EmployeeContext) -> List[Suggestion]:
    """Expiring contracts → renewal window."""
    out: List[Suggestion] = []
    for c in ctx.contracts:
        if c.get("status") != "expiring":
            continue
        days = _days_until(str(c.get("end") or ""))
        if days is None:
            continue
        # Critical if overdue or within 14 days, important if within 60.
        if days < 0:
            category = "critical"
            urgency = f"expired {abs(days)} days ago"
        elif days <= 14:
            category = "critical"
            urgency = f"expires in {days} days"
        elif days <= 60:
            category = "important"
            urgency = f"expires in {days} days"
        else:
            category = "follow_up"
            urgency = f"expires in {days} days"

        rent = float(c.get("monthly_rent") or 0)
        tenant = next((t for t in ctx.tenants if t.get("id") == c.get("tenant_id")), None)
        tenant_name = tenant.get("name") if tenant else c.get("tenant_id")

        out.append(Suggestion(
            id=f"sugg_renewal_{c.get('id')}",
            category=category,
            kind="contract_renewal",
            title=f"Renewal window — {tenant_name} ({urgency})",
            reason=(
                f"Contract {c.get('id')} {urgency}. "
                f"Current rent: {rent:,.0f} {ctx.snapshot.currency}/mo."
            ),
            action=(
                f"Prepare renewal terms for {tenant_name} and send the offer this week."
                if days >= 0
                else f"Contact {tenant_name} immediately — contract is past expiry."
            ),
            impact=f"Lock in {rent * 12:,.0f} {ctx.snapshot.currency}/year of recurring revenue.",
            confidence=85 if days <= 14 else 70,
            property_id=c.get("property_id"),
            tenant_id=c.get("tenant_id"),
            contract_id=c.get("id"),
            route="/contracts",
            evidence=[
                f"contract_id={c.get('id')}",
                f"end={c.get('end')}",
                f"days_until={days}",
                f"monthly_rent={rent}",
            ],
        ))
    return out


def _property_health_suggestions(ctx: EmployeeContext) -> List[Suggestion]:
    """Properties with low health score → maintenance / operational risk."""
    out: List[Suggestion] = []
    for p in ctx.properties:
        health = int(p.get("health_score") or 0)
        if health >= 80:
            continue
        out.append(Suggestion(
            id=f"sugg_health_{p.get('id')}",
            category="important" if health < 60 else "follow_up",
            kind="maintenance",
            title=f"Property {p.get('name')} health at {health}/100",
            reason=(
                f"Health score {health}/100 is below the 80 target. "
                f"Occupancy {round(100 * (p.get('occupancy') or 0))}%. "
                f"Revenue {float(p.get('monthly_revenue') or 0):,.0f} {ctx.snapshot.currency}/mo."
            ),
            action=f"Schedule a property inspection for {p.get('name')} this week.",
            impact="Prevent occupancy loss and emergency repair premiums.",
            confidence=80,
            property_id=p.get("id"),
            route=f"/property/{p.get('id')}",
            evidence=[
                f"property_id={p.get('id')}",
                f"health={health}",
                f"occupancy={p.get('occupancy')}",
                f"monthly_revenue={p.get('monthly_revenue')}",
            ],
        ))
    return out


def _vacancy_suggestions(ctx: EmployeeContext) -> List[Suggestion]:
    """Low-occupancy properties → market them."""
    out: List[Suggestion] = []
    for p in ctx.properties:
        occ = float(p.get("occupancy") or 0)
        if occ >= 0.5:
            continue
        vacant_units = max(0, int(p.get("units") or 1) - int(p.get("tenant_ids") and len(p.get("tenant_ids")) or 0))
        out.append(Suggestion(
            id=f"sugg_vacancy_{p.get('id')}",
            category="important",
            kind="vacancy",
            title=f"Vacancy risk — {p.get('name')} at {round(100*occ)}% occupancy",
            reason=(
                f"Occupancy {round(100*occ)}% is below the 50% threshold. "
                f"~{vacant_units} unit(s) likely vacant."
            ),
            action=f"List the vacant unit(s) on {p.get('name')} and run a 7-day marketing push.",
            impact=f"Recover up to {float(p.get('monthly_revenue') or 0):,.0f} {ctx.snapshot.currency}/mo in lost rent.",
            confidence=75,
            property_id=p.get("id"),
            route=f"/property/{p.get('id')}",
            evidence=[
                f"property_id={p.get('id')}",
                f"occupancy={occ}",
                f"units={p.get('units')}",
            ],
        ))
    return out


def _top_decision_suggestion(ctx: EmployeeContext) -> List[Suggestion]:
    """Convert the top ranked decision into a proactive suggestion."""
    out: List[Suggestion] = []
    if not ctx.decisions:
        return out
    top = ctx.decisions[0]
    priority = str(top.get("priority") or "low").lower()
    category = "critical" if priority in ("critical", "high") else "important"
    out.append(Suggestion(
        id=f"sugg_top_decision_{top.get('id')}",
        category=category,
        kind=str(top.get("kind") or "decision").lower(),
        title=f"Top priority: {top.get('title')}",
        reason=str(top.get("reason") or "—"),
        action=str(top.get("recommended_action") or top.get("action") or "Review and decide."),
        impact=str(top.get("impact") or "Reduces portfolio risk."),
        confidence=int(top.get("confidence") or 70),
        property_id=top.get("property_id"),
        route="/",
        evidence=[
            f"decision_id={top.get('id')}",
            f"priority={priority}",
            f"kind={top.get('kind')}",
        ],
    ))
    return out


# ----- Orchestrator -----

_CATEGORY_ORDER = {"critical": 0, "important": 1, "follow_up": 2, "information": 3}


def generate_proactive_suggestions(
    ctx: EmployeeContext,
    max_per_category: int = 5,
    max_total: int = 12,
) -> List[Suggestion]:
    """Run all detectors, sort by category then confidence, and cap.

    Args:
        ctx: EmployeeContext (from build_employee_context).
        max_per_category: cap per category to avoid one bucket drowning others.
        max_total: hard cap on returned suggestions.

    Returns:
        Sorted list of Suggestion. Empty if portfolio is healthy.
    """
    raw: List[Suggestion] = []
    raw.extend(_payment_risk_suggestions(ctx))
    raw.extend(_contract_renewal_suggestions(ctx))
    raw.extend(_property_health_suggestions(ctx))
    raw.extend(_vacancy_suggestions(ctx))
    raw.extend(_top_decision_suggestion(ctx))

    # Bucket by category, sort each bucket by confidence desc, cap per bucket.
    by_cat: dict = {}
    for s in raw:
        by_cat.setdefault(s.category, []).append(s)
    capped: List[Suggestion] = []
    for cat, items in by_cat.items():
        items.sort(key=lambda s: -s.confidence)
        capped.extend(items[:max_per_category])

    # Final sort: by category order, then confidence desc.
    capped.sort(key=lambda s: (_CATEGORY_ORDER.get(s.category, 9), -s.confidence))
    return capped[:max_total]
