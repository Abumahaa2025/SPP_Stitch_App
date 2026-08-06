/**
 * Portal deep links — HTTPS bridge (WhatsApp-clickable) + in-app routes.

 *
 * Shared links MUST open a real HTML page (never API JSON 404 braces,
 * never jsDelivr text/plain source). Strategy:
 *   1) htmlpreview + raw GitHub HTML (works immediately, text/html shell)
 *   2) GitHub Pages / API when those hosts are enabled later
 */
import * as ExpoLinking from 'expo-linking';

/** Preferred HTML portal once GitHub Pages is enabled. */
export const PORTAL_BRIDGE_PAGES_URL =
  'https://abumahaa2025.github.io/SPP_Stitch_App/portal-open.html';

/** FastAPI HTML bridge (after Render deploy). */
export const PORTAL_BRIDGE_API_URL = 'https://spp-beta-api.onrender.com/portal/open';

/** Raw HTML on GitHub (source for htmlpreview). Keep in sync with docs/portal-open.html. */
export const PORTAL_HTML_RAW_URL =
  'https://raw.githubusercontent.com/Abumahaa2025/SPP_Stitch_App/cursor/cloud-agent-1785716502289-m3epx/docs/portal-open.html';

/**
 * Immediate WhatsApp-safe bridge: htmlpreview serves text/html and injects our portal.
 * Portal params go in the hash so they survive htmlpreview's ?source URL.
 */
export const PORTAL_BRIDGE_PREVIEW_BASE = 'https://htmlpreview.github.io/?';

/** @deprecated Legacy CDN that serves text/plain — detection/rewrite only. */
export const PORTAL_BRIDGE_URL =
  'https://cdn.jsdelivr.net/gh/Abumahaa2025/SPP_Stitch_App@main/docs/portal-open.html';

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
 * githack mirror of the same file — served as text/html without any deploy, but
 * browsers navigating to it get a one-tap "One more step" notice first, so it is
 * only the last-resort host.
 */
export const PORTAL_BRIDGE_CDN_URL =
  'https://raw.githack.com/Abumahaa2025/SPP_Stitch_App/main/docs/portal-open.html';

/** Active public bridge helper. */
export const PORTAL_BRIDGE_PUBLIC_URL = PORTAL_BRIDGE_PAGES_URL;

/** Default bridge — the mirror that is verified to render HTML today. */
export const PORTAL_BRIDGE_URL = PORTAL_BRIDGE_CDN_URL;

/** Hosts that return the bridge file as plain text (link shows source code). */
export const LEGACY_PORTAL_BRIDGE_URLS = [
  'https://cdn.jsdelivr.net/gh/Abumahaa2025/SPP_Stitch_App@main/docs/portal-open.html',
  'https://cdn.jsdelivr.net/gh/Abumahaa2025/SPP_Stitch_App/main/docs/portal-open.html',
  'https://cdn.statically.io/gh/Abumahaa2025/SPP_Stitch_App@main/docs/portal-open.html',
  'https://cdn.statically.io/gh/Abumahaa2025/SPP_Stitch_App/main/docs/portal-open.html',
  'https://raw.githubusercontent.com/Abumahaa2025/SPP_Stitch_App/main/docs/portal-open.html',
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

/** Rewrite plain-text bridge URLs (stored links, WhatsApp drafts) to a working host. */
export function normalizePortalBridgeText(text?: string | null): string {
  let out = String(text ?? '');
  if (!out) return out;
  LEGACY_PORTAL_BRIDGE_URLS.forEach((legacy) => {
    if (out.includes(legacy)) out = out.split(legacy).join(portalBridgeUrl());
  });
  return out;
}

/** Same rewrite for a single stored portal URL. */
export function normalizePortalBridgeUrl(url?: string | null): string {
  return normalizePortalBridgeText(url);
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

function isLegacyTextBridgeHost(hostname: string, pathname: string) {
  const host = hostname.toLowerCase();
  const path = pathname.toLowerCase();
  return (
    host.includes('jsdelivr.net') ||
    host.includes('statically.io') ||
    host.includes('githubusercontent.com') ||
    host.includes('githack.com') ||
    path.endsWith('portal-open.html')
  );
}

function isPortalBridgeHost(hostname: string, pathname: string) {
  const host = hostname.toLowerCase();
  return (
    isLegacyTextBridgeHost(hostname, pathname) ||
    host.includes('onrender.com') ||
    host.includes('github.io') ||
    host.includes('htmlpreview.github.io')
  );
}

function buildPreviewBridgeUrl(query: string) {
  // Hash carries portal params; search carries the raw HTML source for htmlpreview.
  return `${PORTAL_BRIDGE_PREVIEW_BASE}${PORTAL_HTML_RAW_URL}#${query}`;
}

/**
 * Rewrite stored/shared bridge URLs that open as plain text / JSON 404
 * onto a real HTML portal preview. Preserves query/hash token + tech fields.
 */
export function upgradeLegacyPortalBridgeUrl(url: string): string {
  const raw = String(url || '').trim();
  if (!raw) return raw;
  try {
    if (raw.includes('htmlpreview.github.io') && raw.includes('portal-open')) return raw;
    const u = new URL(raw);
    const onPages =
      u.hostname.toLowerCase().includes('github.io') &&
      u.pathname.toLowerCase().includes('portal-open');
    if (onPages || isLegacyTextBridgeHost(u.hostname, u.pathname) ||
      (u.hostname.includes('onrender.com') && u.pathname.includes('/portal/open')) ||
      u.searchParams.has('t') ||
      u.searchParams.has('role')) {
      const q = u.searchParams.toString() || u.hash.replace(/^#/, '');
      return q ? buildPreviewBridgeUrl(q) : buildPreviewBridgeUrl('role=tenant');
    }
  } catch {
    /* ignore */
  }
  return raw;
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
    v: '37',
  });
  // htmlpreview = real HTML page now (no JSON symbols / no text document).
  return buildPreviewBridgeUrl(q);

    v: '36',
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

  const metaFromQuery = (q: Record<string, unknown> | URLSearchParams) => {
    const get = (k: string) => {
      if (q instanceof URLSearchParams) return q.get(k) || undefined;
      const v = (q as Record<string, unknown>)[k];
      return v != null && String(v).trim() !== '' ? String(v) : undefined;
    };
    return {
      name: get('n') || get('name'),
      unit: get('u') || get('unit'),
      property: get('prop'),
      techName: get('tn') || get('techName'),
      techPhone: get('tp') || get('techPhone'),
    };
  };

  const parseCombined = (href: string) => {
    try {
      const u = new URL(href);
      const hashQ = u.hash.replace(/^#/, '');
      const sp = hashQ && hashQ.includes('=')
        ? new URLSearchParams(hashQ)
        : u.searchParams;
      return { sp, host: u.hostname, path: u.pathname };
    } catch {
      return null;
    }
  };

  try {
    const parsed = ExpoLinking.parse(raw);
    const path = `/${(parsed.path || '').replace(/^\//, '')}`;
    const q = parsed.queryParams || {};
    const role = String(q.role || '');
    const id = String(q.id || '');
    const t = String(q.t || '');
    const meta = metaFromQuery(q as Record<string, unknown>);

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


  const combined = parseCombined(raw);
  if (combined) {
    const { sp, host, path } = combined;
    const role = sp.get('role') || '';
    const id = sp.get('id') || '';
    const t = sp.get('t') || '';
    const meta = metaFromQuery(sp);
    if (t && (path.includes('portal') || isPortalBridgeHost(host, path) || raw.includes('portal-open'))) {

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
    const bridgeHost = ['githack', 'github.io', 'jsdelivr', 'statically', 'raw.githubusercontent', 'onrender']
      .some((h) => u.hostname.includes(h));
    if (t && (u.pathname.includes('portal') || bridgeHost)) {

      if (role === 'tech') return inAppTechPortal(t, id || undefined, meta);
      if (role === 'agent' && id) return inAppAgentPortal(id, t, meta);
      if (role === 'guard' && id) return inAppGuardPortal(id, t, meta);
      if (id) return inAppTenantPortal(id, t, meta);
    }
  }

  return null;
}
