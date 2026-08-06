/**
 * Local in-app notifications (persist) — shown in Notification Center with API feed.
 */
import type { NotifT } from '@/src/api/client';
import { getLang } from '@/src/i18n';
import { storage } from '@/src/utils/storage';

const KEY = 'spp.localNotifications';

export type LocalNotif = NotifT;

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
  titleAr?: string;
  titleEn?: string;
  bodyAr?: string;
  bodyEn?: string;
}): Promise<LocalNotif> {
  const list = await load();
  const id = input.id || `loc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const next = list.filter((n) => n.id !== id);
  const titleAr = input.titleAr ?? input.title;
  const titleEn = input.titleEn ?? input.title;
  const bodyAr = input.bodyAr ?? input.body;
  const bodyEn = input.bodyEn ?? input.body;
  const lang = getLang();
  const item: LocalNotif = {
    id,
    title: lang === 'ar' ? titleAr : titleEn,
    body: lang === 'ar' ? bodyAr : bodyEn,
    titleAr,
    titleEn,
    bodyAr,
    bodyEn,
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
export async function notifyPropertySaved(propertyName: string) {
  const name = propertyName.trim() || 'Property';
  const nameAr = propertyName.trim() || 'العقار';
  return pushLocalNotification({
    id: 'loc_property_saved',
    title: 'Property saved',
    body: `«${name}» was saved. Tap to open the database center.`,
    titleAr: 'تم حفظ العقار',
    titleEn: 'Property saved',
    bodyAr: `تم حفظ «${nameAr}» بنجاح. اضغط لفتح مركز البيانات.`,
    bodyEn: `«${name}» was saved. Tap to open the database center.`,
    priority: 'high',
    route: '/database',
  });
}

export async function notifyTenantSaved(name: string, kind: 'edit' | 'add' | 'note' = 'edit') {
  const titleEn = kind === 'add'
    ? 'Added successfully'
    : kind === 'note'
      ? 'Note saved'
      : 'Updated successfully';
  const titleAr = kind === 'add'
    ? 'تمت الإضافة بنجاح'
    : kind === 'note'
      ? 'تم حفظ الملاحظة'
      : 'تم التعديل بنجاح';
  const bodyAr = `تم حفظ بيانات «${name}» في مركز البيانات.`;
  const bodyEn = `«${name}» was saved to the database center.`;
  return pushLocalNotification({
    id: `loc_tenant_${kind}_${Date.now().toString(36)}`,
    title: titleEn,
    body: bodyEn,
    titleAr,
    titleEn,
    bodyAr,
    bodyEn,
    priority: 'normal',
    route: '/database',
  });
}
