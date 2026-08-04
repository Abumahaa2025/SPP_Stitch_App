/**
 * Sync electricity/water utility events into local notifications + Kowil payment approvals.
 */
import { apiUrl } from '@/src/constants/backend';
import { getLang } from '@/src/i18n';
import { pushLocalNotification } from '@/src/utils/local-notifications';
import { onUtilityNoticeReceived } from '@/src/utils/operational-flow-engine';
import { storage } from '@/src/utils/storage';
import type { EmployeeTask } from '@/src/types/smart-employee';

const SEEN_KEY = 'spp.utilitySeenEvents';

export type UtilityEvent = {
  id: string;
  utility?: 'electricity' | 'water';
  event_type?: string;
  bill_number?: string;
  account_number?: string;
  unit?: string;
  amount?: number | null;
  currency?: string;
  due_date?: string;
  message_ar?: string;
  message_en?: string;
  payment_url?: string;
  is_bill?: boolean;
  owner_approval?: string;
};

type UtilityEventsResponse = {
  electricity_configured: boolean;
  water_configured: boolean;
  events: UtilityEvent[];
  tasks: Array<{
    id: string;
    kind: string;
    source?: string;
    utility?: string;
    priority?: number;
    titleAr: string;
    titleEn: string;
    reasonAr: string;
    reasonEn: string;
    action: string;
    actionLabelAr: string;
    actionLabelEn: string;
    unitNumber?: string;
    amount?: number;
    route?: string;
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

export async function fetchUtilityEvents(): Promise<UtilityEventsResponse | null> {
  try {
    const res = await fetch(apiUrl('/utilities/events'), {
      headers: { Accept: 'application/json', 'Accept-Language': getLang() },
    });
    if (!res.ok) return null;
    return (await res.json()) as UtilityEventsResponse;
  } catch {
    return null;
  }
}

export async function approveUtilityPayment(eventId: string): Promise<{
  ok: boolean;
  approval?: {
    prepared_messages?: Record<string, string>;
    payment_url?: string;
    payment_status?: string;
    kowil_note_ar?: string;
    kowil_note_en?: string;
    amount?: number;
    currency?: string;
  };
} | null> {
  try {
    const res = await fetch(apiUrl('/utilities/approve-payment'), {
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
        payment_url?: string;
        payment_status?: string;
        kowil_note_ar?: string;
        kowil_note_en?: string;
        amount?: number;
        currency?: string;
      };
    };
  } catch {
    return null;
  }
}

export async function syncUtilityNotices(ar: boolean): Promise<{
  newCount: number;
  tasks: EmployeeTask[];
}> {
  const data = await fetchUtilityEvents();
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

    const util = ev.utility === 'water' ? 'water' : 'electricity';
    const title = ar
      ? (util === 'water' ? 'المياه · فاتورة/إشعار' : 'الكهرباء · فاتورة/إشعار')
      : (util === 'water' ? 'Water · bill/notice' : 'Electricity · bill/notice');
    const body = (ar ? ev.message_ar : ev.message_en) || ev.message_ar || ev.message_en || '';

    await pushLocalNotification({
      id: `loc_util_${ev.id}_owner`,
      title,
      body,
      priority: ev.event_type === 'bill_overdue' ? 'critical' : 'high',
      route: '/wallet',
    });

    await onUtilityNoticeReceived({
      eventId: ev.id,
      utility: util,
      billNumber: ev.bill_number,
      amount: ev.amount,
      currency: ev.currency,
      unit: ev.unit,
      isBill: ev.is_bill !== false,
      paymentUrl: ev.payment_url,
    });
  }

  await saveSeen(seen);

  const now = new Date().toISOString();
  const tasks: EmployeeTask[] = (data.tasks || []).map((t) => ({
    id: t.id,
    kind: 'collect_arrears',
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
    amount: t.amount,
    route: t.route || '/wallet',
    createdAt: now,
    updatedAt: now,
    source: 'enriched',
    platformSource: (t.utility === 'water' ? 'water' : 'electricity') as 'water' | 'electricity',
    platformEventId: (t as { utility_event_id?: string }).utility_event_id || t.id.replace('util_task_', ''),
    requiresOwnerApproval: true,
    routeTo: 'owner',
  }));

  return { newCount, tasks };
}
