/**
 * Bug-fix: single Source of Truth for arrears / late counts across screens.
 * Operational UI always derives from PropertyOS paymentLedger after Apply.
 * Analysis payload helpers keep executive-report numbers aligned with the same rules.
 */
import type { PortfolioAnalysis } from '@/src/api/portfolio-analysis';
import type { PaymentLedgerEntry, PropertyOSState } from '@/src/types/property-os';
import { deriveLedgerPaymentStatus } from '@/src/utils/operational-payment-ledger';

export type ArrearsTruth = {
  totalUnpaid: number;
  lateTenantCount: number;
  lateMonthCount: number;
  partialMonthCount: number;
};

/** A month counts toward arrears when remaining > 0 or status is late/partial. */
export function isArrearsLedgerEntry(
  entry: Pick<PaymentLedgerEntry, 'due' | 'paid' | 'remaining' | 'status' | 'conflictNote'>,
): boolean {
  const status = deriveLedgerPaymentStatus(entry);
  return status === 'late' || status === 'partial' || (Number(entry.remaining) || 0) > 0.009;
}

/** PropertyOS Source of Truth — used by ops screens and Koil local answers. */
export function arrearsFromPropertyOS(state: PropertyOSState): ArrearsTruth {
  const ledger = state.paymentLedger || [];
  const arrearsRows = ledger.filter(isArrearsLedgerEntry);
  const lateTenantIds = new Set(arrearsRows.map((l) => l.tenantId));
  return {
    totalUnpaid: arrearsRows.reduce((s, l) => s + (Number(l.remaining) || 0), 0),
    lateTenantCount: lateTenantIds.size,
    lateMonthCount: arrearsRows.filter((l) => deriveLedgerPaymentStatus(l) === 'late').length,
    partialMonthCount: arrearsRows.filter((l) => deriveLedgerPaymentStatus(l) === 'partial').length,
  };
}

/**
 * Analysis-side arrears — same priority order everywhere in the executive report:
 * summary.arrears → late_payments.summary → metrics.
 */
export function arrearsFromAnalysis(analysis: PortfolioAnalysis): ArrearsTruth {
  const summary = analysis.summary;
  const late = analysis.late_payments?.summary;
  const m = analysis.metrics;

  const totalUnpaid = Number(
    summary?.arrears?.late_value
      ?? summary?.late_value
      ?? late?.total_unpaid
      ?? m.late_value
      ?? 0,
  );
  const lateTenantCount = Number(
    summary?.arrears?.late_tenants
      ?? summary?.late_tenants
      ?? late?.late_tenant_count
      ?? m.late_tenants
      ?? 0,
  );
  const lateMonthCount = Number(
    summary?.arrears?.confirmed_late_month_count
      ?? summary?.payments?.confirmed_late_month_count
      ?? 0,
  );
  return {
    totalUnpaid,
    lateTenantCount,
    lateMonthCount,
    partialMonthCount: 0,
  };
}
