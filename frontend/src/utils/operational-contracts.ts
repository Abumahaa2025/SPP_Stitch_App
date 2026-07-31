/**
 * WP-3 — Operational contract view model from PropertyOS only.
 * No demo values. Legal dates = ISO YYYY-MM-DD only. Period labels ≠ legal dates.
 */
import type {
  ContractRecord,
  PaymentLedgerEntry,
  PropertyOSState,
  TenantRecord,
  UnitRecord,
} from '@/src/types/property-os';

export type ContractLifecycleStatus =
  | 'expired'
  | 'expiring_soon'
  | 'active'
  | 'appearance_in_statements'
  | 'needs_official_source';

export type ContractPaymentStatus = 'paid' | 'late' | 'partial' | 'unknown';

export type ContractDataStatus = 'confirmed' | 'needs_review' | 'incomplete' | 'conflicting';

export type ContractFilterId = 'all' | 'arrears' | 'incomplete' | 'has_legal_date' | 'needs_review';

export type ContractSortId = 'arrears' | 'unit' | 'tenant' | 'end_date';

export type OperationalContractView = {
  id: string;
  contractNumber: string;
  contractNumberMissing: boolean;
  tenantId: string;
  tenantName: string;
  phone: string;
  phoneMissing: boolean;
  propertyName: string;
  unitId: string;
  unitNumber: string;
  rent: number;
  /** Legal ISO start if present; else empty. */
  legalStart: string;
  /** Legal ISO end if present; else empty. */
  legalEnd: string;
  /** Period labels from statements when not legal ISO. */
  appearanceStart: string;
  appearanceEnd: string;
  startDisplay: string;
  endDisplay: string;
  paidMonths: number;
  lateMonths: number;
  arrearsTotal: number;
  paymentStatus: ContractPaymentStatus;
  paymentStatusLabel: string;
  lifecycleStatus: ContractLifecycleStatus;
  lifecycleLabel: string;
  dataStatus: ContractDataStatus;
  dataStatusLabel: string;
  ledger: PaymentLedgerEntry[];
  tenant?: TenantRecord;
  unit?: UnitRecord;
  contract?: ContractRecord;
};

const EXPIRING_DAYS = 60;
const SOURCE = 'Requires Source Support';

export function isLegalIsoDate(raw: string | undefined | null): boolean {
  const s = (raw || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return false;
  const d = new Date(s.slice(0, 10) + 'T00:00:00Z');
  return !Number.isNaN(d.getTime());
}

function daysUntilIso(iso: string): number {
  const end = new Date(iso.slice(0, 10) + 'T00:00:00Z').getTime();
  const now = Date.now();
  return Math.round((end - now) / (1000 * 60 * 60 * 24));
}

function ledgerStats(ledger: PaymentLedgerEntry[]) {
  const paidMonths = ledger.filter((l) => l.status === 'paid' || (l.paid > 0 && l.remaining <= 0)).length;
  const lateMonths = ledger.filter(
    (l) =>
      l.remaining > 0 ||
      l.status === 'unpaid' ||
      l.status === 'unpaid_confirmed' ||
      l.status === 'partial',
  ).length;
  const arrearsTotal = ledger.reduce((s, l) => s + (Number(l.remaining) || 0), 0);
  const conflicting = ledger.some((l) => l.paid > l.due + 0.01 && l.due > 0);
  return { paidMonths, lateMonths, arrearsTotal, conflicting };
}

function paymentStatusOf(
  paidMonths: number,
  lateMonths: number,
  arrearsTotal: number,
  ledgerLen: number,
  ar: boolean,
): { status: ContractPaymentStatus; label: string } {
  if (ledgerLen === 0) {
    return { status: 'unknown', label: ar ? 'غير محدد من الدفتر' : 'Unknown from ledger' };
  }
  if (arrearsTotal <= 0 && lateMonths === 0) {
    return { status: 'paid', label: ar ? 'مسدد' : 'Paid' };
  }
  if (lateMonths > 0 && paidMonths > 0) {
    return { status: 'partial', label: ar ? 'جزئي / متأخرات' : 'Partial / arrears' };
  }
  if (arrearsTotal > 0 || lateMonths > 0) {
    return { status: 'late', label: ar ? 'متأخر' : 'Late' };
  }
  return { status: 'unknown', label: ar ? 'غير محدد من الدفتر' : 'Unknown from ledger' };
}

function lifecycleOf(
  legalStart: string,
  legalEnd: string,
  appearanceStart: string,
  appearanceEnd: string,
  ar: boolean,
): { status: ContractLifecycleStatus; label: string } {
  if (legalEnd) {
    const days = daysUntilIso(legalEnd);
    if (days < 0) {
      return { status: 'expired', label: ar ? 'منتهٍ' : 'Expired' };
    }
    if (days <= EXPIRING_DAYS) {
      return { status: 'expiring_soon', label: ar ? 'قريب الانتهاء' : 'Expiring soon' };
    }
    return { status: 'active', label: ar ? 'نشط' : 'Active' };
  }
  // Legal start alone without end — still not enough to claim active/expired.
  if (legalStart && !legalEnd) {
    return {
      status: 'needs_official_source',
      label: ar ? 'حالة العقد تحتاج مصدرًا رسميًا' : 'Contract status needs official source',
    };
  }
  if (appearanceStart || appearanceEnd) {
    return {
      status: 'appearance_in_statements',
      label: ar ? 'ظاهر في فترة الكشوف' : 'Appears in statement period',
    };
  }
  return {
    status: 'needs_official_source',
    label: ar ? 'حالة العقد تحتاج مصدرًا رسميًا' : 'Contract status needs official source',
  };
}

function dataStatusOf(opts: {
  numberMissing: boolean;
  phoneMissing: boolean;
  hasAnyDateOrPeriod: boolean;
  lateMonths: number;
  conflicting: boolean;
  ar: boolean;
}): { status: ContractDataStatus; label: string } {
  const { numberMissing, phoneMissing, hasAnyDateOrPeriod, lateMonths, conflicting, ar } = opts;
  if (conflicting) {
    return { status: 'conflicting', label: ar ? 'متعارضة' : 'Conflicting' };
  }
  if (numberMissing || phoneMissing || !hasAnyDateOrPeriod) {
    return { status: 'incomplete', label: ar ? 'ناقصة' : 'Incomplete' };
  }
  if (lateMonths > 0) {
    return { status: 'needs_review', label: ar ? 'تحتاج مراجعة' : 'Needs review' };
  }
  return { status: 'confirmed', label: ar ? 'مؤكدة' : 'Confirmed' };
}

function displayDate(legal: string, appearance: string, ar: boolean): string {
  if (legal) return legal.slice(0, 10);
  if (appearance) return appearance;
  return SOURCE;
}

function buildViewFromParts(
  id: string,
  contract: ContractRecord | undefined,
  tenant: TenantRecord | undefined,
  unit: UnitRecord | undefined,
  state: PropertyOSState,
  ar: boolean,
): OperationalContractView {
  const rawStart = (contract?.startDate || '').trim();
  const rawEnd = (contract?.endDate || '').trim();
  const legalStart = isLegalIsoDate(rawStart) ? rawStart.slice(0, 10) : '';
  const legalEnd = isLegalIsoDate(rawEnd) ? rawEnd.slice(0, 10) : '';
  const appearanceStart = !legalStart && rawStart ? rawStart : '';
  const appearanceEnd = !legalEnd && rawEnd ? rawEnd : '';

  const tenantId = contract?.tenantId || tenant?.id || '';
  const unitId = contract?.unitId || tenant?.unitId || unit?.id || '';
  const ledger = (state.paymentLedger || []).filter(
    (l) => (tenantId && l.tenantId === tenantId) || (unitId && l.unitId === unitId),
  );
  const { paidMonths, lateMonths, arrearsTotal, conflicting } = ledgerStats(ledger);
  const pay = paymentStatusOf(paidMonths, lateMonths, arrearsTotal, ledger.length, ar);
  const life = lifecycleOf(legalStart, legalEnd, appearanceStart, appearanceEnd, ar);

  const number = (contract?.number || '').trim();
  // Strip legacy invented IMP-* if still present in older local stores.
  const isInvented = /^IMP-/i.test(number);
  const contractNumber = isInvented ? '' : number;
  const contractNumberMissing = !contractNumber;
  const phone = (tenant?.phone || '').trim();
  const phoneMissing = !phone;

  const data = dataStatusOf({
    numberMissing: contractNumberMissing,
    phoneMissing,
    hasAnyDateOrPeriod: !!(legalStart || legalEnd || appearanceStart || appearanceEnd),
    lateMonths,
    conflicting,
    ar,
  });

  return {
    id,
    contractNumber,
    contractNumberMissing,
    tenantId,
    tenantName: tenant?.name || '—',
    phone,
    phoneMissing,
    propertyName: state.property?.name || '—',
    unitId,
    unitNumber: unit?.number || '—',
    rent: Number(contract?.rentAmount ?? unit?.rentAmount ?? 0),
    legalStart,
    legalEnd,
    appearanceStart,
    appearanceEnd,
    startDisplay: displayDate(legalStart, appearanceStart, ar),
    endDisplay: displayDate(legalEnd, appearanceEnd, ar),
    paidMonths,
    lateMonths,
    arrearsTotal,
    paymentStatus: pay.status,
    paymentStatusLabel: pay.label,
    lifecycleStatus: life.status,
    lifecycleLabel: life.label,
    dataStatus: data.status,
    dataStatusLabel: data.label,
    ledger,
    tenant,
    unit,
    contract,
  };
}

/** One operational row per PropertyOS contract; plus any tenant without a contract row. No 10-cap. */
export function buildOperationalContractViews(state: PropertyOSState, ar: boolean): OperationalContractView[] {
  const views: OperationalContractView[] = [];
  const covered = new Set<string>();

  for (const c of state.contracts) {
    const tenant = state.tenants.find((t) => t.id === c.tenantId);
    const unit = state.units.find((u) => u.id === c.unitId);
    views.push(buildViewFromParts(c.id, c, tenant, unit, state, ar));
    if (c.tenantId) covered.add(c.tenantId);
  }

  for (const t of state.tenants) {
    if (covered.has(t.id)) continue;
    const unit = state.units.find((u) => u.id === t.unitId);
    views.push(
      buildViewFromParts(`ct_missing_${t.id}`, undefined, t, unit, state, ar),
    );
  }

  return views;
}

export function filterContractViews(
  views: OperationalContractView[],
  query: string,
  filter: ContractFilterId,
): OperationalContractView[] {
  const q = query.trim().toLowerCase();
  return views.filter((v) => {
    if (filter === 'arrears' && !(v.arrearsTotal > 0 || v.lateMonths > 0)) return false;
    if (filter === 'incomplete' && v.dataStatus !== 'incomplete') return false;
    if (filter === 'has_legal_date' && !(v.legalStart || v.legalEnd)) return false;
    if (filter === 'needs_review' && v.dataStatus !== 'needs_review') return false;
    if (!q) return true;
    const hay = [v.tenantName, v.phone, v.unitNumber, v.contractNumber].join(' ').toLowerCase();
    return hay.includes(q);
  });
}

export function sortContractViews(
  views: OperationalContractView[],
  sort: ContractSortId,
): OperationalContractView[] {
  const out = views.slice();
  out.sort((a, b) => {
    if (sort === 'arrears') return b.arrearsTotal - a.arrearsTotal;
    if (sort === 'unit') return String(a.unitNumber).localeCompare(String(b.unitNumber), 'ar');
    if (sort === 'tenant') return String(a.tenantName).localeCompare(String(b.tenantName), 'ar');
    // end_date: legal end first; missing last
    const ae = a.legalEnd || '';
    const be = b.legalEnd || '';
    if (ae && be) return ae.localeCompare(be);
    if (ae) return -1;
    if (be) return 1;
    return String(a.appearanceEnd).localeCompare(String(b.appearanceEnd), 'ar');
  });
  return out;
}
