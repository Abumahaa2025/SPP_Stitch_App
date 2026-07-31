"""Portfolio Memory — canonical asset life graph (read-only over canonical model)."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from adapters.canonical.models import CanonicalAsset, CanonicalLifeEvent, CanonicalPortfolio
from adapters.normalize.dates import days_until, parse_date
from adapters.normalize.money import parse_money


@dataclass
class AssetProfile:
    asset: CanonicalAsset
    events: List[CanonicalLifeEvent] = field(default_factory=list)
    fault_count: int = 0
    total_cost: float = 0.0
    age_years: float = 0.0
    life_pct: float = 0.0
    warranty_days: Optional[int] = None
    risk: str = "low"  # low | medium | high | critical
    linked_unit_id: Optional[str] = None


@dataclass
class MemoryGraph:
    profiles: List[AssetProfile] = field(default_factory=list)
    summary: Dict[str, Any] = field(default_factory=dict)

    @property
    def repeat_fault_assets(self) -> List[AssetProfile]:
        return [p for p in self.profiles if p.fault_count >= 3]

    @property
    def critical_assets(self) -> List[AssetProfile]:
        return [p for p in self.profiles if p.risk == "critical"]


def _age_years(install_iso: Optional[str]) -> float:
    if not install_iso:
        return 0.0
    days = days_until(install_iso)
    if days is None:
        return 0.0
    return max(0.0, -days / 365.25)


def _risk_tier(fault_count: int, life_pct: float, warranty_days: Optional[int], status: str) -> str:
    low = status.lower()
    if "critical" in low or "broken" in low or "معطل" in low:
        return "critical"
    if fault_count >= 4 or life_pct >= 90:
        return "high"
    if fault_count >= 2 or life_pct >= 75 or (warranty_days is not None and 0 <= warranty_days <= 14):
        return "medium"
    return "low"


def build_memory_graph(portfolio: CanonicalPortfolio) -> MemoryGraph:
    """Derive memory profiles from canonical assets + life events + maintenance."""
    events_by_asset: Dict[str, List[CanonicalLifeEvent]] = {}
    for evt in portfolio.life_events:
        events_by_asset.setdefault(evt.asset_id, []).append(evt)

    # Synthetic assets from maintenance when no asset registry exists
    assets = list(portfolio.assets)
    if not assets:
        seen_units: set[str] = set()
        for m in portfolio.maintenance:
            if not m.unit_id or m.unit_id in seen_units:
                continue
            seen_units.add(m.unit_id)
            unit_label = next((u.label for u in portfolio.units if u.unit_id == m.unit_id), m.unit_id)
            assets.append(
                CanonicalAsset(
                    asset_id=f"asset_{m.unit_id}",
                    name=f"Asset — {unit_label}",
                    asset_type="other",
                    unit_id=m.unit_id,
                )
            )

    profiles: List[AssetProfile] = []
    for asset in assets:
        evts = events_by_asset.get(asset.asset_id, [])
        fault_evts = [e for e in evts if e.event_type in ("fault", "maintenance")]
        fault_count = max(asset.fault_count, len(fault_evts))
        evt_cost = sum(e.cost for e in evts)
        total_cost = asset.total_cost + evt_cost
        age = _age_years(asset.install_date)
        lifespan = asset.lifespan_years or 10.0
        life_pct = min(100.0, round(100 * age / lifespan, 1)) if lifespan > 0 else 0.0
        warranty_days = days_until(asset.warranty_end) if asset.warranty_end else None
        profiles.append(
            AssetProfile(
                asset=asset,
                events=evts[:12],
                fault_count=fault_count,
                total_cost=total_cost,
                age_years=round(age, 1),
                life_pct=life_pct,
                warranty_days=warranty_days,
                risk=_risk_tier(fault_count, life_pct, warranty_days, asset.status),
                linked_unit_id=asset.unit_id,
            )
        )

    summary = {
        "total_assets": len(profiles),
        "critical": sum(1 for p in profiles if p.risk == "critical"),
        "high_risk": sum(1 for p in profiles if p.risk == "high"),
        "repeat_faults": sum(1 for p in profiles if p.fault_count >= 3),
        "warranty_expiring": sum(
            1 for p in profiles if p.warranty_days is not None and 0 <= p.warranty_days <= 30
        ),
        "total_maint_cost": round(sum(p.total_cost for p in profiles), 2),
    }
    return MemoryGraph(profiles=profiles, summary=summary)
