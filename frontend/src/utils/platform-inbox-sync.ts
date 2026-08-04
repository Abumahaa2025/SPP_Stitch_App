/**
 * Sync messaging / intelligence platform inbox into Kowil tasks.
 */
import { apiUrl } from '@/src/constants/backend';
import { getLang } from '@/src/i18n';
import { pushLocalNotification } from '@/src/utils/local-notifications';
import { onPlatformMessageReceived } from '@/src/utils/operational-flow-engine';
import { storage } from '@/src/utils/storage';
import type { EmployeeTask } from '@/src/types/smart-employee';

const SEEN_KEY = 'spp.platformSeenEvents';

type PlatformEvent = {
  id: string;
  channel?: string;
  route_to?: string;
  message_ar?: string;
  message_en?: string;
  analysis_ar?: string;
  analysis_en?: string;
  owner_approval?: string;
  unit?: string;
  tenant_phone?: string;
};

type PlatformResponse = {
  events: PlatformEvent[];
  tasks: Array<{
    id: string;
    platform_event_id?: string;
    source?: string;
    route_to?: string;
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
    requiresOwnerApproval?: boolean;
  }>;
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
  await storage.setItem(SEEN_KEY, JSON.stringify([...ids].slice(-100)));
}

export async function fetchPlatformInboxEvents(): Promise<PlatformResponse | null> {
  try {
    const res = await fetch(apiUrl('/platform/inbox/events'), {
      headers: { Accept: 'application/json', 'Accept-Language': getLang() },
    });
    if (!res.ok) return null;
    return (await res.json()) as PlatformResponse;
  } catch {
    return null;
  }
}

export async function approvePlatformInboxEvent(eventId: string): Promise<{
  ok: boolean;
  approval?: {
    prepared_messages?: Record<string, string>;
    kowil_note_ar?: string;
    kowil_note_en?: string;
  };
} | null> {
  try {
    const res = await fetch(apiUrl('/platform/inbox/approve'), {
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
        kowil_note_ar?: string;
        kowil_note_en?: string;
      };
    };
  } catch {
    return null;
  }
}

export async function syncPlatformInbox(ar: boolean): Promise<{
  newCount: number;
  tasks: EmployeeTask[];
}> {
  const data = await fetchPlatformInboxEvents();
  if (!data?.events?.length) return { newCount: 0, tasks: [] };

  const seen = await loadSeen();
  let newCount = 0;

  for (const ev of data.events) {
    if (!ev?.id || seen.has(ev.id)) continue;
    if (ev.owner_approval === 'approved') {
      seen.add(ev.id);
      continue;
    }
    seen.add(ev.id);
    newCount += 1;

    const channel = ev.channel || 'platform';
    const title = ar
      ? (channel === 'messaging' ? 'منصة رسائل · وارد' : 'منصة ذكاء · وارد')
      : (channel === 'messaging' ? 'Messaging platform · inbound' : 'Intelligence platform · inbound');
    const body = (ar ? ev.analysis_ar : ev.analysis_en) || ev.message_ar || ev.message_en || '';

    await pushLocalNotification({
      id: `loc_plat_${ev.id}_owner`,
      title,
      body,
      priority: 'high',
      route: '/brain',
    });

    await onPlatformMessageReceived({
      eventId: ev.id,
      channel,
      routeTo: ev.route_to || 'tenant',
      messageAr: ev.message_ar,
      messageEn: ev.message_en,
    });
  }

  await saveSeen(seen);

  const now = new Date().toISOString();
  const tasks: EmployeeTask[] = (data.tasks || []).map((t) => ({
    id: t.id,
    kind: 'follow_up',
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
    route: '/brain',
    createdAt: now,
    updatedAt: now,
    source: 'enriched',
    platformSource: (t.source === 'intelligence' ? 'intelligence' : 'messaging') as EmployeeTask['platformSource'],
    platformEventId: t.platform_event_id || t.id.replace('platform_task_', ''),
    requiresOwnerApproval: t.requiresOwnerApproval ?? true,
    routeTo: t.route_to as EmployeeTask['routeTo'],
  }));

  return { newCount, tasks };
}
