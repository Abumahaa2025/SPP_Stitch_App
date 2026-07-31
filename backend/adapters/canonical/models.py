"""Canonical SPP domain model — adapter-agnostic product contract."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class CanonicalSettings:
    portfolio_name: str = "Portfolio"
    city: str = ""
    country: str = ""
    currency: str = "USD"
    owner_id: str = "owner_default"
    locale: str = "en"
    raw: Dict[str, Any] = field(default_factory=dict)


@dataclass
class CanonicalUnit:
    unit_id: str
    label: str
    tenant_name: str = ""
    tenant_raw: str = ""  # preserved raw tenant cell value (empty when vacant)
    is_vacant: bool = False  # explicit vacancy flag — set at ingestion
    property_id: str = ""  # canonical property entity id (NOT owner_id)
    property_raw: str = ""  # preserved raw property/building cell value
    normalization_flags: list = field(default_factory=list)  # e.g. ["vacant"]
    monthly_rent: float = 0.0
    contract_status: str = "active"  # active | expiring | expired | renewed | vacant
    payment_status: str = "unknown"  # current | late | unknown
    expiry_date: Optional[str] = None
    days_to_expiry: Optional[int] = None
    contract_no: str = ""
    source: str = "ingest"
    raw: Dict[str, Any] = field(default_factory=dict)

    @property
    def occupied(self) -> bool:
        """A unit is occupied when it has a real tenant and is not marked vacant.

        Counting functions MUST consume this property rather than re-deriving
        vacancy from tenant_name (which would re-introduce parser-defect
        compensation in the counting layer).
        """
        if self.is_vacant:
            return False
        return bool((self.tenant_name or "").strip())


@dataclass
class CanonicalAsset:
    asset_id: str
    name: str
    asset_type: str = "other"
    unit_id: Optional[str] = None
    location: str = ""
    install_date: Optional[str] = None
    warranty_end: Optional[str] = None
    lifespan_years: float = 0.0
    total_cost: float = 0.0
    fault_count: int = 0
    status: str = "operational"
    raw: Dict[str, Any] = field(default_factory=dict)


@dataclass
class CanonicalLifeEvent:
    event_id: str
    asset_id: str
    event_type: str  # maintenance | fault | payment | utility | contract | note
    occurred_at: str
    description: str = ""
    cost: float = 0.0
    unit_id: Optional[str] = None
    raw: Dict[str, Any] = field(default_factory=dict)


@dataclass
class CanonicalMaintenance:
    ticket_id: str
    unit_id: Optional[str]
    title: str
    status: str = "open"
    priority: str = "medium"
    description: str = ""
    raw: Dict[str, Any] = field(default_factory=dict)


@dataclass
class CanonicalPortfolio:
    settings: CanonicalSettings
    units: List[CanonicalUnit] = field(default_factory=list)
    assets: List[CanonicalAsset] = field(default_factory=list)
    life_events: List[CanonicalLifeEvent] = field(default_factory=list)
    maintenance: List[CanonicalMaintenance] = field(default_factory=list)
    ingest_sources: List[str] = field(default_factory=list)

    @property
    def unit_count(self) -> int:
        return len(self.units)

    @property
    def occupied_count(self) -> int:
        return sum(1 for u in self.units if u.tenant_name)

    @property
    def expiring_contracts(self) -> int:
        return sum(1 for u in self.units if u.contract_status in ("expiring", "expired"))

    @property
    def monthly_revenue(self) -> float:
        return sum(u.monthly_rent for u in self.units if u.tenant_name)

    @property
    def annual_revenue(self) -> float:
        return self.monthly_revenue * 12
