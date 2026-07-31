"""AI Property Employee — Memory Retriever.

Given an Intent, returns the slice of portfolio data most relevant to the
user's question. The LLM never sees the whole portfolio — it sees the
snapshot (from context_builder) plus the focused memory slice from here.

This keeps prompts tight, answers grounded, and cost predictable.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List

from .context_builder import EmployeeContext
from .intent import Intent


@dataclass
class MemoryRetrieval:
    """Focused slice of portfolio data for a single chat turn."""

    intent: Intent
    properties: List[dict] = field(default_factory=list)
    tenants: List[dict] = field(default_factory=list)
    contracts: List[dict] = field(default_factory=list)
    decisions: List[dict] = field(default_factory=list)
    reports: List[dict] = field(default_factory=list)
    notes: List[str] = field(default_factory=list)

    def to_prompt_block(self) -> str:
        """Compact focused-context block. Empty when nothing matched."""
        lines: List[str] = []
        if self.notes:
            lines.append("FOCUSED CONTEXT:")
            for n in self.notes:
                lines.append(f"- {n}")
        if self.properties:
            lines.append("")
            lines.append("MATCHED PROPERTIES:")
            for p in self.properties:
                lines.append(
                    f"- {p.get('name')} (id={p.get('id')}, kind={p.get('kind')}, "
                    f"health={p.get('health_score')}, "
                    f"occupancy={round(100 * (p.get('occupancy') or 0))}%, "
                    f"revenue={p.get('monthly_revenue'):,.0f}/mo)"
                )
        if self.tenants:
            lines.append("")
            lines.append("MATCHED TENANTS:")
            for t in self.tenants:
                lines.append(
                    f"- {t.get('name')} (unit={t.get('unit')}, "
                    f"rent={t.get('rent'):,.0f}, "
                    f"reliability={t.get('reliability')}/100, since={t.get('since')})"
                )
        if self.contracts:
            lines.append("")
            lines.append("MATCHED CONTRACTS:")
            for c in self.contracts:
                lines.append(
                    f"- tenant={c.get('tenant_id')} · property={c.get('property_id')} · "
                    f"{c.get('start')} → {c.get('end')} · "
                    f"rent={c.get('monthly_rent'):,.0f} · status={c.get('status')}"
                )
        if self.decisions:
            lines.append("")
            lines.append("MATCHED DECISIONS:")
            for d in self.decisions:
                lines.append(
                    f"- [{d.get('priority')}] {d.get('title')} → "
                    f"{d.get('recommended_action') or d.get('action', '')}"
                )
        return "\n".join(lines).strip()

    def to_dict(self) -> dict:
        return {
            "intent": self.intent.to_dict(),
            "properties": self.properties,
            "tenants": self.tenants,
            "contracts": self.contracts,
            "decisions": self.decisions,
            "reports": self.reports,
            "notes": self.notes,
        }


def _property_notes(p: dict, ctx: EmployeeContext) -> List[str]:
    """Derive memory notes for a single property."""
    notes: List[str] = []
    pid = p.get("id") or ""

    # Health
    health = int(p.get("health_score") or 0)
    if health < 70:
        notes.append(f"Property {p.get('name')} health is {health}/100 — below portfolio target.")
    elif health >= 90:
        notes.append(f"Property {p.get('name')} health is {health}/100 — strong.")

    # Occupancy
    occ = float(p.get("occupancy") or 0)
    if occ < 0.5:
        notes.append(f"Property {p.get('name')} occupancy is {round(100*occ)}% — vacant-heavy.")

    # Tenants on this property
    tenants_here = [t for t in ctx.tenants if t.get("property_id") == pid]
    if tenants_here:
        low_rel = [t for t in tenants_here if int(t.get("reliability") or 0) < 70]
        if low_rel:
            notes.append(
                f"{len(low_rel)} tenant(s) on {p.get('name')} have reliability < 70 — payment risk."
            )

    # Contracts on this property
    contracts_here = [c for c in ctx.contracts if c.get("property_id") == pid]
    expiring = [c for c in contracts_here if c.get("status") == "expiring"]
    if expiring:
        notes.append(f"{len(expiring)} contract(s) on {p.get('name')} are expiring.")

    # Open decisions on this property
    decs_here = [d for d in ctx.decisions if d.get("property_id") == pid]
    if decs_here:
        top = sorted(decs_here, key=lambda d: str(d.get("priority") or "low"))[0]
        notes.append(
            f"Top decision on {p.get('name')}: {top.get('title')} ({top.get('priority')})."
        )
    return notes


def _tenant_notes(t: dict, ctx: EmployeeContext) -> List[str]:
    notes: List[str] = []
    rel = int(t.get("reliability") or 0)
    if rel < 70:
        notes.append(f"Tenant {t.get('name')} reliability is {rel}/100 — payment risk.")
    elif rel >= 90:
        notes.append(f"Tenant {t.get('name')} reliability is {rel}/100 — reliable.")
    # Find their contract
    contracts_here = [c for c in ctx.contracts if c.get("tenant_id") == t.get("id")]
    if contracts_here:
        c = contracts_here[0]
        if c.get("status") == "expiring":
            notes.append(
                f"Tenant {t.get('name')} contract expires {c.get('end')} — renewal window."
            )
    return notes


def _contract_notes(c: dict, ctx: EmployeeContext) -> List[str]:
    notes: List[str] = []
    status = c.get("status") or ""
    if status == "expiring":
        notes.append(
            f"Contract {c.get('id')} (tenant={c.get('tenant_id')}) is expiring on {c.get('end')}."
        )
    elif status == "renewed":
        notes.append(f"Contract {c.get('id')} was renewed — active until {c.get('end')}.")
    # Tenant reliability for this contract
    tenant = next((t for t in ctx.tenants if t.get("id") == c.get("tenant_id")), None)
    if tenant:
        rel = int(tenant.get("reliability") or 0)
        if rel < 70:
            notes.append(
                f"Tenant {tenant.get('name')} (reliability {rel}/100) — payment delay risk."
            )
    return notes


def retrieve_relevant_memory(ctx: EmployeeContext, intent: Intent) -> MemoryRetrieval:
    """Pull the focused slice of portfolio data the assistant needs for this turn."""
    notes: List[str] = []
    matched_props: List[dict] = []
    matched_tenants: List[dict] = []
    matched_contracts: List[dict] = []
    matched_decs: List[dict] = []

    # Direct entity matches (highest priority).
    if intent.property_id:
        p = next((p for p in ctx.properties if p.get("id") == intent.property_id), None)
        if p:
            matched_props.append(p)
            notes.extend(_property_notes(p, ctx))
    if intent.tenant_id:
        t = next((t for t in ctx.tenants if t.get("id") == intent.tenant_id), None)
        if t:
            matched_tenants.append(t)
            notes.extend(_tenant_notes(t, ctx))
            # Auto-pull their contracts
            for c in ctx.contracts:
                if c.get("tenant_id") == intent.tenant_id:
                    matched_contracts.append(c)
                    notes.extend(_contract_notes(c, ctx))
    if intent.contract_id:
        c = next((c for c in ctx.contracts if c.get("id") == intent.contract_id), None)
        if c:
            matched_contracts.append(c)
            notes.extend(_contract_notes(c, ctx))
    if intent.unit:
        # Find tenants on that unit
        for t in ctx.tenants:
            if str(t.get("unit") or "").lower() == intent.unit.lower():
                matched_tenants.append(t)
                notes.extend(_tenant_notes(t, ctx))

    # Intent-kind fallbacks: if user asked about a class of thing without
    # naming a specific entity, surface the top items.
    if not matched_props and intent.kind == "property_query":
        # Surface 3 weakest properties (most actionable).
        weak = sorted(ctx.properties, key=lambda p: int(p.get("health_score") or 100))[:3]
        for p in weak:
            matched_props.append(p)
            notes.extend(_property_notes(p, ctx))
    if not matched_tenants and intent.kind == "tenant_query":
        # Surface 3 lowest-reliability tenants (most actionable).
        risky = sorted(ctx.tenants, key=lambda t: int(t.get("reliability") or 100))[:3]
        for t in risky:
            matched_tenants.append(t)
            notes.extend(_tenant_notes(t, ctx))
    if not matched_contracts and intent.kind == "contract_query":
        # Surface all expiring contracts.
        for c in ctx.contracts:
            if c.get("status") == "expiring":
                matched_contracts.append(c)
                notes.extend(_contract_notes(c, ctx))
    if intent.kind == "financial_query":
        # Surface top 3 financial decisions.
        fin_decs = [
            d for d in ctx.decisions
            if str(d.get("kind") or "").lower() == "financial"
        ][:3]
        for d in fin_decs:
            matched_decs.append(d)
            notes.append(
                f"Financial decision: {d.get('title')} ({d.get('priority')}) → "
                f"{d.get('recommended_action') or d.get('action', '')}"
            )
    if intent.kind == "maintenance_query":
        # Surface top 3 maintenance decisions.
        maint_decs = [
            d for d in ctx.decisions
            if str(d.get("kind") or "").lower() == "maintenance"
        ][:3]
        for d in maint_decs:
            matched_decs.append(d)
            notes.append(
                f"Maintenance: {d.get('title')} ({d.get('priority')}) → "
                f"{d.get('recommended_action') or d.get('action', '')}"
            )
    if intent.kind == "decision_query":
        # Surface top 5 ranked decisions (priority order — already sorted by context_builder).
        for d in ctx.decisions[:5]:
            matched_decs.append(d)
            notes.append(
                f"Decision [{d.get('priority')}] {d.get('title')} → "
                f"{d.get('recommended_action') or d.get('action', '')}"
            )

    # De-duplicate matched lists (in case the same entity was added twice).
    def _dedupe_by_id(items: List[dict]) -> List[dict]:
        seen = set()
        out: List[dict] = []
        for it in items:
            iid = it.get("id") or id(it)
            if iid in seen:
                continue
            seen.add(iid)
            out.append(it)
        return out

    return MemoryRetrieval(
        intent=intent,
        properties=_dedupe_by_id(matched_props),
        tenants=_dedupe_by_id(matched_tenants),
        contracts=_dedupe_by_id(matched_contracts),
        decisions=_dedupe_by_id(matched_decs),
        reports=[],
        notes=list(dict.fromkeys(notes)),  # preserve order, dedupe
    )
