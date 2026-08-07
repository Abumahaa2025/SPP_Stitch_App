/** Official SPP data model: owner → property → building → unit → tenant → contract → payments → maintenance → technician → documents → wallet */

import type { BuildingRecord } from '@/src/domain/building';
import type { UtilityAccountRecord } from '@/src/domain/utility-account';

export type { BuildingRecord } from '@/src/domain/building';
export type { UtilityAccountRecord } from '@/src/domain/utility-account';

export type PropertyType = 'residential' | 'commercial' | 'mixed' | 'land' | 'other';
export type UnitType = 'apartment' | 'shop' | 'office' | 'warehouse' | 'villa' | 'room' | 'other';
export type UnitStatus = 'occupied' | 'vacant' | 'reserved' | 'maintenance';
export type RentPeriod = 'monthly' | 'semi_annual' | 'annual';
export type PaymentMethod = 'transfer' | 'cash' | 'platform';
export type ServiceResponsibility = 'tenant' | 'owner' | 'included';
export type GasType = 'central' | 'independent';
export type MaintenanceResponsibility = 'owner' | 'tenant' | 'contract';

export type PropertyRecord = {
  id: string;
  name: string;
  type: PropertyType;
  city: string;
  district: string;
  /** Legacy count — kept for backward compatibility; prefer `buildings[]`. */
  buildingCount: number;
  unitCount: number;
  createdAt: string;
};

export type UnitRecord = {
  id: string;
  propertyId: string;
  /** Optional first-class Building attachment (Domain Model §5.2 / §5.3). */
  buildingId?: string;
  number: string;
  type: UnitType;
  rooms?: number;
  livingRooms?: number;
  bathrooms?: number;
  kitchen?: boolean;
  balcony?: boolean;
  area?: number;
  floor?: number;
  parking?: boolean;
  elevator?: boolean;
  furnished?: boolean;
  status: UnitStatus;
  rentAmount: number;
  rentPeriod: RentPeriod;
  paymentMethod: PaymentMethod;
  paymentDueDay: number;
  electricity: ServiceResponsibility;
  electricityMeter?: string;
  water: ServiceResponsibility;
  waterMeter?: string;
  internet: 'tenant' | 'included';
  gas: GasType;
  maintenanceBy: MaintenanceResponsibility;
  hasInsurance: boolean;
  insuranceAmount?: number;
  notes?: string;
};

export type TenantRecord = {
  id: string;
  name: string;
  phone: string;
  email: string;
  nationalId?: string;
  unitId: string;
  moveInDate: string;
  portalToken: string;
  portalUrl: string;
  qrData: string;
  whatsAppMessage: string;
  /** When true, manual official edits survive re-import of latest statement. */
  manualOfficial?: boolean;
  /** Official rent amount used for auto-communication when set. */
  officialRent?: number;
};

export type ContractRecord = {
  id: string;
  number: string;
  tenantId: string;
  unitId: string;
  startDate: string;
  endDate: string;
  rentAmount: number;
  paymentType: RentPeriod;
  depositAmount: number;
  specialTerms?: string;
};

export type SetupPhaseId =
  | 'property'
  | 'units'
  | 'tenants'
  | 'contracts'
  | 'alerts'
  | 'smartEmployee';

export type UnitHistoryEntry = {
  unitId: string;
  tenantName: string;
  lateAmount?: number;
  followUpCount?: number;
  note?: string;
  endedAt: string;
};

export type PaymentRecord = {
  id: string;
  unitId: string;
  tenantId: string;
  amount: number;
  /** Real payment timestamp only — never Apply/import time. */
  paidAt: string;
  method?: PaymentMethod;
  /** Links to ledger month when payment is tied to a statement month. */
  monthKey?: string;
};

/** Per-tenant, per-month operational ledger row (real due/paid/remaining from analysis months[]). */
export type PaymentLedgerEntry = {
  /** Stable: ldg_{tenantId}_{year}-{month} */
  id: string;
  tenantId: string;
  unitId: string;
  unit: string;
  tenant: string;
  monthKey: string;
  monthLabel: string;
  year?: number;
  month?: number;
  due: number;
  paid: number;
  remaining: number;
  /** Original status from months[] in analysis payload. */
  status: string;
  statusLabel?: string;
  source: 'tenant_card' | 'late_payments' | 'registered_payment' | 'settlement';
  lastUpdatedAt?: string;
  importBatchId?: string;
  conflictNote?: string;
};

export type ImportChangeEntry = {
  type: 'added' | 'updated' | 'conflict';
  entity: 'property' | 'unit' | 'tenant' | 'contract' | 'ledger' | 'payment';
  id: string;
  detail?: string;
};

export type ImportBatchMaintenance = {
  count: number;
  total: number;
  /** Payload only carries aggregate maintenance — per-ticket records need Source support. */
  note: string;
};

export type ImportBatch = {
  id: string;
  analysisId: string;
  appliedAt: string;
  source: string;
  period?: string;
  counts: {
    properties: number;
    units: number;
    tenants: number;
    contracts: number;
    ledgerEntries: number;
    payments: number;
  };
  changeCounts: { added: number; updated: number; conflicts?: number };
  dataStatus?: string;
  maintenance: ImportBatchMaintenance;
  changeLog: ImportChangeEntry[];
};

/** Occupancy churn captured from latest statement lifecycle (who left / who entered). */
export type OccupancyMoveSnapshot = {
  at: string;
  batchId?: string;
  period?: string;
  departed: { unit: string; tenant: string; phone?: string }[];
  newcomers: { unit: string; tenant: string; phone?: string; rent?: number }[];
};

export type PropertyOSState = {
  property: PropertyRecord | null;
  /** First-class Building identities (Domain Model §5.2). Optional for older device state. */
  buildings?: BuildingRecord[];
  units: UnitRecord[];
  tenants: TenantRecord[];
  contracts: ContractRecord[];
  alertsEnabled: boolean;
  technicianPortalToken: string;
  dismissedProgress: boolean;
  setupCompleted?: boolean;
  unitHistory?: UnitHistoryEntry[];
  payments?: PaymentRecord[];
  /** WP-1: full per-month operational ledger materialised from analysis. */
  paymentLedger?: PaymentLedgerEntry[];
  /** Standing utility accounts (Domain Model §5.20) — local registry; not a Sheets rename. */
  utilityAccounts?: UtilityAccountRecord[];
  /** Lifecycle moves from consecutive statement applies (months 1–8…). */
  occupancyMoves?: OccupancyMoveSnapshot[];
  lastImportAt?: string;
  lastImportBatchId?: string;
  startedAt?: string;
};

export type SetupPhaseProgress = {
  id: SetupPhaseId;
  percent: number;
  complete: boolean;
  current: boolean;
};
