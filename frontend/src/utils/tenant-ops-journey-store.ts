/**
 * Tenant ops journeys — payment/maintenance step paths + completed reports.
 * Additive store; does not alter PropertyOS tenant table schema beyond optional notes mirror.
 */
import { storage } from '@/src/utils/storage';
import { formatMonthLabel } from '@/src/types/portal-desk';
import type {
  TenantOpsJourney,
  TenantOpsKind,
  TenantOpsReport,
  TenantOpsState,
  TenantOpsStep,
} from '@/src/types/tenant-ops-journey';
import {
  maintenanceStepDefs,
  paymentStepDefs,
} from '@/src/types/tenant-ops-journey';
import { loadCanonicalTenants, updateCanonicalTenant } from '@/src/utils/canonical-tenant-store';

const KEY = 'spp.tenantOpsJourneys';

const DEFAULT: TenantOpsState = { journeys: [], reports: [] };

let cache: TenantOpsState = { ...DEFAULT };
const listeners = new Set<() => void>();

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function notify() {
  listeners.forEach((fn) => fn());
}

export function subscribeTenantOps(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function loadTenantOps(): Promise<TenantOpsState> {
  const raw = await storage.getItem<string>(KEY, '');
  if (raw) {
    try {
      cache = { ...DEFAULT, ...JSON.parse(raw) };
    } catch { /* ignore */ }
  } else {
    cache = { ...DEFAULT };
  }
  return cache;
}

async function save(next: TenantOpsState) {
  cache = next;
  await storage.setItem(KEY, JSON.stringify(cache));
  notify();
}

function activateFirst(steps: TenantOpsStep[]): TenantOpsStep[] {
  if (!steps.length) return steps;
  return steps.map((s, i) => ({
    ...s,
    status: i === 0 ? 'active' : 'pending',
    at: i === 0 ? new Date().toISOString() : undefined,
  }));
}

function advanceToKey(steps: TenantOpsStep[], key: string): TenantOpsStep[] {
  const idx = steps.findIndex((s) => s.key === key);
  if (idx < 0) return steps;
  // Idempotent: if this step (or a later one) is already done, do not rewind/skip.
  const already = steps[idx]?.status === 'done';
  if (already) return steps;
  const now = new Date().toISOString();
  return steps.map((s, i) => {
    if (i < idx) return { ...s, status: 'done' as const, at: s.at || now };
    if (i === idx) return { ...s, status: 'done' as const, at: now };
    if (i === idx + 1) return { ...s, status: 'active' as const, at: s.at || now };
    return s;
  });
}

function allDone(steps: TenantOpsStep[]) {
  return steps.length > 0 && steps.every((s) => s.status === 'done');
}

async function mirrorNoteToTenant(tenantId: string, lineAr: string, lineEn: string) {
  try {
    const reg = await loadCanonicalTenants();
    const row = reg.tenants.find(
      (t) => t.osTenantId === tenantId || t.id === tenantId,
    );
    if (!row) return;
    const stamp = new Date().toISOString().slice(0, 10);
    const prev = (row.notes || '').trim();
    const line = `• [${stamp}] ${lineAr} | ${lineEn}`;
    const notes = prev ? `${prev}\n${line}` : line;
    await updateCanonicalTenant(row.id, { notes });
  } catch { /* ignore */ }
}

export async function startPaymentJourney(input: {
  tenantId: string;
  tenantName: string;
  unitId?: string;
  unitNumber?: string;
  propertyName?: string;
  paymentId: string;
  monthKey: string;
  amount: number;
}): Promise<TenantOpsJourney> {
  const s = await loadTenantOps();
  const arMonth = formatMonthLabel(input.monthKey, true);
  const enMonth = formatMonthLabel(input.monthKey, false);
  const unit = input.unitNumber || '—';
  const defs = paymentStepDefs(arMonth, enMonth, unit);
  const steps = activateFirst(defs.map((d) => ({
    id: uid('step'),
    key: d.key,
    labelAr: d.labelAr,
    labelEn: d.labelEn,
    status: 'pending' as const,
  })));
  // Notice already sent at create time → mark first done, second active
  const seeded = advanceToKey(steps, 'notice_sent');
  const journey: TenantOpsJourney = {
    id: uid('jpay'),
    kind: 'payment',
    tenantId: input.tenantId,
    tenantName: input.tenantName,
    unitId: input.unitId,
    unitNumber: input.unitNumber,
    propertyName: input.propertyName,
    titleAr: `سداد إيجار ${arMonth} — شقة ${unit}`,
    titleEn: `Rent payment ${enMonth} — unit ${unit}`,
    steps: seeded,
    paymentId: input.paymentId,
    monthKey: input.monthKey,
    amount: input.amount,
    status: 'open',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await save({ ...s, journeys: [journey, ...s.journeys].slice(0, 200) });
  return journey;
}

/** Owner opened / saw the payment request. */
export async function markPaymentOwnerReceived(paymentId: string) {
  const s = await loadTenantOps();
  const j = s.journeys.find((x) => x.paymentId === paymentId && x.status === 'open');
  if (!j) return null;
  const steps = advanceToKey(j.steps, 'owner_received');
  const next = { ...j, steps, updatedAt: new Date().toISOString() };
  await save({
    ...s,
    journeys: s.journeys.map((x) => (x.id === j.id ? next : x)),
  });
  return next;
}

export async function completePaymentJourney(paymentId: string) {
  const s = await loadTenantOps();
  const j = s.journeys.find((x) => x.paymentId === paymentId && x.status === 'open');
  if (!j) return null;
  let steps = advanceToKey(j.steps, 'owner_received');
  steps = advanceToKey(steps, 'owner_approved');
  steps = advanceToKey(steps, 'paid');
  steps = steps.map((st) => ({ ...st, status: 'done' as const, at: st.at || new Date().toISOString() }));
  const now = new Date().toISOString();
  const completed: TenantOpsJourney = {
    ...j,
    steps,
    status: 'completed',
    updatedAt: now,
    completedAt: now,
  };
  const arMonth = formatMonthLabel(j.monthKey || '', true);
  const enMonth = formatMonthLabel(j.monthKey || '', false);
  const summaryAr = `تم سداد إيجار ${arMonth} لسنة ${arMonth.split(' ').slice(-1)[0] || ''} شقة ${j.unitNumber || '—'} — ${j.amount || 0}`;
  const summaryEn = `Rent paid for ${enMonth} unit ${j.unitNumber || '—'} — ${j.amount || 0}`;
  const report: TenantOpsReport = {
    id: uid('rep'),
    journeyId: j.id,
    kind: 'payment',
    tenantId: j.tenantId,
    tenantName: j.tenantName,
    unitNumber: j.unitNumber,
    summaryAr,
    summaryEn,
    monthKey: j.monthKey,
    amount: j.amount,
    createdAt: now,
    noteLineAr: summaryAr,
    noteLineEn: summaryEn,
  };
  await save({
    journeys: s.journeys.map((x) => (x.id === j.id ? completed : x)),
    reports: [report, ...s.reports].slice(0, 300),
  });
  await mirrorNoteToTenant(j.tenantId, report.noteLineAr, report.noteLineEn);
  return { journey: completed, report };
}

export async function startMaintenanceJourney(input: {
  tenantId: string;
  tenantName: string;
  unitId?: string;
  unitNumber?: string;
  propertyName?: string;
  ticketId: string;
  title: string;
  techName?: string;
}): Promise<TenantOpsJourney> {
  const s = await loadTenantOps();
  const techAr = input.techName || 'الفني';
  const techEn = input.techName || 'Technician';
  const defs = maintenanceStepDefs(techAr, techEn);
  const steps = activateFirst(defs.map((d) => ({
    id: uid('step'),
    key: d.key,
    labelAr: d.key === 'tech_received' ? `استلم ${techAr} المهمة` : d.labelAr,
    labelEn: d.key === 'tech_received' ? `${techEn} received the task` : d.labelEn,
    status: 'pending' as const,
  })));
  const seeded = advanceToKey(steps, 'request_sent');
  const journey: TenantOpsJourney = {
    id: uid('jmnt'),
    kind: 'maintenance',
    tenantId: input.tenantId,
    tenantName: input.tenantName,
    unitId: input.unitId,
    unitNumber: input.unitNumber,
    propertyName: input.propertyName,
    titleAr: `صيانة: ${input.title}`,
    titleEn: `Maintenance: ${input.title}`,
    steps: seeded,
    ticketId: input.ticketId,
    techName: input.techName,
    status: 'open',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await save({ ...s, journeys: [journey, ...s.journeys].slice(0, 200) });
  return journey;
}

export async function advanceMaintenanceJourney(
  ticketId: string,
  key: 'owner_approved' | 'tech_received' | 'in_progress' | 'completed' | 'cost_report',
  extras?: { techName?: string; costTotal?: number; noteAr?: string; noteEn?: string },
) {
  const s = await loadTenantOps();
  const j = s.journeys.find((x) => x.ticketId === ticketId && x.status === 'open');
  if (!j) return null;
  let steps = j.steps;
  if (extras?.techName) {
    steps = steps.map((st) => (
      st.key === 'tech_received'
        ? {
          ...st,
          labelAr: `استلم ${extras.techName} المهمة`,
          labelEn: `${extras.techName} received the task`,
        }
        : st
    ));
  }
  steps = advanceToKey(steps, key);
  let journey: TenantOpsJourney = {
    ...j,
    steps,
    techName: extras?.techName || j.techName,
    updatedAt: new Date().toISOString(),
    costReport: extras?.costTotal != null
      ? {
        ...j.costReport,
        total: extras.costTotal,
        noteAr: extras.noteAr,
        noteEn: extras.noteEn,
      }
      : j.costReport,
  };

  let reports = s.reports;
  if (key === 'cost_report' || (key === 'completed' && allDone(advanceToKey(steps, 'cost_report')))) {
    if (key === 'completed') {
      steps = advanceToKey(steps, 'cost_report');
      journey = { ...journey, steps };
    }
  }
  if (key === 'cost_report' || (journey.steps.every((st) => st.status === 'done'))) {
    const now = new Date().toISOString();
    journey = { ...journey, status: 'completed', completedAt: now, updatedAt: now };
    const cost = extras?.costTotal ?? journey.costReport?.total;
    const summaryAr = `صيانة شقة ${journey.unitNumber || '—'} — ${journey.titleAr}${cost != null ? ` · تكلفة ${cost}` : ''}`;
    const summaryEn = `Maintenance unit ${journey.unitNumber || '—'} — ${journey.titleEn}${cost != null ? ` · cost ${cost}` : ''}`;
    const report: TenantOpsReport = {
      id: uid('rep'),
      journeyId: journey.id,
      kind: 'maintenance',
      tenantId: journey.tenantId,
      tenantName: journey.tenantName,
      unitNumber: journey.unitNumber,
      summaryAr,
      summaryEn,
      techName: journey.techName,
      costTotal: cost,
      createdAt: now,
      noteLineAr: summaryAr,
      noteLineEn: summaryEn,
    };
    reports = [report, ...reports].slice(0, 300);
    await mirrorNoteToTenant(journey.tenantId, report.noteLineAr, report.noteLineEn);
  }

  await save({
    journeys: s.journeys.map((x) => (x.id === journey.id ? journey : x)),
    reports,
  });
  return journey;
}

export async function appendTenantLifeEvent(input: {
  tenantId: string;
  tenantName: string;
  unitNumber?: string;
  kind: Extract<TenantOpsKind, 'move' | 'vacate' | 'entry' | 'other'>;
  titleAr: string;
  titleEn: string;
}) {
  const s = await loadTenantOps();
  const now = new Date().toISOString();
  const report: TenantOpsReport = {
    id: uid('rep'),
    journeyId: uid('jlife'),
    kind: input.kind,
    tenantId: input.tenantId,
    tenantName: input.tenantName,
    unitNumber: input.unitNumber,
    summaryAr: input.titleAr,
    summaryEn: input.titleEn,
    createdAt: now,
    noteLineAr: input.titleAr,
    noteLineEn: input.titleEn,
  };
  await save({ ...s, reports: [report, ...s.reports].slice(0, 300) });
  await mirrorNoteToTenant(input.tenantId, report.noteLineAr, report.noteLineEn);
  return report;
}

export function openJourneys(state: TenantOpsState) {
  return state.journeys.filter((j) => j.status === 'open');
}

export function journeysForTenant(state: TenantOpsState, tenantId: string) {
  return state.journeys.filter((j) => j.tenantId === tenantId);
}

export function reportsForTenant(state: TenantOpsState, tenantId: string) {
  return state.reports.filter((r) => r.tenantId === tenantId);
}
