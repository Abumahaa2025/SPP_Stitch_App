/**
 * Ensure PropertyOS tenant has a working HTTPS portal link + guest meta.
 * Portal-only helper — attaches technician contact into the share link.
 */
import type { PropertyOSState, TenantRecord } from '@/src/types/property-os';
import { storage } from '@/src/utils/storage';
import { buildTenantPortalLink } from '@/src/utils/portal-links';
import { loadTechnicians } from '@/src/utils/technician-store';

const OS_KEY = 'spp.propertyOS';

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function welcomeMessage(name: string, portalUrl: string, lang: 'ar' | 'en', techName?: string) {
  if (lang === 'ar') {
    return `مرحبًا ${name} 👋\n\nتم تفعيل بوابة المستأجر في SPP.\n\nافتح رابطك (صفحة بوابة وليس ملف نصي):\n${portalUrl}\n\nمن خلاله يمكنك:\n• عرض وحدتك وعقارك\n• طلب صيانة ومتابعة البلاغ\n• التواصل مباشرة مع الفني${techName ? ` (${techName})` : ''}`;
  }
  return `Welcome ${name} 👋\n\nYour SPP tenant portal is ready.\n\nOpen your portal page:\n${portalUrl}\n\nYou can:\n• View your unit\n• Request & track maintenance\n• Contact the technician directly${techName ? ` (${techName})` : ''}`;
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
  const techs = await loadTechnicians().catch(() => []);
  const primaryTech = techs.find((x) => x.linkActive !== false && digits(x.phone)) || techs[0];
  const meta = {
    name: tenant.name,
    unit: unit?.number,
    property: os.property?.name,
    techName: primaryTech?.name,
    techPhone: primaryTech?.phone ? digits(primaryTech.phone) : undefined,
  };
  const built = buildTenantPortalLink(tenant.id, token, meta);
  const message = welcomeMessage(tenant.name, built.url, lang, primaryTech?.name);
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

function digits(raw?: string) {
  return String(raw || '').replace(/\D/g, '');
}
