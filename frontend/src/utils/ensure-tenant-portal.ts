/**
 * Ensure PropertyOS tenant has a working portal link (spp:// + in-app route).
 */
import type { PropertyOSState, TenantRecord } from '@/src/types/property-os';
import { storage } from '@/src/utils/storage';
import { buildTenantPortalLink } from '@/src/utils/portal-links';

const OS_KEY = 'spp.propertyOS';

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function welcomeMessage(name: string, portalUrl: string, lang: 'ar' | 'en') {
  if (lang === 'ar') {
    return `مرحبًا ${name} 👋\n\nتم تفعيل بوابة المستأجر في SPP.\n\nرابطك الخاص:\n${portalUrl}\n\nيمكنك من خلالها:\n• عرض عقدك\n• طلب صيانة\n• متابعة البلاغات\n• استلام التنبيهات`;
  }
  return `Welcome ${name} 👋\n\nYour SPP tenant portal is ready.\n\nYour link:\n${portalUrl}\n\nYou can:\n• View your contract\n• Request maintenance\n• Track tickets\n• Receive alerts`;
}

export async function ensureTenantPortalLink(
  osTenantId: string,
  lang: 'ar' | 'en',
): Promise<{ tenant: TenantRecord; shareUrl: string; inApp: string; message: string } | null> {
  const raw = await storage.getItem<string>(OS_KEY, '');
  if (!raw) return null;
  let os: PropertyOSState;
  try {
    os = JSON.parse(raw) as PropertyOSState;
  } catch {
    return null;
  }
  const tenant = os.tenants.find((t) => t.id === osTenantId);
  if (!tenant) return null;

  const token = tenant.portalToken || uid('tok').slice(-12);
  const built = buildTenantPortalLink(tenant.id, token);
  const message = welcomeMessage(tenant.name, built.url, lang);
  const updated: TenantRecord = {
    ...tenant,
    portalToken: token,
    portalUrl: built.url,
    qrData: built.qrData,
    whatsAppMessage: message,
  };

  const next: PropertyOSState = {
    ...os,
    tenants: os.tenants.map((t) => (t.id === updated.id ? updated : t)),
  };
  await storage.setItem(OS_KEY, JSON.stringify(next));
  return { tenant: updated, shareUrl: built.url, inApp: built.inApp, message };
}
