/**
 * Sync Ejar (منصة إيجار) events into local notifications + Kowil approvals.
 * Additive — does not change Property OS types or visual identity.
 */
import { apiUrl } from '@/src/constants/backend';
import { getLang } from '@/src/i18n';
import { pushLocalNotification } from '@/src/utils/local-notifications';
import { onEjarNoticeReceived } from '@/src/utils/operational-flow-engine';
import { loadPortalAccess } from '@/src/utils/portal-access-store';
import { storage } from '@/src/utils/storage';
import type { EmployeeTask } from '@/src/types/smart-employee';

const SEEN_KEY = 'spp.ejarSeenEvents';

export type EjarEvent = {
  id: string;
  event_type?: string;
  contract_number?: string;
  unit?: string;
  tenant_name?: string;
  tenant_phone?: string;
  days_left?: number | null;
  message_ar?: string;
  message_en?: string;
  owner_approval?: string;
  end_date?: string;
};

export type EjarKowilTask = {
  id: string;
  kind: string;
  source?: string;
  ejar_event_id?: string;
  priority?: number;
  titleAr: string;
  titleEn: string;
  reasonAr: string;
  reasonEn: string;
  action: string;
  actionLabelAr: string;
  actionLabelEn: string;
  unitNumber?: string;
  whatsappPhone?: string;
  whatsappMessage?: string;
  route?: string;
  requiresOwnerApproval?: boolean;
};

type EjarEventsResponse = {
  configured: boolean;
  events: EjarEvent[];
  tasks: EjarKowilTask[];
  decisions: unknown[];
};

async function loadSeen(): Promise<Set<string>> {
  const raw = await storage.getItem<string>(SEEN_KEY, '');
  if (!raw) return new Set();
  try {
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

async function saveSeen(ids: Set<string>) {
  await storage.setItem(SEEN_KEY, JSON.stringify([...ids].slice(-80)));
}

export async function fetchEjarEvents(): Promise<EjarEventsResponse | null> {
  try {
    const res = await fetch(apiUrl('/ejar/events'), {
      headers: { Accept: 'application/json', 'Accept-Language': getLang() },
    });
    if (!res.ok) return null;
    return (await res.json()) as EjarEventsResponse;
  } catch {
    return null;
  }
}

export async function approveEjarEvent(eventId: string): Promise<{
  ok: boolean;
  approval?: {
    prepared_messages?: Record<string, string>;
    delivery_status?: string;
    kowil_note_ar?: string;
    kowil_note_en?: string;
  };
} | null> {
  try {
    const res = await fetch(apiUrl('/ejar/approve'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Accept-Language': getLang(),
      },
      body: JSON.stringify({ event_id: eventId }),
    });
    if (!res.ok) return null;
    return (await res.json()) as {
      ok: boolean;
      approval?: {
        prepared_messages?: Record<string, string>;
        delivery_status?: string;
        kowil_note_ar?: string;
        kowil_note_en?: string;
      };
    };
  } catch {
    return null;
  }
}

/**
 * Pull new Ejar events → local notifs (owner + contracts agents) + Kowil pending approval.
 */
export async function syncEjarNotices(ar: boolean): Promise<{
  newCount: number;
  tasks: EmployeeTask[];
}> {
  const data = await fetchEjarEvents();
  if (!data?.events?.length) return { newCount: 0, tasks: [] };

  const seen = await loadSeen();
  let newCount = 0;
  const portal = await loadPortalAccess();
  const contractAgents = portal.agents.filter(
    (a) => a.linkActive && a.permissions?.contracts,
  );

  for (const ev of data.events) {
    if (!ev?.id || seen.has(ev.id)) continue;
    if (ev.owner_approval === 'approved') {
      seen.add(ev.id);
      continue;
    }
    seen.add(ev.id);
    newCount += 1;

    const title = ar
      ? (ev.message_ar ? 'إيجار · قرب انتهاء العقد' : 'إيجار · إشعار')
      : 'Ejar · contract notice';
    const body = (ar ? ev.message_ar : ev.message_en) || ev.message_ar || ev.message_en || '';

    await pushLocalNotification({
      id: `loc_ejar_${ev.id}_owner`,
      title,
      body,
      priority: typeof ev.days_left === 'number' && ev.days_left <= 7 ? 'critical' : 'high',
      route: '/contracts',
    });

    for (const agent of contractAgents) {
      await pushLocalNotification({
        id: `loc_ejar_${ev.id}_agent_${agent.id}`,
        title: ar ? `${title} · صلاحية العقود` : `${title} · contracts access`,
        body: ar
          ? `${body} — موجه لوكيل العقود «${agent.name}».`
          : `${body} — for contracts agent «${agent.name}».`,
        priority: 'high',
        route: '/contracts',
      });
    }

    await onEjarNoticeReceived({
      eventId: ev.id,
      contractNumber: ev.contract_number || '—',
      unit: ev.unit,
      tenantName: ev.tenant_name,
      tenantPhone: ev.tenant_phone,
      daysLeft: ev.days_left,
      eventType: ev.event_type,
      preparedTenantMessage: (ar ? ev.message_ar : ev.message_en) || undefined,
    });
  }

  await saveSeen(seen);

  const now = new Date().toISOString();
  const tasks: EmployeeTask[] = (data.tasks || []).map((t) => ({
    id: t.id,
    kind: 'renew_contract',
    status: 'suggested',
    priority: (t.priority === 1 ? 1 : t.priority === 3 ? 3 : 2) as 1 | 2 | 3,
    titleAr: t.titleAr,
    titleEn: t.titleEn,
    reasonAr: t.reasonAr,
    reasonEn: t.reasonEn,
    action: 'mark_done',
    actionLabelAr: t.actionLabelAr,
    actionLabelEn: t.actionLabelEn,
    unitNumber: t.unitNumber,
    whatsappPhone: t.whatsappPhone,
    whatsappMessage: t.whatsappMessage,
    route: t.route || '/contracts',
    createdAt: now,
    updatedAt: now,
    source: 'enriched',
    platformSource: 'ejar',
    platformEventId: t.ejar_event_id || t.id.replace('ejar_task_', ''),
    requiresOwnerApproval: true,
    routeTo: 'tenant',
  }));

  return { newCount, tasks };
}
