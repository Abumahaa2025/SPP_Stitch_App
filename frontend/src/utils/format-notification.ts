import type { NotifT } from '@/src/api/client';
import { getLang } from '@/src/i18n';
import { pickNotificationText } from '@/src/utils/pick-notification-text';

export type FormattedNotification = {
  headline: string;
  recommendation: string;
  actionLabelKey: string;
  actionRoute: string;
  kind: 'contract' | 'rent' | 'maintenance' | 'sensor' | 'general';
};

type TFn = (k: string) => string;

function inferKind(n: NotifT): FormattedNotification['kind'] {
  const hay = `${n.title} ${n.body}`.toLowerCase();
  if (/contract|عقد|renew|تجديد/.test(hay)) return 'contract';
  if (/rent|إيجار|collect|تحصيل|overdue|متأخر/.test(hay)) return 'rent';
  if (/maint|repair|صيان|fix|إصلاح/.test(hay)) return 'maintenance';
  if (/sensor|مستشعر|signal|إشارة/.test(hay)) return 'sensor';
  return 'general';
}

/** Professional notification copy — context over generic labels. */
export function formatNotification(n: NotifT, t: TFn): FormattedNotification {
  const kind = inferKind(n);
  const lang = getLang();
  const picked = pickNotificationText(n, lang);
  const actionRoutes: Record<FormattedNotification['kind'], string> = {
    contract: '/contracts',
    rent: '/billing',
    maintenance: '/maintenance',
    sensor: '/sensors',
    general: '/notifications',
  };
  const actionKeys: Record<FormattedNotification['kind'], string> = {
    contract: 'notif.action.reviewContract',
    rent: 'notif.action.reviewRent',
    maintenance: 'notif.action.reviewMaintenance',
    sensor: 'notif.action.reviewSensor',
    general: 'notif.action.review',
  };

  return {
    headline: picked.title || t('notif.defaultHeadline'),
    recommendation: picked.body || t('notif.defaultRecommendation'),
    actionLabelKey: n.route ? 'notif.action.review' : actionKeys[kind],
    actionRoute: n.route || actionRoutes[kind],
    kind,
  };
}
