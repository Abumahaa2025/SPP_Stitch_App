/**
 * Smart Property Employee agent — thinks over Property OS + ops, proposes executable work.
 * Runs on-device (no cloud LLM required). Cloud LLM can enrich later.
 */
import type { PropertyOSState } from '@/src/types/property-os';
import type { MaintenanceTicket } from '@/src/types/operational';
import type {
  EmployeeActivity,
  EmployeeTask,
  SmartEmployeeState,
} from '@/src/types/smart-employee';
import { arrearsFromPropertyOS, isArrearsLedgerEntry } from '@/src/utils/ops-truth';
import { buildWhatsAppCollectionMessage } from '@/src/utils/canonical-tenant-store';
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

type ThinkInput = {
  os: PropertyOSState;
  openTickets?: MaintenanceTicket[];
  previous?: SmartEmployeeState | null;
};

/** Analyze portfolio and produce today's work queue + thought line. */
export function thinkSmartEmployee(input: ThinkInput): SmartEmployeeState {
  const { os, openTickets = [], previous } = input;
  const now = new Date().toISOString();
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

  // --- Arrears collection ---
  const truth = arrearsFromPropertyOS(os);
  const ledger = (os.paymentLedger || []).filter(isArrearsLedgerEntry);
  const byTenant = new Map<string, { name: string; phone: string; unit: string; unitId: string; total: number; osTenantId: string }>();
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
    byTenant.set(row.tenantId, prev);
  }
  const late = [...byTenant.values()].filter((x) => x.total > 0.009).sort((a, b) => b.total - a.total);

  for (const row of late.slice(0, 5)) {
    const id = stableId('collect', row.osTenantId);
    const preserved = keepStatus(id);
    if (preserved === 'done' || preserved === 'dismissed') continue;
    const ct = {
      id: row.osTenantId,
      name: row.name,
      phone: row.phone,
      unitNumber: row.unit,
      rentAmount: Number(os.units.find((u) => u.id === row.unitId)?.rentAmount || 0),
    } as CanonicalTenant;
    const msg = buildWhatsAppCollectionMessage(ct, true, row.total);
    proposed.push({
      id,
      kind: 'collect_arrears',
      status: preserved || 'suggested',
      priority: row.total > 5000 ? 1 : 2,
      titleAr: `تحصيل من ${row.name}`,
      titleEn: `Collect from ${row.name}`,
      reasonAr: `متأخرات وحدة ${row.unit}: ${row.total.toLocaleString('ar-SA')} ر.س`,
      reasonEn: `Unit ${row.unit} arrears: ${row.total.toLocaleString()} SAR`,
      action: row.phone ? 'send_whatsapp' : 'open_database',
      actionLabelAr: row.phone ? 'أرسل تذكير واتساب' : 'افتح مركز البيانات',
      actionLabelEn: row.phone ? 'Send WhatsApp reminder' : 'Open database',
      whatsappPhone: row.phone,
      whatsappMessage: msg,
      route: '/database',
      tenantId: row.osTenantId,
      unitId: row.unitId,
      unitNumber: row.unit,
      amount: row.total,
      createdAt: prevById.get(id)?.createdAt || now,
      updatedAt: now,
      followUpAt: preserved === 'waiting_followup' ? prevById.get(id)?.followUpAt : undefined,
      followUpNoteAr: 'تابع هل تم السداد خلال 48 ساعة',
      followUpNoteEn: 'Follow up if paid within 48h',
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
    proposed.push({
      id,
      kind: 'renew_contract',
      status: preserved || 'suggested',
      priority: d <= 14 ? 1 : 2,
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

  // --- Vacant units ---
  const vacant = os.units.filter((u) => u.status === 'vacant');
  if (vacant.length > 0) {
    const id = stableId('vacancy', os.property?.id || 'prop');
    const preserved = keepStatus(id);
    if (preserved !== 'done' && preserved !== 'dismissed') {
      proposed.push({
        id,
        kind: 'fill_vacancy',
        status: preserved || 'suggested',
        priority: 2,
        titleAr: `شواغر تحتاج مستأجر (${vacant.length})`,
        titleEn: `Vacancies need tenants (${vacant.length})`,
        reasonAr: `وحدات: ${vacant.slice(0, 6).map((u) => u.number).join('، ')}`,
        reasonEn: `Units: ${vacant.slice(0, 6).map((u) => u.number).join(', ')}`,
        action: 'open_database',
        actionLabelAr: 'أضف مستأجراً من مركز البيانات',
        actionLabelEn: 'Add tenant in database',
        route: '/database',
        createdAt: prevById.get(id)?.createdAt || now,
        updatedAt: now,
      });
    }
  }

  // --- Open maintenance without progress ---
  const stuck = openTickets.filter((tk) =>
    ['open', 'assigned', 'awaiting_tenant'].includes(tk.status));
  for (const tk of stuck.slice(0, 4)) {
    const id = stableId('maint', tk.id);
    const preserved = keepStatus(id);
    if (preserved === 'done' || preserved === 'dismissed') continue;
    const unit = os.units.find((u) => u.id === tk.unitId);
    proposed.push({
      id,
      kind: 'maintenance_follow',
      status: preserved || 'suggested',
      priority: tk.status === 'open' ? 1 : 2,
      titleAr: `متابعة صيانة: ${tk.title}`,
      titleEn: `Follow maintenance: ${tk.title}`,
      reasonAr: `حالة ${tk.status} · وحدة ${unit?.number || '—'}`,
      reasonEn: `Status ${tk.status} · unit ${unit?.number || '—'}`,
      action: 'open_maintenance',
      actionLabelAr: 'افتح الصيانة ونفّذ',
      actionLabelEn: 'Open maintenance',
      route: '/maintenance',
      unitId: tk.unitId,
      unitNumber: unit?.number,
      createdAt: prevById.get(id)?.createdAt || now,
      updatedAt: now,
    });
  }

  // --- Tenants missing phone / portal readiness ---
  const noPhone = os.tenants.filter((t) => !String(t.phone || '').replace(/\D/g, ''));
  if (noPhone.length > 0) {
    const id = stableId('portal', 'missing_phone');
    const preserved = keepStatus(id);
    if (preserved !== 'done' && preserved !== 'dismissed') {
      proposed.push({
        id,
        kind: 'send_portal_link',
        status: preserved || 'suggested',
        priority: 3,
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

  // --- Daily brief always present when property exists ---
  if (os.property) {
    const id = stableId('brief', 'today');
    const preserved = keepStatus(id);
    if (preserved !== 'dismissed') {
      proposed.push({
        id,
        kind: 'daily_brief',
        status: preserved === 'done' ? 'done' : (preserved || 'suggested'),
        priority: 3,
        titleAr: 'موجز يوم الموظف',
        titleEn: 'Employee daily brief',
        reasonAr: `${os.property.name} · ${os.tenants.length} مستأجر · ${truth.lateTenantCount} متأخر · ${stuck.length} صيانة`,
        reasonEn: `${os.property.name} · ${os.tenants.length} tenants · ${truth.lateTenantCount} late · ${stuck.length} maint.`,
        action: 'mark_done',
        actionLabelAr: 'اطّلعت — أرشف',
        actionLabelEn: 'Reviewed — archive',
        route: '/database',
        createdAt: prevById.get(id)?.createdAt || now,
        updatedAt: now,
      });
    }
  }

  // Re-activate due follow-ups
  for (const old of previous?.tasks || []) {
    if (old.status === 'waiting_followup' && old.followUpAt && new Date(old.followUpAt).getTime() <= Date.now()) {
      if (!proposed.find((t) => t.id === old.id)) {
        proposed.push({
          ...old,
          kind: 'follow_up',
          status: 'suggested',
          priority: 1,
          titleAr: `متابعة: ${old.titleAr}`,
          titleEn: `Follow-up: ${old.titleEn}`,
          reasonAr: old.followUpNoteAr || old.reasonAr,
          reasonEn: old.followUpNoteEn || old.reasonEn,
          updatedAt: now,
        });
      }
    }
  }

  proposed.sort((a, b) => a.priority - b.priority || a.titleAr.localeCompare(b.titleAr));

  const active = proposed.filter((t) => t.status === 'suggested' || t.status === 'in_progress' || t.status === 'waiting_followup');
  const thoughtAr = os.property
    ? `راجعت «${os.property.name}»: ${active.length} مهمة اليوم · متأخرات ${truth.lateTenantCount} · شواغر ${vacant.length} · صيانة ${stuck.length}.`
    : 'لا بيانات عقار بعد — أضف عقاراً من الرئيسية لأبدأ المتابعة والتنفيذ.';
  const thoughtEn = os.property
    ? `Reviewed «${os.property.name}»: ${active.length} tasks today · ${truth.lateTenantCount} late · ${vacant.length} vacant · ${stuck.length} maint.`
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

export function completeTask(state: SmartEmployeeState, taskId: string, withFollowUp = true): SmartEmployeeState {
  const now = new Date().toISOString();
  const task = state.tasks.find((t) => t.id === taskId);
  const followUpAt = withFollowUp && task?.kind === 'collect_arrears'
    ? new Date(Date.now() + 48 * 3600000).toISOString()
    : undefined;
  return {
    ...state,
    tasks: state.tasks.map((t) => {
      if (t.id !== taskId) return t;
      if (followUpAt) {
        return {
          ...t,
          status: 'waiting_followup' as const,
          executedAt: now,
          followUpAt,
          updatedAt: now,
        };
      }
      return { ...t, status: 'done' as const, executedAt: now, updatedAt: now };
    }),
    activity: [
      {
        id: uid('act'),
        at: now,
        taskId,
        textAr: followUpAt
          ? `نفّذت «${task?.titleAr || ''}» وسأُتابع خلال 48 ساعة`
          : `أتممت «${task?.titleAr || ''}»`,
        textEn: followUpAt
          ? `Executed «${task?.titleEn || ''}» — follow-up in 48h`
          : `Completed «${task?.titleEn || ''}»`,
      },
      ...state.activity,
    ].slice(0, 20),
  };
}

export function dismissTask(state: SmartEmployeeState, taskId: string): SmartEmployeeState {
  const now = new Date().toISOString();
  const task = state.tasks.find((t) => t.id === taskId);
  return {
    ...state,
    tasks: state.tasks.map((t) => (t.id === taskId
      ? { ...t, status: 'dismissed' as const, updatedAt: now }
      : t)),
    activity: [
      {
        id: uid('act'),
        at: now,
        taskId,
        textAr: `تجاهلت «${task?.titleAr || ''}»`,
        textEn: `Dismissed «${task?.titleEn || ''}»`,
      },
      ...state.activity,
    ].slice(0, 20),
  };
}
