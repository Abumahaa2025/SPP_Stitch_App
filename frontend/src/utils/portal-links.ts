/**
 * Portal deep links — HTTPS bridge (WhatsApp-clickable) + in-app routes.
 * Custom spp:// alone is often not tappable in WhatsApp/SMS.
 *
 * The bridge host must answer with a real `text/html` content type. Raw GitHub
 * mirrors (jsDelivr, statically, raw.githubusercontent) serve `.html` as
 * `text/plain` + `nosniff`, so the recipient sees the page source instead of the
 * portal card — that is the "links open code only" failure.
 */
import * as ExpoLinking from 'expo-linking';

/** GitHub Pages copy of docs/portal-open.html — first-party, served as text/html. */
export const PORTAL_BRIDGE_PAGES_URL =
  'https://abumahaa2025.github.io/SPP_Stitch_App/portal-open.html';

/**
 * githack mirror — text/html but may show an interstitial; last-resort only.
 */
export const PORTAL_BRIDGE_CDN_URL =
  'https://raw.githack.com/Abumahaa2025/SPP_Stitch_App/main/docs/portal-open.html';

/** Same bridge on API host (when backend route is deployed). */
export const PORTAL_BRIDGE_API_URL = 'https://spp-beta-api.onrender.com/portal/open';

/** Default bridge — GitHub Pages verified as text/html. */
export const PORTAL_BRIDGE_URL = PORTAL_BRIDGE_PAGES_URL;

/** Hosts that return the bridge file as plain text (or outdated mirrors). */
export const LEGACY_PORTAL_BRIDGE_URLS = [
  'https://cdn.jsdelivr.net/gh/Abumahaa2025/SPP_Stitch_App' + '@main/docs/portal-open.html',
  'https://cdn.jsdelivr.net/gh/Abumahaa2025/SPP_Stitch_App/main/docs/portal-open.html',
  'https://cdn.statically.io/gh/Abumahaa2025/SPP_Stitch_App' + '@main/docs/portal-open.html',
  'https://cdn.statically.io/gh/Abumahaa2025/SPP_Stitch_App/main/docs/portal-open.html',
  'https://raw.githubusercontent.com/Abumahaa2025/SPP_Stitch_App/main/docs/portal-open.html',
  // Prefer Pages over githack (interstitial / stale / merge-corrupted copies).
  'https://raw.githack.com/Abumahaa2025/SPP_Stitch_App/main/docs/portal-open.html',
  'https://raw.githack.com/Abumahaa2025/SPP_Stitch_App/master/docs/portal-open.html',
  'https://rawcdn.githack.com/Abumahaa2025/SPP_Stitch_App/main/docs/portal-open.html',
  'https://rawcdn.githack.com/Abumahaa2025/SPP_Stitch_App/master/docs/portal-open.html',
];

/** Preference order for the shared HTTPS bridge — first-party hosts first. */
const BRIDGE_CANDIDATES = [
  PORTAL_BRIDGE_PAGES_URL,
  PORTAL_BRIDGE_API_URL,
  PORTAL_BRIDGE_CDN_URL,
];

/** Marker proving a host returned the bridge page itself, not an error page. */
const BRIDGE_MARKER = 'portalManifest';

let activeBridge = PORTAL_BRIDGE_URL;
let bridgeProbe: Promise<string> | null = null;

/** Bridge base used by every link built from now on. */
export function portalBridgeUrl() {
  return activeBridge;
}

async function servesBridge(url: string) {
  try {
    const res = await fetch(`${url}?probe=1`);
    if (!res.ok) return false;
    if (!(res.headers.get('content-type') || '').toLowerCase().includes('text/html')) return false;
    return (await res.text()).includes(BRIDGE_MARKER);
  } catch {
    return false;
  }
}

/**
 * Pick the first bridge host that really answers HTML. Runs once per session;
 * keeps the verified default when every probe fails (offline / blocked).
 */
export function ensurePortalBridge(): Promise<string> {
  if (!bridgeProbe) {
    bridgeProbe = (async () => {
      for (const candidate of BRIDGE_CANDIDATES) {
        if (await servesBridge(candidate)) {
          activeBridge = candidate;
          return activeBridge;
        }
      }
      return activeBridge;
    })();
  }
  return bridgeProbe;
}

/** Rewrite plain-text / legacy bridge URLs (stored links, WhatsApp drafts) to the active host. */
export function normalizePortalBridgeText(text?: string | null): string {
  let out = String(text ?? '');
  if (!out) return out;
  const target = portalBridgeUrl();
  LEGACY_PORTAL_BRIDGE_URLS.forEach((legacy) => {
    if (out.includes(legacy)) out = out.split(legacy).join(target);
  });
  return out;
}

/** Same rewrite for a single stored portal URL. */
export function normalizePortalBridgeUrl(url?: string | null): string {
  return normalizePortalBridgeText(url);
}

/** Alias used by Apply / desk share paths — rewrite legacy plain-text bridge hosts. */
export function upgradeLegacyPortalBridgeUrl(url: string): string {
  return normalizePortalBridgeUrl(url);
}

export type PortalRole = 'tenant' | 'tech' | 'agent' | 'guard';

export type PortalShareMeta = {
  name?: string;
  unit?: string;
  property?: string;
  techName?: string;
  techPhone?: string;
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
    tn: meta?.techName,
    tp: meta?.techPhone,
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
    tn: meta?.techName,
    tp: meta?.techPhone,
    // Bump when bridge HTML behavior changes so WhatsApp / CDNs fetch a fresh page.
    v: '40',
  });
  return `${portalBridgeUrl()}?${q}`;
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
      ...(meta?.techName ? { tn: meta.techName } : {}),
      ...(meta?.techPhone ? { tp: meta.techPhone } : {}),
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

function metaFromParams(get: (k: string) => string | null | undefined): PortalShareMeta {
  return {
    name: get('n') || get('name') || undefined,
    unit: get('u') || get('unit') || undefined,
    property: get('prop') || undefined,
    techName: get('tn') || get('techName') || undefined,
    techPhone: get('tp') || get('techPhone') || undefined,
  };
}

function routeFromRole(
  role: string,
  id: string,
  t: string,
  meta: PortalShareMeta,
): string | null {
  if (!t) return null;
  if (role === 'tech') return inAppTechPortal(t, id || undefined, meta);
  if (role === 'agent' && id) return inAppAgentPortal(id, t, meta);
  if (role === 'guard' && id) return inAppGuardPortal(id, t, meta);
  if (id) return inAppTenantPortal(id, t, meta);
  return null;
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
    const get = (k: string) => {
      const v = (q as Record<string, unknown>)[k];
      return v != null && String(v).trim() !== '' ? String(v) : undefined;
    };
    const role = String(get('role') || get('r') || '');
    const id = String(get('id') || '');
    const t = String(get('t') || get('token') || '');
    const meta = metaFromParams((k) => get(k) ?? null);

    if (path.includes('portal/open') || path.includes('portal-open')) {
      const hit = routeFromRole(role, id, t, meta);
      if (hit) return hit;
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

  // Query / hash fallback for bridge URLs (Pages, API, githack, htmlpreview).
  try {
    const u = new URL(raw);
    const hashQ = u.hash.replace(/^#/, '');
    const sp = hashQ && hashQ.includes('=')
      ? new URLSearchParams(hashQ)
      : u.searchParams;
    const role = sp.get('role') || sp.get('r') || '';
    const id = sp.get('id') || '';
    const t = sp.get('t') || sp.get('token') || '';
    const meta = metaFromParams((k) => sp.get(k));
    const bridgeHost = [
      'githack', 'github.io', 'jsdelivr', 'statically',
      'raw.githubusercontent', 'onrender', 'htmlpreview.github.io',
    ].some((h) => u.hostname.includes(h));
    if (t && (u.pathname.includes('portal') || bridgeHost || raw.includes('portal-open'))) {
      return routeFromRole(role, id, t, meta);
    }
  } catch { /* ignore */ }

  return null;
}
