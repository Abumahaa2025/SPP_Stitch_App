/**
 * WP-1 — Materialize upload analysis into a real PropertyOS operational base.
 *
 * Turns the official analysis payload into operational records:
 *   Properties · Units · Tenants · Contracts · Payment Ledger · Payments · Import Batch
 *
 * Rules:
 *  - Real payload data only (property_knowledge, tenant cards + months[], late_payments,
 *    metrics, summary). No demo / no invented values.
 *  - No engine changes, no backend rebuild.
 *  - Merge / update into existing OS with a change log — never delete prior data.
 */
import type { PortfolioAnalysis } from '@/src/api/portfolio-analysis';
import type { ReportT } from '@/src/api/client';
import type {
  ContractRecord,
  ImportBatch,
  ImportChangeEntry,
  PaymentLedgerEntry,
  PaymentRecord,
  PropertyOSState,
  PropertyRecord,
  TenantRecord,
  UnitRecord,
} from '@/src/types/property-os';
import { buildTenantPortal, buildWhatsAppWelcome } from '@/src/hooks/usePropertyOS';
import { storage } from '@/src/utils/storage';

const OS_KEY = 'spp.propertyOS';
const REPORTS_KEY = 'spp.importedReports';
const BATCHES_KEY = 'spp.importBatches';

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function slug(v: string) {
  return String(v || '').trim().replace(/\s+/g, '_').replace(/[^\w\u0600-\u06FF-]/g, '') || 'x';
}

/** WP-4 stable ledger key: tenantId + year-month (never unit-only). */
export function ledgerStableId(tenantId: string, monthKey: string) {
  return `ldg_${tenantId}_${monthKey}`;
}

function ledgerMergeKey(e: Pick<PaymentLedgerEntry, 'tenantId' | 'monthKey'>) {
  return `${e.tenantId}|${e.monthKey}`;
}

/** Rich operational row assembled from every real source in the payload. */
type OpRow = {
  unit: string;
  tenant: string;
  phone: string;
  rent: number;
  contractNumber: string;
  contractStart: string;
  contractEnd: string;
  months: {
    label: string;
    year?: number;
    month?: number;
    due: number;
    paid: number;
    remaining: number;
    status: string;
    statusLabel?: string;
    source: 'tenant_card' | 'late_payments';
  }[];
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Assemble one row per unit from tenant knowledge cards (richest), lifecycle active,
 * and late_payments — merged, so we never rely on activeRows alone.
 */
function buildOperationalRows(analysis: PortfolioAnalysis): OpRow[] {
  const pk = analysis.property_knowledge;
  const cards = pk?.tenants ?? [];
  const active = pk?.lifecycle?.active ?? [];
  const late = analysis.late_payments;

  const byUnit = new Map<string, OpRow>();

  const ensure = (unitRaw: string | undefined, fallbackIdx: number): OpRow => {
    const unit = String(unitRaw ?? '').trim() || String(fallbackIdx + 1);
    let row = byUnit.get(unit);
    if (!row) {
      row = {
        unit,
        tenant: '',
        phone: '',
        rent: 0,
        contractNumber: '',
        contractStart: '',
        contractEnd: '',
        months: [],
      };
      byUnit.set(unit, row);
    }
    return row;
  };

  // 1) Tenant knowledge cards — full identity + contract + months ledger.
  cards.forEach((c, i) => {
    const row = ensure(c.unit, i);
    row.tenant = (c.tenant || row.tenant || '').trim();
    row.phone = (c.phone || row.phone || '').trim();
    row.rent = num(c.rent) || row.rent;
    row.contractNumber = (c.contract || row.contractNumber || '').trim();
    row.contractStart = (c.contract_start || c.contract_start_label || row.contractStart || '').trim();
    row.contractEnd = (c.contract_end || c.contract_end_label || row.contractEnd || '').trim();
    (c.months ?? []).forEach((mth) => {
      row.months.push({
        label: mth.label,
        year: mth.year,
        month: mth.month,
        due: num(mth.due),
        paid: num(mth.paid),
        remaining: num(mth.remaining),
        status: mth.status || '',
        statusLabel: mth.status_label,
        source: 'tenant_card',
      });
    });
  });

  // 2) Lifecycle active — current occupancy wins over historical card names.
  active.forEach((a, i) => {
    const row = ensure(a.unit, cards.length + i);
    if ((a.tenant || '').trim()) row.tenant = String(a.tenant).trim();
    if ((a.phone || '').trim()) row.phone = String(a.phone).trim();
    if (num(a.rent)) row.rent = num(a.rent);
  });

  // 3) late_payments — add late months (due/paid/remaining) not already captured, and
  //    backfill contract / phone from the arrears view.
  const seenMonth = new Set<string>();
  byUnit.forEach((row) => row.months.forEach((m) => seenMonth.add(`${row.unit}|${m.label}`)));

  (late?.months ?? []).forEach((mth) => {
    (mth.tenants ?? []).forEach((te, i) => {
      const row = ensure(te.unit, i);
      if (!row.tenant) row.tenant = (te.tenant || '').trim();
      if (!row.phone) row.phone = (te.phone || '').trim();
      if (!row.contractNumber && te.contract) row.contractNumber = te.contract.trim();
      const key = `${row.unit}|${mth.label}`;
      if (!seenMonth.has(key)) {
        seenMonth.add(key);
        row.months.push({
          label: mth.label,
          year: mth.year,
          month: mth.month,
          due: num(te.due),
          paid: num(te.paid),
          remaining: num(te.remaining),
          status: te.status || 'unpaid',
          statusLabel: te.status_label,
          source: 'late_payments',
        });
      }
    });
  });

  return [...byUnit.values()].filter((r) => r.tenant || r.unit);
}

export type ApplyCommit = {
  analysis_id: string;
  property_id: string;
  units: number;
  tenants: number;
  contracts: number;
  report_id: string;
  period?: string;
  success_message?: string;
  ledger_entries?: number;
  /** Counted from materialised paymentLedger (not summary alone). */
  paid_months?: number;
  late_months?: number;
  payments?: number;
  import_batch_id?: string;
  change_counts?: { added: number; updated: number; conflicts?: number };
  summary?: {
    properties?: number;
    units?: number;
    tenants?: number;
    contracts?: number;
    rents?: number;
    collected?: number;
    remaining?: number;
    late_tenants?: number;
    contracts_expired?: number;
    contracts_expiring_soon?: number;
    gaps?: number;
  };
};

function countLedgerMonths(ledger: PaymentLedgerEntry[]): { paid: number; late: number } {
  let paid = 0;
  let late = 0;
  for (const l of ledger) {
    const rem = Number(l.remaining) || 0;
    const st = (l.status || '').toLowerCase();
    if (rem > 0.009 || st === 'unpaid' || st === 'unpaid_confirmed' || st === 'partial') {
      late += 1;
    } else if (st === 'paid' || ((Number(l.paid) || 0) > 0 && rem <= 0.009)) {
      paid += 1;
    }
  }
  return { paid, late };
}

type IncomingRecords = {
  property: PropertyRecord;
  units: UnitRecord[];
  tenants: TenantRecord[];
  contracts: ContractRecord[];
  ledger: PaymentLedgerEntry[];
  payments: PaymentRecord[];
};

/** Build fresh operational records from the analysis (no storage read — pure). */
export function buildIncomingRecords(
  analysis: PortfolioAnalysis,
  lang: 'ar' | 'en',
  /** Reuse existing property id on merge so units/tenants/contracts stay stable across Applies. */
  existingPropertyId?: string | null,
): IncomingRecords {
  const m = analysis.metrics;
  const brief = analysis.executive_brief;
  const period = brief?.period || '';
  // Stable property id — NEVER key off analysis_id (that would duplicate the whole OS on every Apply).
  const propId = existingPropertyId || 'prop_imp_primary';
  const now = new Date().toISOString();

  const rows = buildOperationalRows(analysis);

  const property: PropertyRecord = {
    id: propId,
    name: lang === 'ar' ? 'العقار المستورد' : 'Imported property',
    type: 'mixed',
    city: '—',
    district: period || '—',
    buildingCount: 1,
    unitCount: Math.max(1, rows.length || m.units || 0),
    createdAt: now,
  };

  const units: UnitRecord[] = [];
  const tenants: TenantRecord[] = [];
  const contracts: ContractRecord[] = [];
  const ledger: PaymentLedgerEntry[] = [];
  const payments: PaymentRecord[] = [];

  rows.forEach((row, i) => {
    const unitNum = row.unit || String(i + 1);
    // Stable ids by unit number — merge updates the same rows across consecutive Applies.
    const unitId = `unit_imp_${slug(unitNum)}`;
    const tid = `ten_imp_${slug(unitNum)}`;
    const rent = num(row.rent);
    const isShop = /محل|shop|تجاري/i.test(unitNum);

    units.push({
      id: unitId,
      propertyId: propId,
      number: unitNum,
      type: isShop ? 'shop' : 'apartment',
      status: 'occupied',
      rentAmount: rent,
      rentPeriod: 'monthly',
      paymentMethod: 'transfer',
      paymentDueDay: 1,
      electricity: 'tenant',
      water: 'tenant',
      internet: 'tenant',
      gas: 'independent',
      maintenanceBy: 'owner',
      hasInsurance: false,
    });

    const token = uid('tok').slice(-12);
    const portal = buildTenantPortal(tid, token);
    const name = (row.tenant || '—').trim() || '—';
    const phone = (row.phone || '').trim();
    tenants.push({
      id: tid,
      name,
      phone,
      email: '',
      unitId,
      // Real date only — never invent today's date when Source has none.
      moveInDate: (row.contractStart || '').slice(0, 10),
      portalToken: portal.token,
      portalUrl: portal.url,
      qrData: portal.qrData,
      whatsAppMessage: buildWhatsAppWelcome(name, portal.url, lang),
    });

    // WP-1/WP-3: one contract per operational row — never invent IMP-* numbers.
    contracts.push({
      id: `ct_imp_${slug(unitNum)}`,
      number: (row.contractNumber || '').trim(),
      tenantId: tid,
      unitId,
      // Keep full payload labels (period or ISO). Never invent Apply/today as dates.
      startDate: (row.contractStart || '').trim(),
      endDate: (row.contractEnd || '').trim(),
      rentAmount: rent,
      paymentType: 'monthly',
      depositAmount: 0,
      specialTerms: lang === 'ar' ? 'من اعتماد الاستيراد' : 'From import apply',
    });

    // Payment ledger from real months[] — WP-4: no synthesized PaymentRecord rows.
    row.months.forEach((mth, mi) => {
      const monthKey = mth.year && mth.month ? `${mth.year}-${String(mth.month).padStart(2, '0')}` : slug(mth.label) || `m${mi}`;
      ledger.push({
        id: ledgerStableId(tid, monthKey),
        tenantId: tid,
        unitId,
        unit: unitNum,
        tenant: name,
        monthKey,
        monthLabel: mth.label,
        year: mth.year,
        month: mth.month,
        due: mth.due,
        paid: mth.paid,
        remaining: mth.remaining,
        status: mth.status,
        statusLabel: mth.statusLabel,
        source: mth.source === 'late_payments' ? 'late_payments' : 'tenant_card',
      });
    });
  });

  property.unitCount = Math.max(property.unitCount, units.length);

  return { property, units, tenants, contracts, ledger, payments };
}

function buildReport(analysis: PortfolioAnalysis, lang: 'ar' | 'en'): ReportT {
  const brief = analysis.executive_brief;
  const period = brief?.period || '';
  const now = new Date().toISOString();
  return {
    id: analysis.analysis_id,
    kind: 'monthly',
    title: brief?.title || analysis.executive_report?.title || (lang === 'ar' ? 'التقرير التنفيذي' : 'Executive report'),
    subtitle: period || (lang === 'ar' ? 'بعد اعتماد الاستيراد' : 'After import apply'),
    highlight: (analysis.success_message || brief?.property_status || '').slice(0, 160),
    created_at: now,
    pages: Math.max(1, analysis.executive_report?.sections?.length || 1),
    accent: 'gold',
  };
}

/** Legacy-compatible builder: returns a fresh (non-merged) state + report + commit. */
export function buildPropertyOSFromAnalysis(
  analysis: PortfolioAnalysis,
  lang: 'ar' | 'en',
): { state: PropertyOSState; report: ReportT; commit: ApplyCommit } {
  const now = new Date().toISOString();
  const { property, units, tenants, contracts, ledger, payments } = buildIncomingRecords(analysis, lang);
  const report = buildReport(analysis, lang);
  const m = analysis.metrics;
  const period = analysis.executive_brief?.period || '';
  const monthCounts = countLedgerMonths(ledger);

  const summary = analysis.summary || {
    properties: 1,
    units: m.units || units.length,
    tenants: tenants.length,
    contracts: contracts.length,
    rents: m.rents ?? m.total_revenue_annual ?? 0,
    collected: m.collected ?? 0,
    remaining: m.remaining ?? 0,
    late_tenants: m.late_tenants ?? 0,
    late_value: m.late_value ?? 0,
    contracts_expired: m.contracts_expired ?? 0,
    contracts_expiring_soon: m.contracts_expiring_soon ?? 0,
    missing_phone: m.missing_phone ?? 0,
    missing_contract: m.missing_contract ?? 0,
    gaps: m.gaps ?? 0,
  };

  const state: PropertyOSState = {
    property,
    units,
    tenants,
    contracts,
    alertsEnabled: true,
    technicianPortalToken: uid('tech').slice(-12),
    dismissedProgress: true,
    setupCompleted: true,
    unitHistory: [],
    payments,
    paymentLedger: ledger,
    startedAt: now,
    lastImportAt: now,
  };

  return {
    state,
    report,
    commit: {
      analysis_id: analysis.analysis_id,
      property_id: property.id,
      units: units.length,
      tenants: tenants.length,
      contracts: contracts.length,
      report_id: report.id,
      period,
      success_message: analysis.success_message,
      ledger_entries: ledger.length,
      paid_months: monthCounts.paid,
      late_months: monthCounts.late,
      payments: payments.length,
      summary: {
        ...summary,
        // Never report 0 properties when a property record was materialised.
        properties: Math.max(1, Number(summary.properties) || 0),
        units: units.length,
        tenants: tenants.length,
        contracts: contracts.length,
      },
    },
  };
}

function mergePaymentLedger(
  existing: PaymentLedgerEntry[],
  incoming: PaymentLedgerEntry[],
  changeLog: ImportChangeEntry[],
  batchId: string,
  now: string,
  lang: 'ar' | 'en',
): PaymentLedgerEntry[] {
  const map = new Map<string, PaymentLedgerEntry>();
  for (const e of existing) {
    map.set(ledgerMergeKey(e), { ...e, id: ledgerStableId(e.tenantId, e.monthKey) });
  }
  for (const raw of incoming) {
    const rec: PaymentLedgerEntry = {
      ...raw,
      id: ledgerStableId(raw.tenantId, raw.monthKey),
      lastUpdatedAt: now,
      importBatchId: batchId,
    };
    const key = ledgerMergeKey(rec);
    const prev = map.get(key);
    const label = `${rec.unit} · ${rec.monthLabel}`;
    if (!prev) {
      changeLog.push({ type: 'added', entity: 'ledger', id: rec.id, detail: label });
      map.set(key, rec);
      continue;
    }
    const amountsChanged =
      Math.abs((prev.due || 0) - (rec.due || 0)) > 0.009 ||
      Math.abs((prev.paid || 0) - (rec.paid || 0)) > 0.009 ||
      Math.abs((prev.remaining || 0) - (rec.remaining || 0)) > 0.009;
    const merged: PaymentLedgerEntry = {
      ...rec,
      conflictNote: amountsChanged
        ? lang === 'ar'
          ? `تعارض: مستحق ${prev.due}→${rec.due} · مدفوع ${prev.paid}→${rec.paid} · متبقي ${prev.remaining}→${rec.remaining}`
          : `Conflict: due ${prev.due}→${rec.due} · paid ${prev.paid}→${rec.paid} · rem ${prev.remaining}→${rec.remaining}`
        : prev.conflictNote,
    };
    if (amountsChanged) {
      changeLog.push({ type: 'conflict', entity: 'ledger', id: merged.id, detail: label });
      changeLog.push({ type: 'updated', entity: 'ledger', id: merged.id, detail: label });
    } else if (JSON.stringify(prev) !== JSON.stringify(merged)) {
      changeLog.push({ type: 'updated', entity: 'ledger', id: merged.id, detail: label });
    }
    map.set(key, merged);
  }
  return [...map.values()];
}

function mergeById<T extends { id: string }>(
  existing: T[],
  incoming: T[],
  entity: ImportChangeEntry['entity'],
  changeLog: ImportChangeEntry[],
  labelOf: (r: T) => string,
  preserve?: (prev: T, next: T) => T,
): T[] {
  const map = new Map(existing.map((r) => [r.id, r] as const));
  incoming.forEach((rec) => {
    const prev = map.get(rec.id);
    const merged = prev && preserve ? preserve(prev, rec) : rec;
    if (prev) {
      const before = JSON.stringify(prev);
      const after = JSON.stringify(merged);
      if (before !== after) {
        changeLog.push({ type: 'updated', entity, id: rec.id, detail: labelOf(merged) });
      }
    } else {
      changeLog.push({ type: 'added', entity, id: rec.id, detail: labelOf(merged) });
    }
    map.set(rec.id, merged);
  });
  return [...map.values()];
}

/**
 * Persist Apply: build operational records, MERGE into existing OS (no deletion),
 * record a change log, and append an Import Batch. Also refreshes imported reports.
 */
export async function persistApplyFromAnalysis(
  analysis: PortfolioAnalysis,
  lang: 'ar' | 'en',
): Promise<ApplyCommit> {
  const now = new Date().toISOString();

  // Read existing OS to merge (never overwrite prior operational data).
  let prevState: PropertyOSState | null = null;
  try {
    const raw = await storage.getItem<string>(OS_KEY, '');
    if (raw) prevState = JSON.parse(raw) as PropertyOSState;
  } catch {
    prevState = null;
  }

  const incoming = buildIncomingRecords(analysis, lang, prevState?.property?.id);
  const report = buildReport(analysis, lang);
  const changeLog: ImportChangeEntry[] = [];

  if (!prevState?.property) {
    changeLog.push({ type: 'added', entity: 'property', id: incoming.property.id, detail: incoming.property.name });
  } else if (prevState.property.id === incoming.property.id) {
    // same property — district/period may refresh
    if (prevState.property.district !== incoming.property.district) {
      changeLog.push({ type: 'updated', entity: 'property', id: prevState.property.id, detail: incoming.property.name });
    }
  }

  const units = mergeById(prevState?.units ?? [], incoming.units, 'unit', changeLog, (u) => `#${u.number}`);
  const tenants = mergeById(
    prevState?.tenants ?? [],
    incoming.tenants,
    'tenant',
    changeLog,
    (t) => t.name,
    // Keep portal credentials stable across re-apply of the same tenant id.
    (prev, next) => ({
      ...next,
      portalToken: prev.portalToken || next.portalToken,
      portalUrl: prev.portalUrl || next.portalUrl,
      qrData: prev.qrData || next.qrData,
      whatsAppMessage: prev.whatsAppMessage || next.whatsAppMessage,
    }),
  );
  const contracts = mergeById(prevState?.contracts ?? [], incoming.contracts, 'contract', changeLog, (c) => c.number);
  const batchId = `batch_${analysis.analysis_id.slice(0, 8)}_${Date.now().toString(36)}`;
  const ledger = mergePaymentLedger(
    prevState?.paymentLedger ?? [],
    incoming.ledger,
    changeLog,
    batchId,
    now,
    lang,
  );
  const payments = mergeById(prevState?.payments ?? [], incoming.payments, 'payment', changeLog, (p) => `${p.amount}`);

  // Keep existing property identity if present; refresh unit count / period district.
  const property: PropertyRecord = prevState?.property
    ? {
        ...prevState.property,
        district: incoming.property.district || prevState.property.district,
        unitCount: Math.max(prevState.property.unitCount, units.length),
      }
    : incoming.property;

  const summary = analysis.summary;
  const added = changeLog.filter((c) => c.type === 'added').length;
  const updated = changeLog.filter((c) => c.type === 'updated').length;
  const conflicts = changeLog.filter((c) => c.type === 'conflict').length;

  const batch: ImportBatch = {
    id: batchId,
    analysisId: analysis.analysis_id,
    appliedAt: now,
    source: analysis._source || 'property_knowledge',
    period: analysis.executive_brief?.period || '',
    counts: {
      properties: property ? 1 : 0,
      units: incoming.units.length,
      tenants: incoming.tenants.length,
      contracts: incoming.contracts.length,
      ledgerEntries: incoming.ledger.length,
      payments: incoming.payments.length,
    },
    changeCounts: { added, updated, conflicts },
    dataStatus: summary?.data_status?.overall,
    maintenance: {
      count: num(summary?.maintenance?.count ?? summary?.maintenance_count),
      total: num(summary?.maintenance?.total ?? summary?.maintenance_total),
      note:
        lang === 'ar'
          ? 'إجمالي الصيانة من التحليل — سجلات البلاغات التفصيلية تحتاج دعم المصدر'
          : 'Aggregate maintenance from analysis — detailed tickets need Source support',
    },
    changeLog,
  };

  const nextState: PropertyOSState = {
    property,
    units,
    tenants,
    contracts,
    alertsEnabled: prevState?.alertsEnabled ?? true,
    technicianPortalToken: prevState?.technicianPortalToken || uid('tech').slice(-12),
    dismissedProgress: true,
    setupCompleted: true,
    unitHistory: prevState?.unitHistory ?? [],
    payments,
    paymentLedger: ledger,
    startedAt: prevState?.startedAt ?? now,
    lastImportAt: now,
    lastImportBatchId: batchId,
  };

  await storage.setItem(OS_KEY, JSON.stringify(nextState));

  // Append import batch history (newest first, keep prior batches — no deletion).
  const prevBatchesRaw = await storage.getItem<string>(BATCHES_KEY, '[]');
  let prevBatches: ImportBatch[] = [];
  try {
    prevBatches = JSON.parse(prevBatchesRaw || '[]') as ImportBatch[];
  } catch {
    prevBatches = [];
  }
  const batches = [batch, ...prevBatches.filter((b) => b.id !== batch.id)].slice(0, 50);
  await storage.setItem(BATCHES_KEY, JSON.stringify(batches));

  // Imported reports (unchanged behaviour).
  const prevReportsRaw = await storage.getItem<string>(REPORTS_KEY, '[]');
  let prevReports: ReportT[] = [];
  try {
    prevReports = JSON.parse(prevReportsRaw || '[]') as ReportT[];
  } catch {
    prevReports = [];
  }
  const nextReports = [report, ...prevReports.filter((r) => r.id !== report.id)].slice(0, 20);
  await storage.setItem(REPORTS_KEY, JSON.stringify(nextReports));

  const commit: ApplyCommit = {
    analysis_id: analysis.analysis_id,
    property_id: property.id,
    units: incoming.units.length,
    tenants: incoming.tenants.length,
    contracts: incoming.contracts.length,
    report_id: report.id,
    period: analysis.executive_brief?.period || '',
    success_message: analysis.success_message,
    ledger_entries: incoming.ledger.length,
    paid_months: countLedgerMonths(incoming.ledger).paid,
    late_months: countLedgerMonths(incoming.ledger).late,
    payments: incoming.payments.length,
    import_batch_id: batchId,
    change_counts: { added, updated, conflicts },
    summary: {
      ...(summary || {}),
      // Materialised property always counts as ≥1 (summary.properties may be 0).
      properties: property ? Math.max(1, Number(summary?.properties) || 0) : 0,
      units: incoming.units.length,
      tenants: incoming.tenants.length,
      contracts: incoming.contracts.length,
    },
  };

  await storage.setItem(
    'spp.lastApplyProof',
    JSON.stringify({ ...commit, applied_at: now, source: 'property_knowledge' }),
  );
  return commit;
}
