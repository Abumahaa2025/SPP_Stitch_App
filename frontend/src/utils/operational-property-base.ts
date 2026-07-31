/**
 * WP-5 — Operational property base view models from PropertyOS only.
 * No demo. Relationships: property → units → tenant/contract/ledger/maintenance.
 */
import type {
  ContractRecord,
  ImportBatch,
  PaymentLedgerEntry,
  PropertyOSState,
  TenantRecord,
  UnitRecord,
} from '@/src/types/property-os';
import type { MaintenanceTicket } from '@/src/types/operational';
import { arrearsFromPropertyOS, isArrearsLedgerEntry } from '@/src/utils/ops-truth';

export type OpsDataStatus = 'confirmed' | 'needs_review' | 'incomplete' | 'conflicting';

export type OpsKpiId =
  | 'properties'
  | 'units'
  | 'occupied'
  | 'vacant'
  | 'contracts'
  | 'arrears'
  | 'collected'
  | 'remaining';

export type OpsFilterId =
  | 'all'
  | 'arrears'
  | 'incomplete'
  | 'occupied'
  | 'vacant'
  | 'needs_review';

export type OpsSortId = 'revenue' | 'arrears' | 'units' | 'occupancy' | 'unit_number' | 'tenant';

export type OpsTabId = 'properties' | 'units' | 'imports';

export type PortfolioKpis = {
  properties: number;
  units: number;
  occupied: number;
  vacant: number;
  contracts: number;
  arrearsTotal: number;
  collected: number;
  remaining: number;
  lateTenants: number;
};

export type OperationalPropertyView = {
  id: string;
  name: string;
  city: string;
  cityMissing: boolean;
  unitCount: number;
  occupiedCount: number;
  vacantCount: number;
  occupancyPct: number;
  totalRent: number;
  totalCollected: number;
  totalRemaining: number;
  lateTenantCount: number;
  contractCount: number;
  ticketCount: number;
  lastUpdated: string;
  lastUpdatedMissing: boolean;
  dataStatus: OpsDataStatus;
  dataStatusLabel: string;
};

export type OperationalUnitView = {
  id: string;
  number: string;
  propertyId: string;
  propertyName: string;
  tenantId: string;
  tenantName: string;
  phone: string;
  phoneMissing: boolean;
  contractId: string;
  contractNumber: string;
  contractNumberMissing: boolean;
  rent: number;
  arrears: number;
  unitStatus: 'occupied' | 'vacant' | 'needs_review';
  unitStatusLabel: string;
  lastActivity: string;
  lastActivityMissing: boolean;
  ledger: PaymentLedgerEntry[];
  tenant?: TenantRecord;
  contract?: ContractRecord;
  unit: UnitRecord;
  tickets: MaintenanceTicket[];
};

const SOURCE = 'Requires Source Support';

function dataStatusLabel(s: OpsDataStatus, ar: boolean): string {
  const map: Record<OpsDataStatus, [string, string]> = {
    confirmed: ['مؤكدة', 'Confirmed'],
    needs_review: ['تحتاج مراجعة', 'Needs review'],
    incomplete: ['ناقصة', 'Incomplete'],
    conflicting: ['متعارضة', 'Conflicting'],
  };
  const [a, e] = map[s];
  return ar ? a : e;
}

function unitStatusLabel(s: OperationalUnitView['unitStatus'], ar: boolean): string {
  if (s === 'occupied') return ar ? 'مؤجرة' : 'Occupied';
  if (s === 'vacant') return ar ? 'شاغرة' : 'Vacant';
  return ar ? 'تحتاج مراجعة' : 'Needs review';
}

export function computePortfolioKpis(
  state: PropertyOSState,
  tickets: MaintenanceTicket[] = [],
): PortfolioKpis {
  const ledger = state.paymentLedger || [];
  const occupied = state.units.filter((u) => u.status === 'occupied' || state.tenants.some((t) => t.unitId === u.id)).length;
  const vacant = Math.max(0, state.units.length - occupied);
  const collected = ledger.reduce((s, l) => s + (Number(l.paid) || 0), 0);
  const remaining = ledger.reduce((s, l) => s + (Number(l.remaining) || 0), 0);
  // Same SoT as executive arrears drill + payments ledger (ops-truth).
  const arrears = arrearsFromPropertyOS(state);
  return {
    properties: state.property ? 1 : 0,
    units: state.units.length,
    occupied,
    vacant,
    contracts: state.contracts.length,
    arrearsTotal: arrears.totalUnpaid,
    collected,
    remaining,
    lateTenants: arrears.lateTenantCount,
  };
}

export function buildOperationalPropertyViews(
  state: PropertyOSState,
  tickets: MaintenanceTicket[],
  ar: boolean,
): OperationalPropertyView[] {
  if (!state.property) return [];
  const p = state.property;
  const units = state.units.filter((u) => u.propertyId === p.id);
  const unitIds = new Set(units.map((u) => u.id));
  const tenants = state.tenants.filter((t) => unitIds.has(t.unitId));
  const tenantIds = new Set(tenants.map((t) => t.id));
  const contracts = state.contracts.filter((c) => tenantIds.has(c.tenantId) || unitIds.has(c.unitId));
  const ledger = (state.paymentLedger || []).filter((l) => tenantIds.has(l.tenantId) || unitIds.has(l.unitId));
  const propTickets = tickets.filter((tk) => unitIds.has(tk.unitId));

  const occupiedCount = units.filter(
    (u) => u.status === 'occupied' || tenants.some((t) => t.unitId === u.id),
  ).length;
  const vacantCount = Math.max(0, units.length - occupiedCount);
  const occupancyPct = units.length ? Math.round((occupiedCount / units.length) * 100) : 0;
  const totalRent = units.reduce((s, u) => s + (Number(u.rentAmount) || 0), 0)
    || contracts.reduce((s, c) => s + (Number(c.rentAmount) || 0), 0);
  const totalCollected = ledger.reduce((s, l) => s + (Number(l.paid) || 0), 0);
  const totalRemaining = ledger.reduce((s, l) => s + (Number(l.remaining) || 0), 0);
  const lateTenantCount = new Set(
    ledger.filter(isArrearsLedgerEntry).map((l) => l.tenantId),
  ).size;

  const city = (p.city || '').trim();
  const cityMissing = !city || city === '—';
  const missingPhone = tenants.some((t) => !(t.phone || '').trim());
  const missingContract = tenants.some((t) => !contracts.some((c) => c.tenantId === t.id && (c.number || '').trim() && !/^IMP-/i.test(c.number)));
  const conflicting = ledger.some((l) => !!l.conflictNote || ((Number(l.paid) || 0) > (Number(l.due) || 0) + 0.01 && (Number(l.due) || 0) > 0));
  const late = lateTenantCount > 0;

  let dataStatus: OpsDataStatus = 'confirmed';
  if (conflicting) dataStatus = 'conflicting';
  else if (cityMissing || missingPhone || missingContract || units.length === 0) dataStatus = 'incomplete';
  else if (late) dataStatus = 'needs_review';

  const lastUpdated = state.lastImportAt || '';

  return [
    {
      id: p.id,
      name: p.name || '—',
      city: cityMissing ? SOURCE : city,
      cityMissing,
      unitCount: units.length,
      occupiedCount,
      vacantCount,
      occupancyPct,
      totalRent,
      totalCollected,
      totalRemaining,
      lateTenantCount,
      contractCount: contracts.length,
      ticketCount: propTickets.length,
      lastUpdated,
      lastUpdatedMissing: !lastUpdated,
      dataStatus,
      dataStatusLabel: dataStatusLabel(dataStatus, ar),
    },
  ];
}

export function buildOperationalUnitViews(
  state: PropertyOSState,
  tickets: MaintenanceTicket[],
  ar: boolean,
): OperationalUnitView[] {
  const propName = state.property?.name || '—';
  return state.units.map((unit) => {
    const tenant = state.tenants.find((t) => t.unitId === unit.id);
    const contract = tenant
      ? state.contracts.find((c) => c.tenantId === tenant.id)
      : state.contracts.find((c) => c.unitId === unit.id);
    const ledger = (state.paymentLedger || []).filter(
      (l) => l.unitId === unit.id || (tenant && l.tenantId === tenant.id),
    );
    const unitTickets = tickets.filter((tk) => tk.unitId === unit.id);
    const arrears = ledger.reduce((s, l) => s + (Number(l.remaining) || 0), 0);
    const phone = (tenant?.phone || '').trim();
    const rawNumber = (contract?.number || '').trim();
    const contractNumber = /^IMP-/i.test(rawNumber) ? '' : rawNumber;

    let unitStatus: OperationalUnitView['unitStatus'] = 'vacant';
    if (tenant || unit.status === 'occupied') unitStatus = 'occupied';
    if ((tenant && !phone) || (tenant && !contractNumber) || unit.status === 'maintenance') {
      unitStatus = 'needs_review';
    }

    // Last activity: latest ledger month or ticket — never invent Apply date as activity.
    let lastActivity = '';
    const sortedLedger = [...ledger].sort((a, b) => String(b.monthKey).localeCompare(String(a.monthKey)));
    if (sortedLedger[0]?.monthLabel || sortedLedger[0]?.monthKey) {
      lastActivity = sortedLedger[0].monthLabel || sortedLedger[0].monthKey;
    } else if (unitTickets[0]?.updatedAt || unitTickets[0]?.createdAt) {
      lastActivity = String(unitTickets[0].updatedAt || unitTickets[0].createdAt).slice(0, 10);
    }

    return {
      id: unit.id,
      number: unit.number,
      propertyId: unit.propertyId,
      propertyName: propName,
      tenantId: tenant?.id || '',
      tenantName: tenant?.name || (ar ? 'شاغرة' : 'Vacant'),
      phone,
      phoneMissing: !phone,
      contractId: contract?.id || '',
      contractNumber,
      contractNumberMissing: !contractNumber,
      rent: Number(contract?.rentAmount ?? unit.rentAmount ?? 0),
      arrears,
      unitStatus,
      unitStatusLabel: unitStatusLabel(unitStatus, ar),
      lastActivity,
      lastActivityMissing: !lastActivity,
      ledger,
      tenant,
      contract,
      unit,
      tickets: unitTickets,
    };
  });
}

export function filterPropertyViews(
  views: OperationalPropertyView[],
  query: string,
  filter: OpsFilterId,
): OperationalPropertyView[] {
  const q = query.trim().toLowerCase();
  return views.filter((v) => {
    if (filter === 'arrears' && !(v.totalRemaining > 0 || v.lateTenantCount > 0)) return false;
    if (filter === 'incomplete' && v.dataStatus !== 'incomplete') return false;
    if (filter === 'needs_review' && v.dataStatus !== 'needs_review') return false;
    if (filter === 'occupied' && v.occupiedCount === 0) return false;
    if (filter === 'vacant' && v.vacantCount === 0) return false;
    if (!q) return true;
    return [v.name, v.city].join(' ').toLowerCase().includes(q);
  });
}

export function sortPropertyViews(views: OperationalPropertyView[], sort: OpsSortId): OperationalPropertyView[] {
  const out = views.slice();
  out.sort((a, b) => {
    if (sort === 'revenue') return b.totalRent - a.totalRent;
    if (sort === 'arrears') return b.totalRemaining - a.totalRemaining;
    if (sort === 'units') return b.unitCount - a.unitCount;
    if (sort === 'occupancy') return b.occupancyPct - a.occupancyPct;
    return a.name.localeCompare(b.name, 'ar');
  });
  return out;
}

export function filterUnitViews(
  views: OperationalUnitView[],
  query: string,
  filter: OpsFilterId,
): OperationalUnitView[] {
  const q = query.trim().toLowerCase();
  return views.filter((v) => {
    if (filter === 'arrears' && !(v.arrears > 0)) return false;
    if (filter === 'incomplete' && (v.phoneMissing || v.contractNumberMissing || v.unitStatus === 'needs_review')) return false;
    if (filter === 'occupied' && v.unitStatus === 'vacant') return false;
    if (filter === 'vacant' && v.unitStatus !== 'vacant') return false;
    if (filter === 'needs_review' && v.unitStatus !== 'needs_review') return false;
    if (!q) return true;
    const hay = [v.number, v.propertyName, v.tenantName, v.phone, v.contractNumber].join(' ').toLowerCase();
    return hay.includes(q);
  });
}

export function sortUnitViews(views: OperationalUnitView[], sort: OpsSortId): OperationalUnitView[] {
  const out = views.slice();
  out.sort((a, b) => {
    if (sort === 'revenue') return b.rent - a.rent;
    if (sort === 'arrears') return b.arrears - a.arrears;
    if (sort === 'tenant') return a.tenantName.localeCompare(b.tenantName, 'ar');
    return String(a.number).localeCompare(String(b.number), 'ar', { numeric: true });
  });
  return out;
}

/** Prove no duplicate ids across core OS collections. */
export function assertNoDuplicateIds(state: PropertyOSState): {
  ok: boolean;
  units: number;
  tenants: number;
  contracts: number;
  ledgerKeys: number;
} {
  const uniq = (ids: string[]) => ids.length === new Set(ids).size;
  const unitIds = state.units.map((u) => u.id);
  const tenantIds = state.tenants.map((t) => t.id);
  const contractIds = state.contracts.map((c) => c.id);
  const ledgerKeys = (state.paymentLedger || []).map((l) => `${l.tenantId}|${l.monthKey}`);
  return {
    ok: uniq(unitIds) && uniq(tenantIds) && uniq(contractIds) && uniq(ledgerKeys),
    units: unitIds.length,
    tenants: tenantIds.length,
    contracts: contractIds.length,
    ledgerKeys: ledgerKeys.length,
  };
}

export async function loadImportBatches(
  getItem: (key: string, fallback: string) => Promise<string>,
): Promise<ImportBatch[]> {
  try {
    const raw = await getItem('spp.importBatches', '[]');
    return JSON.parse(raw || '[]') as ImportBatch[];
  } catch {
    return [];
  }
}
