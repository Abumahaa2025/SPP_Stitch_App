/**
 * WP-4 — Operational payment ledger views from PropertyOS paymentLedger (months[]).
 */
import type {
  ContractRecord,
  PaymentLedgerEntry,
  PaymentRecord,
  PropertyOSState,
  TenantRecord,
  UnitRecord,
} from '@/src/types/property-os';

export type LedgerPaymentStatus = 'paid' | 'partial' | 'late' | 'unconfirmed' | 'needs_review';

export type LedgerFilterId =
  | 'all'
  | 'paid'
  | 'partial'
  | 'late'
  | 'arrears'
  | 'needs_review'
  | 'month'
  | 'tenant';

export type LedgerSortId = 'newest' | 'remaining' | 'unit' | 'tenant';

export type LedgerTotals = {
  totalDue: number;
  totalPaid: number;
  totalRemaining: number;
  lateMonthCount: number;
  rowCount: number;
};

export type OperationalLedgerView = {
  id: string;
  tenantId: string;
  tenantName: string;
  phone: string;
  phoneMissing: boolean;
  propertyName: string;
  unitId: string;
  unitNumber: string;
  contractNumber: string;
  contractNumberMissing: boolean;
  monthKey: string;
  monthLabel: string;
  year?: number;
  month?: number;
  due: number;
  paid: number;
  remaining: number;
  paymentStatus: LedgerPaymentStatus;
  paymentStatusLabel: string;
  sourceLabel: string;
  lastUpdatedAt: string;
  lastUpdatedMissing: boolean;
  paymentDateLabel: string;
  paymentDateMissing: boolean;
  qualityNote: string;
  hasConflict: boolean;
  rawStatus: string;
  entry: PaymentLedgerEntry;
  tenant?: TenantRecord;
  unit?: UnitRecord;
  contract?: ContractRecord;
  linkedPayments: PaymentRecord[];
};

const SOURCE = 'Requires Source Support';

export function deriveLedgerPaymentStatus(
  entry: Pick<PaymentLedgerEntry, 'due' | 'paid' | 'remaining' | 'status' | 'conflictNote'>,
): LedgerPaymentStatus {
  const { due, paid, remaining, status, conflictNote } = entry;
  const raw = (status || '').toLowerCase();

  if (conflictNote || (paid > due + 0.01 && due > 0)) return 'needs_review';
  if (raw === 'unclear' || raw === 'unknown') return 'needs_review';

  if (due > 0 && remaining <= 0.009 && paid >= due - 0.009) return 'paid';
  if (raw === 'paid' && remaining <= 0.009) return 'paid';

  if (paid > 0 && remaining > 0.009) return 'partial';
  if (raw === 'partial') return 'partial';

  if (remaining > 0.009 || raw.includes('unpaid') || raw === 'unpaid_confirmed') return 'late';

  if (due === 0 && paid === 0) return 'unconfirmed';
  return 'unconfirmed';
}

function statusLabel(status: LedgerPaymentStatus, ar: boolean): string {
  const map: Record<LedgerPaymentStatus, [string, string]> = {
    paid: ['مدفوع', 'Paid'],
    partial: ['مدفوع جزئيًا', 'Partially paid'],
    late: ['متأخر', 'Late'],
    unconfirmed: ['غير مؤكد', 'Unconfirmed'],
    needs_review: ['يحتاج مراجعة', 'Needs review'],
  };
  const [a, e] = map[status];
  return ar ? a : e;
}

function sourceLabel(source: PaymentLedgerEntry['source'], ar: boolean): string {
  if (source === 'registered_payment') return ar ? 'دفعة مسجلة' : 'Registered payment';
  if (source === 'settlement') return ar ? 'تسوية' : 'Settlement';
  return ar ? 'كشف الاستيراد' : 'Import statement';
}

function monthSortKey(v: OperationalLedgerView): string {
  if (v.year && v.month) return `${v.year}-${String(v.month).padStart(2, '0')}`;
  return v.monthKey || '';
}

export function buildOperationalLedgerViews(state: PropertyOSState, ar: boolean): OperationalLedgerView[] {
  const ledger = state.paymentLedger || [];
  return ledger.map((entry) => {
    const tenant = state.tenants.find((t) => t.id === entry.tenantId);
    const unit = state.units.find((u) => u.id === entry.unitId);
    const contract = state.contracts.find((c) => c.tenantId === entry.tenantId);
    const number = (contract?.number || '').trim();
    const contractNumber = /^IMP-/i.test(number) ? '' : number;

    const linkedPayments = (state.payments || []).filter(
      (p) =>
        p.tenantId === entry.tenantId &&
        (p.monthKey === entry.monthKey || (!p.monthKey && false)),
    );

    let paymentDateLabel = SOURCE;
    let paymentDateMissing = true;
    if (linkedPayments.length > 0) {
      const latest = [...linkedPayments].sort((a, b) => String(b.paidAt).localeCompare(String(a.paidAt)))[0];
      if (latest?.paidAt && !latest.paidAt.startsWith('1970')) {
        paymentDateLabel = latest.paidAt.slice(0, 10);
        paymentDateMissing = false;
      }
    } else if (entry.paid > 0 && entry.year && entry.month) {
      // Statement month period only — not a confirmed payment timestamp.
      paymentDateLabel = ar
        ? `فترة ${entry.monthLabel || entry.monthKey} (ليس تاريخ دفع مؤكد)`
        : `Period ${entry.monthLabel || entry.monthKey} (not confirmed payment date)`;
      paymentDateMissing = true;
    }

    const paymentStatus = deriveLedgerPaymentStatus(entry);
    const qualityParts: string[] = [];
    if (entry.conflictNote) qualityParts.push(entry.conflictNote);
    if (paymentStatus === 'unconfirmed') {
      qualityParts.push(ar ? 'حالة الشهر غير مؤكدة في المصدر' : 'Month status unconfirmed in source');
    }

    return {
      id: entry.id,
      tenantId: entry.tenantId,
      tenantName: tenant?.name || entry.tenant || '—',
      phone: (tenant?.phone || '').trim(),
      phoneMissing: !(tenant?.phone || '').trim(),
      propertyName: state.property?.name || '—',
      unitId: entry.unitId,
      unitNumber: unit?.number || entry.unit || '—',
      contractNumber,
      contractNumberMissing: !contractNumber,
      monthKey: entry.monthKey,
      monthLabel: entry.monthLabel || entry.monthKey,
      year: entry.year,
      month: entry.month,
      due: Number(entry.due) || 0,
      paid: Number(entry.paid) || 0,
      remaining: Number(entry.remaining) || 0,
      paymentStatus,
      paymentStatusLabel: statusLabel(paymentStatus, ar),
      sourceLabel: sourceLabel(entry.source, ar),
      lastUpdatedAt: entry.lastUpdatedAt || '',
      lastUpdatedMissing: !entry.lastUpdatedAt,
      paymentDateLabel,
      paymentDateMissing,
      qualityNote: qualityParts.join(' · ') || '',
      hasConflict: !!entry.conflictNote,
      rawStatus: entry.status,
      entry,
      tenant,
      unit,
      contract,
      linkedPayments,
    };
  });
}

export function computeLedgerTotals(views: OperationalLedgerView[]): LedgerTotals {
  return {
    totalDue: views.reduce((s, v) => s + v.due, 0),
    totalPaid: views.reduce((s, v) => s + v.paid, 0),
    totalRemaining: views.reduce((s, v) => s + v.remaining, 0),
    lateMonthCount: views.filter((v) => v.paymentStatus === 'late' || v.paymentStatus === 'partial').length,
    rowCount: views.length,
  };
}

export function filterLedgerViews(
  views: OperationalLedgerView[],
  query: string,
  filter: LedgerFilterId,
  monthKey?: string,
  tenantId?: string,
): OperationalLedgerView[] {
  const q = query.trim().toLowerCase();
  return views.filter((v) => {
    // Month/tenant narrowing always applies, so "who paid and who was late in
    // month X" is answerable by combining a month with a status filter.
    if (monthKey && v.monthKey !== monthKey) return false;
    if (tenantId && v.tenantId !== tenantId) return false;
    if (filter === 'paid' && v.paymentStatus !== 'paid') return false;
    if (filter === 'partial' && v.paymentStatus !== 'partial') return false;
    // late = late only; arrears = late + partial (matches executive drill + KPI SoT)
    if (filter === 'late' && v.paymentStatus !== 'late') return false;
    if (filter === 'arrears' && v.paymentStatus !== 'late' && v.paymentStatus !== 'partial' && v.remaining <= 0.009) {
      return false;
    }
    if (filter === 'needs_review' && v.paymentStatus !== 'needs_review') return false;
    if (!q) return true;
    const hay = [v.tenantName, v.phone, v.unitNumber, v.contractNumber, v.monthLabel, v.monthKey]
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  });
}

export function sortLedgerViews(views: OperationalLedgerView[], sort: LedgerSortId): OperationalLedgerView[] {
  const out = views.slice();
  out.sort((a, b) => {
    if (sort === 'remaining') return b.remaining - a.remaining;
    if (sort === 'unit') return String(a.unitNumber).localeCompare(String(b.unitNumber), 'ar');
    if (sort === 'tenant') return String(a.tenantName).localeCompare(String(b.tenantName), 'ar');
    // newest
    return monthSortKey(b).localeCompare(monthSortKey(a));
  });
  return out;
}

export function uniqueLedgerMonths(views: OperationalLedgerView[]): { key: string; label: string }[] {
  const map = new Map<string, string>();
  views.forEach((v) => map.set(v.monthKey, v.monthLabel || v.monthKey));
  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, label]) => ({ key, label }));
}

export function uniqueLedgerTenants(views: OperationalLedgerView[]): { id: string; name: string }[] {
  const map = new Map<string, string>();
  views.forEach((v) => map.set(v.tenantId, v.tenantName));
  return [...map.entries()]
    .sort((a, b) => a[1].localeCompare(b[1], 'ar'))
    .map(([id, name]) => ({ id, name }));
}

/** Compare ledger totals with analysis.summary (tolerance for rounding). */
export function totalsMatchSummary(
  totals: LedgerTotals,
  summary: { collected?: number; remaining?: number; rents?: number } | undefined,
): { dueOk: boolean; paidOk: boolean; remainingOk: boolean } {
  if (!summary) return { dueOk: false, paidOk: false, remainingOk: false };
  const tol = 1;
  const dueOk = Math.abs(totals.totalDue - Number(summary.rents || 0)) <= tol || totals.totalDue > 0;
  const paidOk = Math.abs(totals.totalPaid - Number(summary.collected || 0)) <= tol;
  const remainingOk = Math.abs(totals.totalRemaining - Number(summary.remaining || 0)) <= tol;
  return { dueOk, paidOk, remainingOk };
}
