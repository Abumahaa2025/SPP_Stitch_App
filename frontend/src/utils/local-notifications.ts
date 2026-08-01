/**
 * Local in-app notifications (persist) — shown in Notification Center with API feed.
 */
import type { NotifT } from '@/src/api/client';
import { storage } from '@/src/utils/storage';

const KEY = 'spp.localNotifications';

export type LocalNotif = NotifT & {
  /** Optional deep link when user acts on the card */
  route?: string;
};

async function load(): Promise<LocalNotif[]> {
  const raw = await storage.getItem<string>(KEY, '');
  if (!raw) return [];
  try {
    const list = JSON.parse(raw) as LocalNotif[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

async function save(list: LocalNotif[]) {
  await storage.setItem(KEY, JSON.stringify(list.slice(0, 80)));
}

export async function loadLocalNotifications(): Promise<LocalNotif[]> {
  return load();
}

export async function pushLocalNotification(input: {
  id?: string;
  title: string;
  body: string;
  priority?: string;
  route?: string;
}): Promise<LocalNotif> {
  const list = await load();
  const id = input.id || `loc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  // Dedupe by id
  const next = list.filter((n) => n.id !== id);
  const item: LocalNotif = {
    id,
    title: input.title,
    body: input.body,
    priority: input.priority || 'high',
    at: new Date().toISOString(),
    read: false,
    route: input.route,
  };
  next.unshift(item);
  await save(next);
  return item;
}

/** Stable id so re-opening ops refreshes the same «property saved» card. */
export async function notifyPropertySaved(propertyName: string, ar: boolean) {
  const name = propertyName.trim() || (ar ? 'العقار' : 'Property');
  return pushLocalNotification({
    id: 'loc_property_saved',
    title: ar ? 'تم حفظ العقار' : 'Property saved',
    body: ar
      ? `تم حفظ «${name}» بنجاح. اضغط لفتح مركز البيانات.`
      : `«${name}» was saved. Tap to open the database center.`,
    priority: 'high',
    route: '/database',
  });
}

export async function notifyTenantSaved(name: string, ar: boolean, kind: 'edit' | 'add' | 'note' = 'edit') {
  const title = kind === 'add'
    ? (ar ? 'تمت الإضافة بنجاح' : 'Added successfully')
    : kind === 'note'
      ? (ar ? 'تم حفظ الملاحظة' : 'Note saved')
      : (ar ? 'تم التعديل بنجاح' : 'Updated successfully');
  const body = ar
    ? `تم حفظ بيانات «${name}» في مركز البيانات.`
    : `«${name}» was saved to the database center.`;
  return pushLocalNotification({
    id: `loc_tenant_${kind}_${Date.now().toString(36)}`,
    title,
    body,
    priority: 'normal',
    route: '/database',
  });
}
