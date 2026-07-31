import type { NotifT } from '@/src/api/client';

/** Spec §5.17 — user-facing notification buckets (engine names stay internal). */
export type NotifCategory =
  | 'urgent'
  | 'financial'
  | 'contracts'
  | 'maintenance'
  | 'integrations'
  | 'info';

export const NOTIF_CATEGORIES: NotifCategory[] = [
  'urgent',
  'financial',
  'contracts',
  'maintenance',
  'integrations',
  'info',
];

export function categorizeNotification(n: NotifT): NotifCategory {
  const priority = (n.priority || '').toLowerCase();
  if (priority === 'critical' || priority === 'high') return 'urgent';

  const hay = `${n.title} ${n.body}`.toLowerCase();
  if (/contract|عقد|renew|تجديد|إخلاء|انتهاء/.test(hay)) return 'contracts';
  if (/rent|إيجار|collect|تحصيل|overdue|متأخر|دفع|payment|فاتور/.test(hay)) return 'financial';
  if (/maint|repair|صيان|fix|إصلاح|بلاغ/.test(hay)) return 'maintenance';
  if (/sensor|مستشعر|whatsapp|واتساب|sheet|تكامل|integration|green.?api|webhook|email|بريد/.test(hay)) {
    return 'integrations';
  }
  return 'info';
}
