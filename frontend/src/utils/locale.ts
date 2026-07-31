import { getLang } from '@/src/i18n';

export function localeTag(): string {
  return getLang() === 'ar' ? 'ar-AE' : 'en-US';
}

export function formatDate(value: string | Date, opts?: Intl.DateTimeFormatOptions): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toLocaleDateString(localeTag(), opts ?? { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatTime(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toLocaleTimeString(localeTag(), { hour: '2-digit', minute: '2-digit' });
}
