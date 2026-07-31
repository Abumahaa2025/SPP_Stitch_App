"""Executive Intelligence — transform canonical memory into owner decisions."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from adapters.canonical.models import CanonicalPortfolio
from adapters.mappers.common import unit_property_id
from adapters.portfolio_memory.graph import AssetProfile, MemoryGraph, build_memory_graph

# Default replacement benchmarks by asset type (currency-agnostic units)
_REPLACE_BENCHMARK = {
    "ac": 6500,
    "hvac": 6500,
    "pump": 3500,
    "elevator": 50000,
    "generator": 15000,
    "tank": 8000,
    "other": 4000,
}


@dataclass
class ExecutiveInsight:
    insight_id: str
    scenario: str
    headline: str
    why: str
    action: str
    impact: str
    likely_outcome: str
    impact_value: float = 0.0
    confidence: int = 70
    priority: str = "medium"
    memory_refs: List[str] = field(default_factory=list)
    unit_id: Optional[str] = None
    property_id: Optional[str] = None
    kind: str = "maintenance"
    route: str = "/maintenance"


def _property_id_for_unit(portfolio: CanonicalPortfolio, unit_id: Optional[str]) -> Optional[str]:
    if not unit_id:
        return None
    for unit in portfolio.units:
        if unit.unit_id == unit_id:
            return unit_property_id(unit.label)
    return None


def _replace_benchmark(asset_type: str) -> float:
    t = (asset_type or "other").lower()
    for key, val in _REPLACE_BENCHMARK.items():
        if key in t:
            return float(val)
    return float(_REPLACE_BENCHMARK["other"])


def _repeat_repair_insight(profile: AssetProfile, currency: str) -> Optional[ExecutiveInsight]:
    if profile.fault_count < 3:
        return None
    bench = _replace_benchmark(profile.asset.asset_type)
    if profile.total_cost < bench * 0.5:
        return None
    return ExecutiveInsight(
        insight_id=f"ei_repeat_{profile.asset.asset_id}",
        scenario="repeat_repair",
        headline=f"{profile.asset.name} — repeated repairs ({profile.fault_count} events)",
        why=(
            f"Cumulative spend is {profile.total_cost:,.0f} {currency}. "
            f"Continuing repairs often costs more than replacement (benchmark ~{bench:,.0f} {currency})."
        ),
        action="Request a replacement quote before the next failure.",
        impact=f"Potential savings of {max(0, profile.total_cost - bench):,.0f} {currency} over 24 months.",
        likely_outcome="Without action, emergency repair premiums and downtime are likely within 90 days.",
        impact_value=max(0, profile.total_cost - bench),
        confidence=min(92, 60 + profile.fault_count * 8),
        priority="high" if profile.fault_count >= 4 else "medium",
        memory_refs=[profile.asset.asset_id],
        unit_id=profile.linked_unit_id,
        property_id=None,
        kind="maintenance",
        route="/maintenance",
    )


def _warranty_insight(profile: AssetProfile) -> Optional[ExecutiveInsight]:
    if profile.warranty_days is None or profile.warranty_days < 0 or profile.warranty_days > 30:
        return None
    return ExecutiveInsight(
        insight_id=f"ei_warranty_{profile.asset.asset_id}",
        scenario="warranty_window",
        headline=f"Warranty ending soon — {profile.asset.name}",
        why=f"Warranty expires in {profile.warranty_days} days. Open issues should be claimed now.",
        action="File warranty claim or schedule covered service immediately.",
        impact="Avoid out-of-pocket repair costs.",
        likely_outcome="After expiry, the same repair becomes a direct owner expense.",
        confidence=85,
        priority="high" if profile.warranty_days <= 7 else "medium",
        memory_refs=[profile.asset.asset_id],
        unit_id=profile.linked_unit_id,
        property_id=None,
        kind="maintenance",
        route="/maintenance",
    )


def _rent_gap_insights(portfolio: CanonicalPortfolio) -> List[ExecutiveInsight]:
    rents = [u.monthly_rent for u in portfolio.units if u.tenant_name and u.monthly_rent > 0]
    if len(rents) < 3:
        return []
    rents_sorted = sorted(rents)
    median = rents_sorted[len(rents_sorted) // 2]
    insights: List[ExecutiveInsight] = []
    currency = portfolio.settings.currency
    for unit in portfolio.units:
        if not unit.tenant_name or unit.monthly_rent <= 0:
            continue
        if unit.contract_status not in ("expiring", "expired", "active"):
            continue
        gap = median - unit.monthly_rent
        if gap <= 0 or gap / median < 0.12:
            continue
        annual = gap * 12
        insights.append(
            ExecutiveInsight(
                insight_id=f"ei_rent_{unit.unit_id}",
                scenario="renewal_pricing",
                headline=f"Renewal opportunity — {unit.label}",
                why=(
                    f"Rent is {unit.monthly_rent:,.0f} {currency}, below portfolio median "
                    f"{median:,.0f} {currency} ({int(100 * gap / median)}% gap)."
                ),
                action="Prepare renewal terms aligned with market at next expiry.",
                impact=f"Up to {annual:,.0f} {currency}/year if aligned at renewal.",
                likely_outcome="Renewing at current rate leaves revenue on the table.",
                impact_value=annual,
                confidence=75,
                priority="medium",
                memory_refs=[unit.unit_id],
                unit_id=unit.unit_id,
                property_id=_property_id_for_unit(portfolio, unit.unit_id),
                kind="tenant",
                route="/contracts",
            )
        )
    return insights[:5]


def generate_insights(
    portfolio: CanonicalPortfolio,
    memory: Optional[MemoryGraph] = None,
) -> List[ExecutiveInsight]:
    memory = memory or build_memory_graph(portfolio)
    currency = portfolio.settings.currency
    insights: List[ExecutiveInsight] = []

    for profile in memory.profiles:
        repeat = _repeat_repair_insight(profile, currency)
        if repeat:
            repeat.property_id = _property_id_for_unit(portfolio, profile.linked_unit_id)
            insights.append(repeat)
        warranty = _warranty_insight(profile)
        if warranty:
            warranty.property_id = _property_id_for_unit(portfolio, profile.linked_unit_id)
            insights.append(warranty)

    insights.extend(_rent_gap_insights(portfolio))
    insights.sort(key=lambda i: (-i.confidence, -i.impact_value))
    return insights[:12]


def insights_to_decisions(insights: List[ExecutiveInsight]) -> List[dict]:
    """Map insights into legacy DecisionT shape for Executive Brain ranking."""
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc).isoformat()
    out: List[dict] = []
    for ins in insights:
        out.append(
            {
                "id": ins.insight_id,
                "priority": ins.priority,
                "kind": ins.kind,
                "title": ins.headline,
                "reason": ins.why,
                "impact": ins.impact,
                "recommended_action": ins.action,
                "confidence": ins.confidence,
                "property_id": ins.property_id,
                "created_at": now,
                "_intelligence": {
                    "scenario": ins.scenario,
                    "likely_outcome": ins.likely_outcome,
                    "memory_refs": ins.memory_refs,
                    "route": ins.route,
                },
            }
        )
    return out
