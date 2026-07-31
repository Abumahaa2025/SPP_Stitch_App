"""Assemble CanonicalPortfolio from one or more adapter bundles."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from adapters.canonical.ingest import (
    assets_from_memory_bundle,
    life_events_from_memory_bundle,
    maintenance_from_bundle,
    settings_from_bundle,
    units_from_dashboard,
    # Gap 2 — upload analysis bridge helpers
    assets_from_maintenance_entries,
    life_events_from_lifecycle,
    life_events_from_maintenance_entries,
    maintenance_from_property_knowledge,
    settings_from_upload_analysis,
    units_from_property_knowledge,
)
from adapters.canonical.models import CanonicalPortfolio, CanonicalUnit


def _merge_units(primary: List[CanonicalUnit], extra: List[CanonicalUnit]) -> List[CanonicalUnit]:
    by_id: Dict[str, CanonicalUnit] = {u.unit_id: u for u in primary}
    for u in extra:
        existing = by_id.get(u.unit_id)
        if not existing:
            by_id[u.unit_id] = u
            continue
        # Prefer row with tenant + rent + nearer expiry
        if u.tenant_name and not existing.tenant_name:
            by_id[u.unit_id] = u
        elif u.expiry_date and (not existing.expiry_date or (u.days_to_expiry or 999) < (existing.days_to_expiry or 999)):
            merged = existing
            if u.tenant_name:
                merged.tenant_name = u.tenant_name
            if u.monthly_rent:
                merged.monthly_rent = u.monthly_rent
            merged.contract_status = u.contract_status
            merged.expiry_date = u.expiry_date or merged.expiry_date
            merged.days_to_expiry = u.days_to_expiry
            by_id[u.unit_id] = merged
    return list(by_id.values())


def build_portfolio(
    *,
    dashboard_bundle: Optional[Dict[str, Any]] = None,
    decisions_bundle: Optional[Dict[str, Any]] = None,
    memory_bundle: Optional[Dict[str, Any]] = None,
    extra_bundles: Optional[List[Dict[str, Any]]] = None,
) -> CanonicalPortfolio:
    """Merge adapter payloads into one canonical portfolio snapshot."""
    sources: List[str] = []
    settings = settings_from_bundle(dashboard_bundle or decisions_bundle or memory_bundle or {})
    units: List[CanonicalUnit] = []
    maintenance = []

    if dashboard_bundle:
        sources.append("dashboard")
        units = _merge_units(units, units_from_dashboard(dashboard_bundle))
    if decisions_bundle:
        sources.append("decisions")
        units = _merge_units(units, units_from_dashboard(decisions_bundle))
        maintenance.extend(maintenance_from_bundle(decisions_bundle))
    for bundle in extra_bundles or []:
        if bundle:
            units = _merge_units(units, units_from_dashboard(bundle))

    assets = []
    life_events = []
    if memory_bundle:
        sources.append("memory")
        assets = assets_from_memory_bundle(memory_bundle)
        life_events = life_events_from_memory_bundle(memory_bundle)

    return CanonicalPortfolio(
        settings=settings,
        units=units,
        assets=assets,
        life_events=life_events,
        maintenance=[m for m in maintenance if m.status != "closed"],
        ingest_sources=sources,
    )


# ===========================================================================
# Gap 2 — Upload analysis → CanonicalPortfolio bridge
#
# Builds a CanonicalPortfolio from real upload-analysis outputs using the
# SAME CanonicalUnit / CanonicalAsset / CanonicalLifeEvent / CanonicalMaintenance
# models that build_portfolio() produces from GAS bundles.
#
# Source mapping:
#   property_knowledge.tenants (tenant_cards) → CanonicalUnit[]
#   property_knowledge.maintenance.entries   → CanonicalAsset[] (grouped)
#                                             → CanonicalLifeEvent[] (per entry)
#                                             → CanonicalMaintenance[] (open only)
#   property_knowledge.lifecycle.tenant_changes → CanonicalLifeEvent[] (contract type)
#   metrics + property_knowledge.meta         → CanonicalSettings
#
# Provenance: every entity's .raw dict includes "analysis_id" and "source".
# ===========================================================================


def build_portfolio_from_upload_analysis(
    *,
    property_knowledge: Dict[str, Any],
    metrics: Optional[Dict[str, Any]] = None,
    analysis_id: str = "",
) -> CanonicalPortfolio:
    """Build a CanonicalPortfolio from upload-analysis outputs.

    Args:
        property_knowledge: the full PK dict from analyze_upload_portfolio()
            (contains tenants, maintenance, lifecycle, quality, contracts, meta).
        metrics: the upload metrics dict (used for settings synthesis).
        analysis_id: the import's analysis_id (preserved in every entity's raw).

    Returns:
        A CanonicalPortfolio with units, assets, life_events, maintenance,
        and settings - ready for build_memory_graph() and generate_insights().
    """
    metrics = metrics or {}
    property_knowledge = property_knowledge or {}

    # 1. Settings from metrics + PK meta
    settings = settings_from_upload_analysis(metrics, property_knowledge, analysis_id)

    # 2. Units from tenant cards
    units = units_from_property_knowledge(property_knowledge, analysis_id)

    # 3. Assets from maintenance entries (grouped by unit + description)
    maint_entries = (property_knowledge.get("maintenance") or {}).get("entries") or []
    assets = assets_from_maintenance_entries(maint_entries, analysis_id)

    # 4. Life events from maintenance entries + lifecycle tenant changes
    maint_events = life_events_from_maintenance_entries(maint_entries, assets, analysis_id)
    lifecycle = property_knowledge.get("lifecycle") or {}
    lifecycle_events = life_events_from_lifecycle(lifecycle, analysis_id)
    life_events = maint_events + lifecycle_events

    # 5. Open maintenance items
    maintenance = maintenance_from_property_knowledge(property_knowledge, analysis_id)

    return CanonicalPortfolio(
        settings=settings,
        units=units,
        assets=assets,
        life_events=life_events,
        maintenance=maintenance,
        ingest_sources=["upload_analysis"],
    )
