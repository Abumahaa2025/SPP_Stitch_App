/**
 * Ensure PropertyOS tenant has a working HTTPS portal link + guest meta.
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
    return `مرحبًا ${name} 👋\n\nتم تفعيل بوابة المستأجر في SPP.\n\nافتح رابطك:\n${portalUrl}\n\nمن خلاله يمكنك:\n• عرض وحدتك\n• طلب صيانة\n• متابعة البلاغات`;
  }
  return `Welcome ${name} 👋\n\nYour SPP tenant portal is ready.\n\nOpen your link:\n${portalUrl}\n\nYou can:\n• View your unit\n• Request maintenance\n• Track tickets`;
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
  const tenant = os.tenants.find((x) => x.id === osTenantId);
  if (!tenant) return null;

  const unit = os.units.find((u) => u.id === tenant.unitId);
  const token = tenant.portalToken || uid('tok').slice(-12);
  const meta = {
    name: tenant.name,
    unit: unit?.number,
    property: os.property?.name,
  };
  const built = buildTenantPortalLink(tenant.id, token, meta);
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
    tenants: os.tenants.map((x) => (x.id === updated.id ? updated : x)),
  };
  await storage.setItem(OS_KEY, JSON.stringify(next));
  return { tenant: updated, shareUrl: built.url, inApp: built.inApp, message };
}
