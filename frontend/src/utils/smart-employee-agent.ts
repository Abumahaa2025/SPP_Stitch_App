/**
 * Smart Property Employee agent — thinks over Property OS + ops, proposes executable work.
 * Runs on-device (no cloud LLM required). Soft adaptation from owner dismiss/execute.
 * External enrich (optional) via smart-employee-enrich.ts.
 */
import type { PropertyOSState } from '@/src/types/property-os';
import type { MaintenanceTicket } from '@/src/types/operational';
import type {
  EmployeeActivity,
  EmployeePrefs,
  EmployeeTask,
  EmployeeTaskKind,
  SmartEmployeeState,
} from '@/src/types/smart-employee';
import { EMPTY_EMPLOYEE_PREFS } from '@/src/types/smart-employee';
import { arrearsFromPropertyOS, isArrearsLedgerEntry } from '@/src/utils/ops-truth';
import { buildWhatsAppCollectionMessage } from '@/src/utils/canonical-tenant-store';
import { buildWhatsAppWelcome } from '@/src/hooks/usePropertyOS';
import { upgradeLegacyPortalBridgeUrl } from '@/src/utils/portal-links';
import type { CanonicalTenant } from '@/src/types/canonical-tenant';

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function daysUntil(iso: string): number {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 9999;
  return Math.ceil((t - Date.now()) / 86400000);
}

function stableId(kind: string, key: string) {
  return `se_${kind}_${key}`.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 64);
}

function mergePrefs(prev?: EmployeePrefs | null): EmployeePrefs {
  return {
    ...EMPTY_EMPLOYEE_PREFS,
    ...(prev || {}),
    dismissCountByKind: { ...(prev?.dismissCountByKind || {}) },
    lastDismissedAtByKind: { ...(prev?.lastDismissedAtByKind || {}) },
    quietUntilByKind: { ...(prev?.quietUntilByKind || {}) },
  };
}

/** Critical kinds ignore quiet window. */
const NEVER_QUIET: EmployeeTaskKind[] = [
  'collect_arrears',
  'escalate_collection',
  'expired_contract',
  'follow_up',
];

function isKindQuiet(prefs: EmployeePrefs, kind: EmployeeTaskKind): boolean {
  if (NEVER_QUIET.includes(kind)) return false;
  const until = prefs.quietUntilByKind[kind];
  if (!until) return false;
  return new Date(until).getTime() > Date.now();
}

function priorityFromScore(score: number): 1 | 2 | 3 {
  if (score >= 80) return 1;
  if (score >= 50) return 2;
  return 3;
}

function escalateCollectionMessage(
  name: string,
  unit: string,
  total: number,
  ar: boolean,
): string {
  const amount = total.toLocaleString(ar ? 'ar-SA' : undefined);
  if (ar) {
    return `السلام عليكم ${name}،\n\nمتابعة ثانية بخصوص مستحقات وحدة ${unit}.\nالمبلغ المتبقي: ${amount} ر.س\n\nنرجو التسوية اليوم أو الرد لتحديد موعد السداد، تجنباً لإجراءات المتابعة الرسمية.`;
  }
  return `Hello ${name},\n\nSecond follow-up for unit ${unit} dues.\nRemaining: ${amount} SAR\n\nPlease settle today or reply with a payment date to avoid formal follow-up.`;
}

type ThinkInput = {
  os: PropertyOSState;
  openTickets?: MaintenanceTicket[];
  previous?: SmartEmployeeState | null;
};

/** Analyze portfolio and produce today's work queue + thought line. */
export function thinkSmartEmployee(input: ThinkInput): SmartEmployeeState {
  const { os, openTickets = [], previous } = input;
  const now = new Date().toISOString();
  const prefs = mergePrefs(previous?.prefs);
  const prevById = new Map((previous?.tasks || []).map((t) => [t.id, t]));

  const keepStatus = (id: string): EmployeeTask['status'] | undefined => {
    const p = prevById.get(id);
    if (!p) return undefined;
    if (p.status === 'done' || p.status === 'dismissed') return p.status;
    if (p.status === 'waiting_followup' && p.followUpAt && new Date(p.followUpAt).getTime() > Date.now()) {
      return 'waiting_followup';
    }
    return undefined;
  };

  const proposed: EmployeeTask[] = [];

  const pushTask = (task: EmployeeTask) => {
    if (isKindQuiet(prefs, task.kind) && task.priority > 1) return;
    proposed.push({ ...task, source: 'local' });
  };

  // --- Arrears collection (+ escalate after prior follow-up) ---
  const truth = arrearsFromPropertyOS(os);
  const ledger = (os.paymentLedger || []).filter(isArrearsLedgerEntry);
  const byTenant = new Map<string, {
    name: string; phone: string; unit: string; unitId: string; total: number; osTenantId: string;
  }>();
  for (const row of ledger) {
    const tenant = os.tenants.find((t) => t.id === row.tenantId);
    const prev = byTenant.get(row.tenantId) || {
      name: row.tenant || tenant?.name || '—',
      phone: tenant?.phone || '',
      unit: row.unit || '—',
      unitId: row.unitId || tenant?.unitId || '',
      total: 0,
      osTenantId: row.tenantId,
    };
    prev.total += Number(row.remaining) || 0;
    if (!prev.phone && tenant?.phone) prev.phone = tenant.phone;
    byTenant.set(row.tenantId, prev);
  }
  const late = [...byTenant.values()].filter((x) => x.total > 0.009).sort((a, b) => b.total - a.total);

  for (const row of late.slice(0, 8)) {
    const baseId = stableId('collect', row.osTenantId);
    const prevTask = prevById.get(baseId) || prevById.get(stableId('escalate', row.osTenantId));
    const attempts = prevTask?.attemptCount || 0;
    const dueFollow = prevTask?.status === 'waiting_followup'
      && prevTask.followUpAt
      && new Date(prevTask.followUpAt).getTime() <= Date.now();
    const escalate = attempts >= 1 || dueFollow || prevTask?.kind === 'escalate_collection';

    const id = escalate ? stableId('escalate', row.osTenantId) : baseId;
    const preserved = keepStatus(id) || (escalate ? undefined : keepStatus(baseId));
    if (preserved === 'done' || preserved === 'dismissed') continue;
    if (preserved === 'waiting_followup' && !dueFollow) {
      // keep snoozed collect visible as waiting
    }

    const ct = {
      id: row.osTenantId,
      name: row.name,
      phone: row.phone,
      unitNumber: row.unit,
      rentAmount: Number(os.units.find((u) => u.id === row.unitId)?.rentAmount || 0),
    } as CanonicalTenant;

    const score = Math.min(100, 55 + Math.round(row.total / 200) + (escalate ? 25 : 0) + (row.total > 5000 ? 10 : 0));
    const msg = escalate
      ? escalateCollectionMessage(row.name, row.unit, row.total, true)
      : buildWhatsAppCollectionMessage(ct, true, row.total);

    pushTask({
      id,
      kind: escalate ? 'escalate_collection' : 'collect_arrears',
      status: preserved === 'waiting_followup' && !dueFollow ? 'waiting_followup' : (preserved || 'suggested'),
      priority: priorityFromScore(score),
      score,
      titleAr: escalate ? `تصعيد تحصيل: ${row.name}` : `تحصيل من ${row.name}`,
      titleEn: escalate ? `Escalate collection: ${row.name}` : `Collect from ${row.name}`,
      reasonAr: escalate
        ? `متابعة ${attempts || 1}+ · وحدة ${row.unit}: ${row.total.toLocaleString('ar-SA')} ر.س`
        : `متأخرات وحدة ${row.unit}: ${row.total.toLocaleString('ar-SA')} ر.س`,
      reasonEn: escalate
        ? `Follow-up #${attempts || 1} · unit ${row.unit}: ${row.total.toLocaleString()} SAR`
        : `Unit ${row.unit} arrears: ${row.total.toLocaleString()} SAR`,
      action: row.phone ? 'send_whatsapp' : 'open_database',
      actionLabelAr: row.phone
        ? (escalate ? 'جهّز تصعيد واتساب' : 'جهّز تذكير واتساب')
        : 'افتح مركز البيانات',
      actionLabelEn: row.phone
        ? (escalate ? 'Prepare WhatsApp escalation' : 'Prepare WhatsApp reminder')
        : 'Open database',
      whatsappPhone: row.phone,
      whatsappMessage: msg,
      route: '/database',
      tenantId: row.osTenantId,
      unitId: row.unitId,
      unitNumber: row.unit,
      amount: row.total,
      attemptCount: attempts,
      // GAP-C01: collection/escalation require owner approval before deep-link open
      requiresOwnerApproval: Boolean(row.phone),
      createdAt: prevById.get(id)?.createdAt || prevTask?.createdAt || now,
      updatedAt: now,
      followUpAt: preserved === 'waiting_followup' ? prevById.get(id)?.followUpAt : undefined,
      followUpNoteAr: escalate ? 'تحقق من السداد خلال 24 ساعة' : 'تابع هل تم السداد خلال 48 ساعة',
      followUpNoteEn: escalate ? 'Verify payment within 24h' : 'Follow up if paid within 48h',
    });
  }

  // --- Expired contracts (past end date) ---
  for (const c of os.contracts) {
    const d = daysUntil(c.endDate);
    if (d >= 0 || d < -120) continue;
    const tenant = os.tenants.find((t) => t.id === c.tenantId);
    const unit = os.units.find((u) => u.id === c.unitId);
    const id = stableId('expired', c.id);
    const preserved = keepStatus(id);
    if (preserved === 'done' || preserved === 'dismissed') continue;
    const score = Math.min(100, 85 + Math.min(15, Math.abs(d)));
    pushTask({
      id,
      kind: 'expired_contract',
      status: preserved || 'suggested',
      priority: 1,
      score,
      titleAr: `عقد منتهٍ: ${tenant?.name || unit?.number || ''}`,
      titleEn: `Expired contract: ${tenant?.name || unit?.number || ''}`,
      reasonAr: `انتهى منذ ${Math.abs(d)} يوم · وحدة ${unit?.number || '—'} — جدّد أو أخْلِ`,
      reasonEn: `Ended ${Math.abs(d)} days ago · unit ${unit?.number || '—'} — renew or vacate`,
      action: 'open_contracts',
      actionLabelAr: 'افتح العقود ونفّذ',
      actionLabelEn: 'Open contracts',
      route: '/contracts',
      tenantId: c.tenantId,
      unitId: c.unitId,
      unitNumber: unit?.number,
      createdAt: prevById.get(id)?.createdAt || now,
      updatedAt: now,
      followUpNoteAr: 'أكد التجديد أو إخلاء الوحدة',
      followUpNoteEn: 'Confirm renew or vacate',
    });
  }

  // --- Expiring contracts ---
  for (const c of os.contracts) {
    const d = daysUntil(c.endDate);
    if (d < 0 || d > 45) continue;
    const tenant = os.tenants.find((t) => t.id === c.tenantId);
    const unit = os.units.find((u) => u.id === c.unitId);
    const id = stableId('renew', c.id);
    const preserved = keepStatus(id);
    if (preserved === 'done' || preserved === 'dismissed') continue;
    const score = d <= 7 ? 90 : d <= 14 ? 75 : 55;
    pushTask({
      id,
      kind: 'renew_contract',
      status: preserved || 'suggested',
      priority: priorityFromScore(score),
      score,
      titleAr: `تجديد عقد ${tenant?.name || unit?.number || ''}`,
      titleEn: `Renew contract ${tenant?.name || unit?.number || ''}`,
      reasonAr: `ينتهي خلال ${d} يوم · وحدة ${unit?.number || '—'}`,
      reasonEn: `Ends in ${d} days · unit ${unit?.number || '—'}`,
      action: 'open_contracts',
      actionLabelAr: 'افتح العقود ونفّذ',
      actionLabelEn: 'Open contracts',
      route: '/contracts',
      tenantId: c.tenantId,
      unitId: c.unitId,
      unitNumber: unit?.number,
      createdAt: prevById.get(id)?.createdAt || now,
      updatedAt: now,
      followUpNoteAr: 'أكد التجديد أو الإخلاء',
      followUpNoteEn: 'Confirm renew or vacate',
    });
  }

  // --- Vacant units (rent loss signal) ---
  const vacant = os.units.filter((u) => u.status === 'vacant');
  if (vacant.length > 0) {
    const id = stableId('vacancy', os.property?.id || 'prop');
    const preserved = keepStatus(id);
    if (preserved !== 'done' && preserved !== 'dismissed') {
      const loss = vacant.reduce((s, u) => s + (Number(u.rentAmount) || 0), 0);
      const score = Math.min(95, 45 + vacant.length * 8 + (loss > 10000 ? 15 : 0));
      pushTask({
        id,
        kind: 'fill_vacancy',
        status: preserved || 'suggested',
        priority: priorityFromScore(score),
        score,
        titleAr: `شواغر تحتاج مستأجر (${vacant.length})`,
        titleEn: `Vacancies need tenants (${vacant.length})`,
        reasonAr: `وحدات: ${vacant.slice(0, 6).map((u) => u.number).join('، ')}${loss > 0 ? ` · إيجار محتمل ~${loss.toLocaleString('ar-SA')} ر.س/شهر` : ''}`,
        reasonEn: `Units: ${vacant.slice(0, 6).map((u) => u.number).join(', ')}${loss > 0 ? ` · potential rent ~${loss.toLocaleString()} SAR/mo` : ''}`,
        action: 'open_database',
        actionLabelAr: 'أضف مستأجراً من مركز البيانات',
        actionLabelEn: 'Add tenant in database',
        route: '/database',
        amount: loss || undefined,
        createdAt: prevById.get(id)?.createdAt || now,
        updatedAt: now,
      });
    }
  }

  // --- Open maintenance ---
  const stuck = openTickets.filter((tk) =>
    ['open', 'assigned', 'awaiting_tenant'].includes(tk.status));
  for (const tk of stuck.slice(0, 5)) {
    const id = stableId('maint', tk.id);
    const preserved = keepStatus(id);
    if (preserved === 'done' || preserved === 'dismissed') continue;
    const unit = os.units.find((u) => u.id === tk.unitId);
    const ageDays = tk.createdAt ? Math.max(0, -daysUntil(tk.createdAt)) : 0;
    const score = tk.status === 'open' ? 70 + Math.min(20, ageDays) : 55;
    pushTask({
      id,
      kind: 'maintenance_follow',
      status: preserved || 'suggested',
      priority: priorityFromScore(score),
      score,
      titleAr: `متابعة صيانة: ${tk.title}`,
      titleEn: `Follow maintenance: ${tk.title}`,
      reasonAr: `حالة ${tk.status} · وحدة ${unit?.number || '—'}${ageDays ? ` · منذ ${ageDays} يوم` : ''}`,
      reasonEn: `Status ${tk.status} · unit ${unit?.number || '—'}${ageDays ? ` · ${ageDays}d open` : ''}`,
      action: 'open_maintenance',
      actionLabelAr: 'افتح الصيانة ونفّذ',
      actionLabelEn: 'Open maintenance',
      route: '/maintenance',
      unitId: tk.unitId,
      unitNumber: unit?.number,
      createdAt: prevById.get(id)?.createdAt || now,
      updatedAt: now,
      followUpNoteAr: 'أكد إغلاق البلاغ أو تحديث الحالة',
      followUpNoteEn: 'Confirm ticket closed or status updated',
    });
  }

  // --- Tenants missing phone ---
  const noPhone = os.tenants.filter((t) => !String(t.phone || '').replace(/\D/g, ''));
  if (noPhone.length > 0) {
    const id = stableId('portal', 'missing_phone');
    const preserved = keepStatus(id);
    if (preserved !== 'done' && preserved !== 'dismissed') {
      pushTask({
        id,
        kind: 'send_portal_link',
        status: preserved || 'suggested',
        priority: 3,
        score: 35,
        titleAr: `استكمال بيانات تواصل (${noPhone.length})`,
        titleEn: `Complete contact data (${noPhone.length})`,
        reasonAr: 'مستأجرون بلا جوال — لا يمكن إرسال رابط/تذكير',
        reasonEn: 'Tenants without phone — cannot send link/reminder',
        action: 'open_database',
        actionLabelAr: 'حدّث الجوال في مركز البيانات',
        actionLabelEn: 'Update phones in database',
        route: '/database',
        createdAt: prevById.get(id)?.createdAt || now,
        updatedAt: now,
      });
    }
  }

  // --- Share portal links (tenants with phone + portal) ---
  const shareCandidates = os.tenants
    .filter((t) => String(t.phone || '').replace(/\D/g, '').length >= 9 && (t.portalUrl || t.portalToken))
    .slice(0, 1);
  for (const t of shareCandidates) {
    const id = stableId('share', t.id);
    const preserved = keepStatus(id);
    if (preserved === 'done' || preserved === 'dismissed' || preserved === 'waiting_followup') continue;
    // Only suggest if never executed before in previous history
    if (prevById.get(id)?.executedAt) continue;
    const unit = os.units.find((u) => u.id === t.unitId);
    const url = upgradeLegacyPortalBridgeUrl(t.portalUrl || '');
    if (!url) continue;
    const preferWa = prefs.whatsappWins >= prefs.routeWins;
    pushTask({
      id,
      kind: 'share_portal',
      status: 'suggested',
      priority: 3,
      score: 40,
      titleAr: `أرسل بوابة ${t.name}`,
      titleEn: `Share portal: ${t.name}`,
      reasonAr: `وحدة ${unit?.number || '—'} — تفعيل تواصل المستأجر`,
      reasonEn: `Unit ${unit?.number || '—'} — activate tenant channel`,
      action: preferWa ? 'send_whatsapp' : 'open_portals',
      actionLabelAr: preferWa ? 'جهّز رابط واتساب' : 'افتح البوابات',
      actionLabelEn: preferWa ? 'Prepare WhatsApp link' : 'Open portals',
      requiresOwnerApproval: preferWa,
      whatsappPhone: t.phone,
      whatsappMessage:
        /jsdelivr|portal-open\.html/i.test(t.whatsAppMessage || '')
          ? buildWhatsAppWelcome(t.name, url, 'ar')
          : t.whatsAppMessage || buildWhatsAppWelcome(t.name, url, 'ar'),
      route: '/tenants',
      tenantId: t.id,
      unitId: t.unitId,
      unitNumber: unit?.number,
      createdAt: prevById.get(id)?.createdAt || now,
      updatedAt: now,
    });
  }

  // --- Data gaps: occupied unit / tenant without contract ---
  const contractedTenantIds = new Set(os.contracts.map((c) => c.tenantId));
  const missingContract = os.tenants.filter((t) => !contractedTenantIds.has(t.id));
  if (missingContract.length > 0) {
    const id = stableId('gap', 'no_contract');
    const preserved = keepStatus(id);
    if (preserved !== 'done' && preserved !== 'dismissed') {
      pushTask({
        id,
        kind: 'data_gap',
        status: preserved || 'suggested',
        priority: 2,
        score: 52,
        titleAr: `عقود ناقصة (${missingContract.length})`,
        titleEn: `Missing contracts (${missingContract.length})`,
        reasonAr: `مستأجرون بلا عقد: ${missingContract.slice(0, 4).map((t) => t.name).join('، ')}`,
        reasonEn: `Tenants without contract: ${missingContract.slice(0, 4).map((t) => t.name).join(', ')}`,
        action: 'open_contracts',
        actionLabelAr: 'أكمِل العقود',
        actionLabelEn: 'Complete contracts',
        route: '/contracts',
        createdAt: prevById.get(id)?.createdAt || now,
        updatedAt: now,
      });
    }
  }

  // --- Daily brief ---
  if (os.property) {
    const id = stableId('brief', 'today');
    const preserved = keepStatus(id);
    if (preserved !== 'dismissed') {
      pushTask({
        id,
        kind: 'daily_brief',
        status: preserved === 'done' ? 'done' : (preserved || 'suggested'),
        priority: 3,
        score: 20,
        titleAr: 'موجز يوم الموظف',
        titleEn: 'Employee daily brief',
        reasonAr: `${os.property.name} · ${os.tenants.length} مستأجر · ${truth.lateTenantCount} متأخر · ${stuck.length} صيانة · ${vacant.length} شاغر`,
        reasonEn: `${os.property.name} · ${os.tenants.length} tenants · ${truth.lateTenantCount} late · ${stuck.length} maint. · ${vacant.length} vacant`,
        action: 'mark_done',
        actionLabelAr: 'اطّلعت — أرشف',
        actionLabelEn: 'Reviewed — archive',
        route: '/database',
        createdAt: prevById.get(id)?.createdAt || now,
        updatedAt: now,
      });
    }
  }

  // --- Re-activate due follow-ups ---
  for (const old of previous?.tasks || []) {
    if (old.status === 'waiting_followup' && old.followUpAt && new Date(old.followUpAt).getTime() <= Date.now()) {
      if (!proposed.find((t) => t.id === old.id)) {
        pushTask({
          ...old,
          kind: 'follow_up',
          status: 'suggested',
          priority: 1,
          score: Math.max(old.score || 70, 88),
          titleAr: `متابعة: ${old.titleAr.replace(/^متابعة:\s*/, '')}`,
          titleEn: `Follow-up: ${old.titleEn.replace(/^Follow-up:\s*/i, '')}`,
          reasonAr: old.followUpNoteAr || old.reasonAr,
          reasonEn: old.followUpNoteEn || old.reasonEn,
          updatedAt: now,
          attemptCount: (old.attemptCount || 0) + 1,
        });
      }
    }
  }

  proposed.sort((a, b) =>
    a.priority - b.priority
    || (b.score || 0) - (a.score || 0)
    || a.titleAr.localeCompare(b.titleAr));

  const active = proposed.filter((t) =>
    t.status === 'suggested' || t.status === 'in_progress' || t.status === 'waiting_followup');
  const top = active[0];
  const thoughtAr = os.property
    ? `راجعت «${os.property.name}»: ${active.length} مهمة · متأخرات ${truth.lateTenantCount} · شواغر ${vacant.length} · صيانة ${stuck.length}.`
      + (top ? ` الأولوية الآن: ${top.titleAr}.` : ' الوضع مستقر نسبياً.')
    : 'لا بيانات عقار بعد — أضف عقاراً من الرئيسية لأبدأ المتابعة والتنفيذ.';
  const thoughtEn = os.property
    ? `Reviewed «${os.property.name}»: ${active.length} tasks · ${truth.lateTenantCount} late · ${vacant.length} vacant · ${stuck.length} maint.`
      + (top ? ` Focus now: ${top.titleEn}.` : ' Relatively stable.')
    : 'No property data yet — add a property from Home so I can monitor and execute.';

  const activity: EmployeeActivity[] = [
    {
      id: uid('act'),
      at: now,
      textAr: thoughtAr,
      textEn: thoughtEn,
    },
    ...((previous?.activity || []).slice(0, 19)),
  ];

  return {
    tasks: proposed,
    activity,
    prefs,
    mode: 'local',
    lastThoughtAt: now,
    lastThoughtAr: thoughtAr,
    lastThoughtEn: thoughtEn,
  };
}

export function snoozeTask(state: SmartEmployeeState, taskId: string, hours = 24): SmartEmployeeState {
  const due = new Date(Date.now() + hours * 3600000).toISOString();
  const now = new Date().toISOString();
  return {
    ...state,
    tasks: state.tasks.map((t) => (t.id === taskId
      ? {
          ...t,
          status: 'waiting_followup' as const,
          followUpAt: due,
          updatedAt: now,
        }
      : t)),
    activity: [
      {
        id: uid('act'),
        at: now,
        taskId,
        textAr: `أجّلت مهمة للمتابعة لاحقاً (${hours}س)`,
        textEn: `Snoozed a task for follow-up (${hours}h)`,
      },
      ...state.activity,
    ].slice(0, 20),
  };
}

function followUpHoursFor(kind: EmployeeTaskKind, escalate?: boolean): number | null {
  if (kind === 'collect_arrears') return 48;
  if (kind === 'escalate_collection') return 24;
  if (kind === 'renew_contract' || kind === 'expired_contract') return 72;
  if (kind === 'maintenance_follow') return 36;
  if (kind === 'share_portal') return null;
  if (escalate) return 24;
  return null;
}

export function completeTask(state: SmartEmployeeState, taskId: string, withFollowUp = true): SmartEmployeeState {
  const now = new Date().toISOString();
  const task = state.tasks.find((t) => t.id === taskId);
  const prefs = mergePrefs(state.prefs);
  if (task?.action === 'send_whatsapp') prefs.whatsappWins += 1;
  else if (task && task.action !== 'mark_done') prefs.routeWins += 1;

  const hours = withFollowUp && task
    ? followUpHoursFor(task.kind, task.kind === 'escalate_collection')
    : null;
  const followUpAt = hours != null
    ? new Date(Date.now() + hours * 3600000).toISOString()
    : undefined;

  return {
    ...state,
    prefs,
    tasks: state.tasks.map((t) => {
      if (t.id !== taskId) return t;
      if (followUpAt) {
        return {
          ...t,
          status: 'waiting_followup' as const,
          executedAt: now,
          followUpAt,
          attemptCount: (t.attemptCount || 0) + 1,
          updatedAt: now,
        };
      }
      return {
        ...t,
        status: 'done' as const,
        executedAt: now,
        attemptCount: (t.attemptCount || 0) + 1,
        updatedAt: now,
      };
    }),
    activity: [
      {
        id: uid('act'),
        at: now,
        taskId,
        textAr: followUpAt
          ? `نفّذت «${task?.titleAr || ''}» وسأُتابع خلال ${hours} ساعة`
          : `أتممت «${task?.titleAr || ''}»`,
        textEn: followUpAt
          ? `Executed «${task?.titleEn || ''}» — follow-up in ${hours}h`
          : `Completed «${task?.titleEn || ''}»`,
      },
      ...state.activity,
    ].slice(0, 20),
  };
}

export function dismissTask(state: SmartEmployeeState, taskId: string): SmartEmployeeState {
  const now = new Date().toISOString();
  const task = state.tasks.find((t) => t.id === taskId);
  const prefs = mergePrefs(state.prefs);
  if (task) {
    const kind = task.kind;
    const count = (prefs.dismissCountByKind[kind] || 0) + 1;
    prefs.dismissCountByKind[kind] = count;
    prefs.lastDismissedAtByKind[kind] = now;
    // Soft quiet: after 2 dismissals of same kind, hush non-critical for 3 days
    if (count >= 2 && !NEVER_QUIET.includes(kind)) {
      prefs.quietUntilByKind[kind] = new Date(Date.now() + 3 * 86400000).toISOString();
    }
  }
  return {
    ...state,
    prefs,
    tasks: state.tasks.map((t) => (t.id === taskId
      ? { ...t, status: 'dismissed' as const, updatedAt: now }
      : t)),
    activity: [
      {
        id: uid('act'),
        at: now,
        taskId,
        textAr: `تجاهلت «${task?.titleAr || ''}»${task && (prefs.dismissCountByKind[task.kind] || 0) >= 2 ? ' — سأقلّل اقتراحات هذا النوع مؤقتاً' : ''}`,
        textEn: `Dismissed «${task?.titleEn || ''}»${task && (prefs.dismissCountByKind[task.kind] || 0) >= 2 ? ' — will quiet this kind briefly' : ''}`,
      },
      ...state.activity,
    ].slice(0, 20),
  };
}
