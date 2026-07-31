/**
 * WP-6 — Today's operational briefing + data-quality reasons (PropertyOS only).
 */
import type { PropertyOSState } from '@/src/types/property-os';
import type { MaintenanceTicket } from '@/src/types/operational';
import type { OpsDataStatus, OperationalPropertyView } from '@/src/utils/operational-property-base';
import { buildOperationalPropertyViews, computePortfolioKpis } from '@/src/utils/operational-property-base';
import { isLegalIsoDate } from '@/src/utils/operational-contracts';

export type DataQualityReason = {
  code: string;
  label: string;
};

export type OpsTodayBrief = {
  propertyName: string;
  statusToday: string;
  arrearsTotal: number;
  lateTenants: number;
  contractsFollowUp: number;
  vacantUnits: number;
  openTickets: number;
  lastImportLabel: string;
  lastImportMissing: boolean;
  completenessPct: number;
  dataStatus: OpsDataStatus;
  dataStatusLabel: string;
  qualityReasons: DataQualityReason[];
  paidMonths: number;
  lateMonths: number;
  needsReviewItems: number;
};

export function dataQualityReasons(
  state: PropertyOSState,
  propView: OperationalPropertyView | undefined,
  ar: boolean,
): DataQualityReason[] {
  const reasons: DataQualityReason[] = [];
  const city = (state.property?.city || '').trim();
  if (!city || city === '—') {
    reasons.push({
      code: 'city',
      label: ar ? 'المدينة غير متوفرة في المصدر' : 'City missing from source',
    });
  }
  const missingPhone = state.tenants.filter((t) => !(t.phone || '').trim()).length;
  if (missingPhone > 0) {
    reasons.push({
      code: 'phone',
      label: ar ? `${missingPhone} مستأجر بلا جوال` : `${missingPhone} tenants without phone`,
    });
  }
  const missingContract = state.contracts.filter((c) => !(c.number || '').trim() || /^IMP-/i.test(c.number)).length
    + Math.max(0, state.tenants.length - state.contracts.length);
  if (missingContract > 0) {
    reasons.push({
      code: 'contract',
      label: ar ? `${missingContract} عقود ناقصة/بدون رقم` : `${missingContract} contracts missing/no number`,
    });
  }
  const conflicts = (state.paymentLedger || []).filter((l) => !!l.conflictNote).length;
  if (conflicts > 0) {
    reasons.push({
      code: 'conflict',
      label: ar ? `${conflicts} تعارض في دفتر الأشهر` : `${conflicts} ledger conflicts`,
    });
  }
  const late = (state.paymentLedger || []).filter((l) => (l.remaining || 0) > 0.009).length;
  if (late > 0) {
    reasons.push({
      code: 'arrears',
      label: ar ? `${late} شهرًا بمتبقي` : `${late} months with remaining`,
    });
  }
  if (propView?.dataStatus === 'confirmed' && reasons.length === 0) {
    reasons.push({
      code: 'ok',
      label: ar ? 'لا نواقص مؤكدة من البيانات الحالية' : 'No confirmed gaps in current data',
    });
  }
  return reasons;
}

export function buildOpsTodayBrief(
  state: PropertyOSState,
  tickets: MaintenanceTicket[],
  ar: boolean,
): OpsTodayBrief | null {
  if (!state.property) return null;
  const props = buildOperationalPropertyViews(state, tickets, ar);
  const prop = props[0];
  const kpis = computePortfolioKpis(state, tickets);
  const ledger = state.paymentLedger || [];
  const paidMonths = ledger.filter((l) => l.status === 'paid' || ((l.paid || 0) > 0 && (l.remaining || 0) <= 0.009)).length;
  const lateMonths = ledger.filter((l) => (l.remaining || 0) > 0.009).length;
  const openTickets = tickets.filter((t) => t.status !== 'closed').length;

  const contractsFollowUp = state.contracts.filter((c) => {
    if (!isLegalIsoDate(c.endDate)) return false;
    const days = Math.round((new Date(c.endDate.slice(0, 10) + 'T00:00:00Z').getTime() - Date.now()) / 86400000);
    return days < 0 || days <= 60;
  }).length;

  const reasons = dataQualityReasons(state, prop, ar);
  const issueCount = reasons.filter((r) => r.code !== 'ok').length;
  // Completeness: start 100, subtract for each issue type (bounded).
  const completenessPct = Math.max(0, Math.min(100, 100 - issueCount * 12));

  let statusToday = ar ? 'العقار جاهز للتشغيل' : 'Property ready to operate';
  if (kpis.lateTenants > 0) {
    statusToday = ar
      ? `${kpis.lateTenants} متأخر يحتاج متابعة اليوم`
      : `${kpis.lateTenants} late tenant(s) need follow-up today`;
  } else if (prop?.dataStatus === 'incomplete' || prop?.dataStatus === 'conflicting') {
    statusToday = ar ? 'بيانات تحتاج استكمال قبل الاعتماد الكامل' : 'Data needs completion before full confidence';
  } else if (kpis.vacant > 0) {
    statusToday = ar ? `${kpis.vacant} وحدة شاغرة` : `${kpis.vacant} vacant unit(s)`;
  }

  const lastImport = state.lastImportAt || '';
  return {
    propertyName: state.property.name,
    statusToday,
    arrearsTotal: kpis.arrearsTotal,
    lateTenants: kpis.lateTenants,
    contractsFollowUp,
    vacantUnits: kpis.vacant,
    openTickets,
    lastImportLabel: lastImport ? lastImport.slice(0, 19).replace('T', ' ') : '',
    lastImportMissing: !lastImport,
    completenessPct,
    dataStatus: prop?.dataStatus || 'incomplete',
    dataStatusLabel: prop?.dataStatusLabel || (ar ? 'ناقصة' : 'Incomplete'),
    qualityReasons: reasons,
    paidMonths,
    lateMonths,
    needsReviewItems: issueCount,
  };
}
