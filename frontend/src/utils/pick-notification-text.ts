import type { NotifT } from '@/src/api/client';
import type { Lang } from '@/src/i18n';

const ARABIC_RE = /[\u0600-\u06FF]/;

export function textLooksArabic(text: string): boolean {
  return ARABIC_RE.test(text);
}

/** Pick headline/body for the active app language (bilingual fields when present). */
export function pickNotificationText(n: NotifT, lang: Lang): { title: string; body: string } {
  const ar = lang === 'ar';
  let title = ar
    ? (n.titleAr?.trim() || n.title?.trim() || '')
    : (n.titleEn?.trim() || n.title?.trim() || '');
  let body = ar
    ? (n.bodyAr?.trim() || n.body?.trim() || '')
    : (n.bodyEn?.trim() || n.body?.trim() || '');

  if (!ar && !n.titleEn && textLooksArabic(title)) {
    title = '';
  }
  if (!ar && !n.bodyEn && textLooksArabic(body)) {
    body = '';
  }
  return { title, body };
}
