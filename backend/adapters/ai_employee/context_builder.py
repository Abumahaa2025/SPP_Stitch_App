"""AI Property Employee — Context Builder.

Assembles a structured, compressed snapshot of the live portfolio so the
assistant can answer questions grounded in real data (not generic advice).

This module is purely additive — it reads from the same `_portfolio_live_context`
dict that powers /api/briefing, /api/executive, and /api/verdicts, so it never
mutates source data and never affects existing endpoints.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

# Currency is currently SAR across the beta portfolio; settings may override.
_DEFAULT_CURRENCY = "SAR"


@dataclass
class PropertyRow:
    """One-line property summary safe to embed in a prompt."""

    id: str
    name: str
    kind: str
    city: str
    units: int
    occupancy_pct: int
    monthly_revenue: float
    health_score: int
    tenant_count: int

    def to_line(self, currency: str = _DEFAULT_CURRENCY) -> str:
        return (
            f"- {self.name} [{self.kind}, {self.city}] · "
            f"units={self.units} · occupancy={self.occupancy_pct}% · "
            f"health={self.health_score} · "
            f"revenue={self.monthly_revenue:,.0f} {currency}/mo · "
            f"tenants={self.tenant_count} · id={self.id}"
        )


@dataclass
class TenantRow:
    id: str
    name: str
    property_id: str
    unit: str
    since: str
    rent: float
    reliability: int

    def to_line(self, currency: str = _DEFAULT_CURRENCY) -> str:
        return (
            f"- {self.name} · unit={self.unit} · "
            f"rent={self.rent:,.0f} {currency}/mo · "
            f"reliability={self.reliability}/100 · "
            f"since={self.since} · property_id={self.property_id} · id={self.id}"
        )


@dataclass
class ContractRow:
    id: str
    tenant_id: str
    property_id: str
    start: str
    end: str
    monthly_rent: float
    status: str

    def to_line(self, currency: str = _DEFAULT_CURRENCY) -> str:
        return (
            f"- tenant={self.tenant_id} · property={self.property_id} · "
            f"{self.start} → {self.end} · "
            f"rent={self.monthly_rent:,.0f} {currency}/mo · "
            f"status={self.status} · id={self.id}"
        )


@dataclass
class DecisionRow:
    id: str
    priority: str
    kind: str
    title: str
    action: str
    confidence: int
    property_id: Optional[str]

    def to_line(self) -> str:
        pid = self.property_id or "—"
        return (
            f"- [{self.priority}] {self.kind}: {self.title} → "
            f"action: {self.action} · confidence={self.confidence} · "
            f"property={pid}"
        )


@dataclass
class PortfolioSnapshot:
    """Compressed portfolio view embedded in the system prompt."""

    owner_name: str
    currency: str
    properties: List[PropertyRow] = field(default_factory=list)
    tenants: List[TenantRow] = field(default_factory=list)
    contracts: List[ContractRow] = field(default_factory=list)
    decisions: List[DecisionRow] = field(default_factory=list)
    portfolio_annual_revenue: float = 0.0
    avg_health: int = 0
    occupancy_pct: int = 0
    expiring_contracts: int = 0
    open_decisions: int = 0

    def to_prompt_block(self, max_items_per_section: int = 8) -> str:
        """Render the snapshot as a compact text block for the LLM.

        Capped per-section to keep the prompt well under 4KB even for
        larger portfolios. The assistant still gets enough context to
        answer grounded questions.
        """
        lines: List[str] = []
        lines.append(
            f"Owner: {self.owner_name or '—'} · "
            f"Portfolio annual revenue: {self.portfolio_annual_revenue:,.0f} {self.currency} · "
            f"Avg health: {self.avg_health}/100 · "
            f"Occupancy: {self.occupancy_pct}% · "
            f"Expiring contracts: {self.expiring_contracts} · "
            f"Open decisions: {self.open_decisions}"
        )

        if self.properties:
            lines.append("")
            lines.append("PROPERTIES:")
            for p in self.properties[:max_items_per_section]:
                lines.append(p.to_line(self.currency))
            extra = len(self.properties) - max_items_per_section
            if extra > 0:
                lines.append(f"... ({extra} more properties omitted for brevity)")

        if self.tenants:
            lines.append("")
            lines.append("TENANTS:")
            for t in self.tenants[:max_items_per_section]:
                lines.append(t.to_line(self.currency))
            extra = len(self.tenants) - max_items_per_section
            if extra > 0:
                lines.append(f"... ({extra} more tenants omitted for brevity)")

        if self.contracts:
            lines.append("")
            lines.append("CONTRACTS:")
            for c in self.contracts[:max_items_per_section]:
                lines.append(c.to_line(self.currency))
            extra = len(self.contracts) - max_items_per_section
            if extra > 0:
                lines.append(f"... ({extra} more contracts omitted for brevity)")

        if self.decisions:
            lines.append("")
            lines.append("ACTIVE DECISIONS (ranked):")
            for d in self.decisions[:max_items_per_section]:
                lines.append(d.to_line())
            extra = len(self.decisions) - max_items_per_section
            if extra > 0:
                lines.append(f"... ({extra} more decisions omitted for brevity)")

        return "\n".join(lines)


@dataclass
class EmployeeContext:
    """Full assistant context — snapshot + raw domain lists for memory retrieval."""

    snapshot: PortfolioSnapshot
    properties: List[dict]
    tenants: List[dict]
    contracts: List[dict]
    decisions: List[dict]
    reports: List[dict]
    settings: Dict[str, Any]


def _safe_float(v: Any, default: float = 0.0) -> float:
    try:
        return float(v) if v is not None else default
    except (TypeError, ValueError):
        return default


def _safe_int(v: Any, default: int = 0) -> int:
    try:
        return int(float(v)) if v is not None else default
    except (TypeError, ValueError):
        return default


def _owner_first_name(settings: Dict[str, Any]) -> str:
    for key in ("clientName", "propertyName", "ownerName"):
        raw = str((settings or {}).get(key) or "").strip()
        if raw:
            return raw.split()[0]
    # Fallback: if no settings, use the owner doc name (callers can pass it via settings["owner_name"])
    raw = str((settings or {}).get("owner_name") or "").strip()
    return raw.split()[0] if raw else ""


def _resolve_currency(settings: Dict[str, Any]) -> str:
    cur = str((settings or {}).get("currency") or "").strip().upper()
    return cur or _DEFAULT_CURRENCY


def build_employee_context(ctx: Dict[str, Any]) -> EmployeeContext:
    """Build an EmployeeContext from the standard `_portfolio_live_context` dict.

    `ctx` shape (from server._portfolio_live_context):
        settings, properties, tenants, contracts, decisions, reports
    """
    settings = ctx.get("settings") or {}
    properties = ctx.get("properties") or []
    tenants = ctx.get("tenants") or []
    contracts = ctx.get("contracts") or []
    decisions = ctx.get("decisions") or []
    reports = ctx.get("reports") or []

    currency = _resolve_currency(settings)

    # Build property rows; count tenants per property for richer context.
    tenant_counts: Dict[str, int] = {}
    for t in tenants:
        pid = t.get("property_id") or ""
        if pid:
            tenant_counts[pid] = tenant_counts.get(pid, 0) + 1

    prop_rows: List[PropertyRow] = []
    for p in properties:
        pid = str(p.get("id") or "")
        if not pid:
            continue
        prop_rows.append(
            PropertyRow(
                id=pid,
                name=str(p.get("name") or "—"),
                kind=str(p.get("kind") or "—"),
                city=str(p.get("city") or "—"),
                units=_safe_int(p.get("units"), 1),
                occupancy_pct=min(100, max(0, round(100 * _safe_float(p.get("occupancy"))))),
                monthly_revenue=_safe_float(p.get("monthly_revenue")),
                health_score=_safe_int(p.get("health_score"), 0),
                tenant_count=tenant_counts.get(pid, 0),
            )
        )

    tenant_rows: List[TenantRow] = []
    for t in tenants:
        tid = str(t.get("id") or "")
        if not tid:
            continue
        tenant_rows.append(
            TenantRow(
                id=tid,
                name=str(t.get("name") or "—"),
                property_id=str(t.get("property_id") or ""),
                unit=str(t.get("unit") or "—"),
                since=str(t.get("since") or "—"),
                rent=_safe_float(t.get("rent")),
                reliability=_safe_int(t.get("reliability"), 0),
            )
        )

    contract_rows: List[ContractRow] = []
    for c in contracts:
        cid = str(c.get("id") or "")
        if not cid:
            continue
        contract_rows.append(
            ContractRow(
                id=cid,
                tenant_id=str(c.get("tenant_id") or ""),
                property_id=str(c.get("property_id") or ""),
                start=str(c.get("start") or "—"),
                end=str(c.get("end") or "—"),
                monthly_rent=_safe_float(c.get("monthly_rent")),
                status=str(c.get("status") or "—"),
            )
        )

    # Rank decisions by priority (critical → low), then by confidence.
    priority_rank = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    sorted_decisions = sorted(
        decisions,
        key=lambda d: (
            priority_rank.get(str(d.get("priority") or "low").lower(), 9),
            -_safe_int(d.get("confidence"), 0),
        ),
    )
    decision_rows: List[DecisionRow] = []
    for d in sorted_decisions:
        did = str(d.get("id") or "")
        if not did:
            continue
        decision_rows.append(
            DecisionRow(
                id=did,
                priority=str(d.get("priority") or "low"),
                kind=str(d.get("kind") or "—"),
                title=str(d.get("title") or "—"),
                action=str(d.get("recommended_action") or d.get("action") or "—"),
                confidence=_safe_int(d.get("confidence"), 0),
                property_id=d.get("property_id"),
            )
        )

    annual_revenue = sum(p.monthly_revenue for p in prop_rows) * 12
    avg_health = (
        round(sum(p.health_score for p in prop_rows) / len(prop_rows))
        if prop_rows
        else 0
    )
    occupancy_pct = (
        round(sum(p.occupancy_pct for p in prop_rows) / len(prop_rows))
        if prop_rows
        else 0
    )
    expiring = sum(1 for c in contract_rows if c.status == "expiring")

    snapshot = PortfolioSnapshot(
        owner_name=_owner_first_name(settings),
        currency=currency,
        properties=prop_rows,
        tenants=tenant_rows,
        contracts=contract_rows,
        decisions=decision_rows,
        portfolio_annual_revenue=annual_revenue,
        avg_health=avg_health,
        occupancy_pct=occupancy_pct,
        expiring_contracts=expiring,
        open_decisions=len(decision_rows),
    )

    return EmployeeContext(
        snapshot=snapshot,
        properties=properties,
        tenants=tenants,
        contracts=contracts,
        decisions=decisions,
        reports=reports,
        settings=settings,
    )
