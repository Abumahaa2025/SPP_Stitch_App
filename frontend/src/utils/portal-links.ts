/**
 * Portal deep links — HTTPS bridge (WhatsApp-clickable) + in-app routes.
 * Custom spp:// alone is often not tappable in WhatsApp/SMS.
 */
import * as ExpoLinking from 'expo-linking';

/** GitHub CDN HTML bridge — works right after push (no Render deploy wait). */
export const PORTAL_BRIDGE_URL =
  'https://cdn.jsdelivr.net/gh/Abumahaa2025/SPP_Stitch_App@main/docs/portal-open.html';

/** Same bridge on API host (when backend route is deployed). */
export const PORTAL_BRIDGE_API_URL = 'https://spp-beta-api.onrender.com/portal/open';

export type PortalRole = 'tenant' | 'tech' | 'agent' | 'guard';

export type PortalShareMeta = {
  name?: string;
  unit?: string;
  property?: string;
};

function qs(params: Record<string, string | undefined>) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && String(v).trim() !== '') sp.set(k, String(v));
  });
  return sp.toString();
}

export function inAppTenantPortal(tenantId: string, token: string, meta?: PortalShareMeta) {
  const q = qs({
    id: tenantId,
    t: token,
    n: meta?.name,
    u: meta?.unit,
    prop: meta?.property,
  });
  return `/portal/tenant?${q}`;
}

export function inAppTechPortal(token: string, techId?: string, meta?: PortalShareMeta) {
  const q = qs({
    id: techId,
    t: token,
    n: meta?.name,
  });
  return `/portal/tech?${q}`;
}

export function inAppAgentPortal(agentId: string, token: string, meta?: PortalShareMeta) {
  const q = qs({ id: agentId, t: token, n: meta?.name });
  return `/portal/agent?${q}`;
}

export function inAppGuardPortal(guardId: string, token: string, meta?: PortalShareMeta) {
  const q = qs({ id: guardId, t: token, n: meta?.name });
  return `/portal/guard?${q}`;
}

function buildHttpsBridge(role: PortalRole, id: string, token: string, meta?: PortalShareMeta) {
  const q = qs({
    role,
    id: id || undefined,
    t: token,
    n: meta?.name,
    u: meta?.unit,
    prop: meta?.property,
    v: '36',
  });
  // Prefer jsDelivr so links work immediately after git push.
  return `${PORTAL_BRIDGE_URL}?${q}`;
}

export function buildTenantPortalLink(tenantId: string, token: string, meta?: PortalShareMeta) {
  const inApp = inAppTenantPortal(tenantId, token, meta);
  const url = buildHttpsBridge('tenant', tenantId, token, meta);
  const deep = ExpoLinking.createURL('/portal/tenant', {
    queryParams: {
      id: tenantId,
      t: token,
      ...(meta?.name ? { n: meta.name } : {}),
      ...(meta?.unit ? { u: meta.unit } : {}),
      ...(meta?.property ? { prop: meta.property } : {}),
    },
  });
  return { url, qrData: url, deep, token, inApp };
}

export function buildTechPortalLink(token: string, techId?: string, meta?: PortalShareMeta) {
  const inApp = inAppTechPortal(token, techId, meta);
  const url = buildHttpsBridge('tech', techId || '', token, meta);
  const deep = ExpoLinking.createURL('/portal/tech', {
    queryParams: {
      t: token,
      ...(techId ? { id: techId } : {}),
      ...(meta?.name ? { n: meta.name } : {}),
    },
  });
  return { url, qrData: url, deep, token, inApp };
}

export function buildAgentPortalLink(agentId: string, token: string, meta?: PortalShareMeta) {
  const inApp = inAppAgentPortal(agentId, token, meta);
  const url = buildHttpsBridge('agent', agentId, token, meta);
  const deep = ExpoLinking.createURL('/portal/agent', {
    queryParams: {
      id: agentId,
      t: token,
      ...(meta?.name ? { n: meta.name } : {}),
    },
  });
  return { url, qrData: url, deep, token, inApp };
}

export function buildGuardPortalLink(guardId: string, token: string, meta?: PortalShareMeta) {
  const inApp = inAppGuardPortal(guardId, token, meta);
  const url = buildHttpsBridge('guard', guardId, token, meta);
  const deep = ExpoLinking.createURL('/portal/guard', {
    queryParams: {
      id: guardId,
      t: token,
      ...(meta?.name ? { n: meta.name } : {}),
    },
  });
  return { url, qrData: url, deep, token, inApp };
}

/** Map any shared / deep URL to an in-app portal route. */
export function resolvePortalInAppFromUrl(url: string): string | null {
  const raw = String(url || '').trim();
  if (!raw) return null;
  if (
    raw.startsWith('/portal/tenant')
    || raw.startsWith('/portal/tech')
    || raw.startsWith('/portal/agent')
    || raw.startsWith('/portal/guard')
  ) {
    return raw;
  }

  try {
    const parsed = ExpoLinking.parse(raw);
    const path = `/${(parsed.path || '').replace(/^\//, '')}`;
    const q = parsed.queryParams || {};
    const role = String(q.role || '');
    const id = String(q.id || '');
    const t = String(q.t || '');
    const n = q.n ? String(q.n) : q.name ? String(q.name) : undefined;
    const u = q.u ? String(q.u) : q.unit ? String(q.unit) : undefined;
    const prop = q.prop ? String(q.prop) : undefined;
    const meta = { name: n, unit: u, property: prop };

    if (path.includes('portal/open') || path.endsWith('portal-open.html') || path.includes('portal-open')) {
      if (role === 'tech' && t) return inAppTechPortal(t, id || undefined, meta);
      if (role === 'agent' && id && t) return inAppAgentPortal(id, t, meta);
      if (role === 'guard' && id && t) return inAppGuardPortal(id, t, meta);
      if (t && id) return inAppTenantPortal(id, t, meta);
    }

    if (path.includes('portal/tenant') || /\/tenant(\/|\?|$)/.test(raw)) {
      const pathId = raw.match(/\/tenant\/([^/?#]+)/)?.[1];
      const tenantId = id || pathId || '';
      if (tenantId && t) return inAppTenantPortal(tenantId, t, meta);
    }
    if (path.includes('portal/tech') || /\/tech(\/|\?|$)/.test(raw)) {
      if (t) return inAppTechPortal(t, id || undefined, meta);
    }
    if (path.includes('portal/agent') || /\/agent(\/|\?|$)/.test(raw)) {
      const pathId = raw.match(/\/agent\/([^/?#]+)/)?.[1];
      const agentId = id || pathId || '';
      if (agentId && t) return inAppAgentPortal(agentId, t, meta);
    }
    if (path.includes('portal/guard') || /\/guard(\/|\?|$)/.test(raw)) {
      const pathId = raw.match(/\/guard\/([^/?#]+)/)?.[1];
      const guardId = id || pathId || '';
      if (guardId && t) return inAppGuardPortal(guardId, t, meta);
    }
  } catch { /* ignore */ }

  // Query-only fallback for bridge URLs
  try {
    const u = new URL(raw);
    const role = u.searchParams.get('role') || '';
    const id = u.searchParams.get('id') || '';
    const t = u.searchParams.get('t') || '';
    const meta = {
      name: u.searchParams.get('n') || u.searchParams.get('name') || undefined,
      unit: u.searchParams.get('u') || u.searchParams.get('unit') || undefined,
      property: u.searchParams.get('prop') || undefined,
    };
    if (t && (u.pathname.includes('portal') || u.hostname.includes('jsdelivr') || u.hostname.includes('onrender'))) {
      if (role === 'tech') return inAppTechPortal(t, id || undefined, meta);
      if (role === 'agent' && id) return inAppAgentPortal(id, t, meta);
      if (role === 'guard' && id) return inAppGuardPortal(id, t, meta);
      if (id) return inAppTenantPortal(id, t, meta);
    }
  } catch { /* ignore */ }

  return null;
}
