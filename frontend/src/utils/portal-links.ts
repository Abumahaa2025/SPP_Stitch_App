/**
 * Portal deep links — in-app routes + shareable spp:// URLs.
 * Replaces dead https://spp.beta/... hosts that never open.
 */
import * as ExpoLinking from 'expo-linking';

export function inAppTenantPortal(tenantId: string, token: string) {
  return `/portal/tenant?id=${encodeURIComponent(tenantId)}&t=${encodeURIComponent(token)}`;
}

export function inAppTechPortal(token: string, techId?: string) {
  if (techId) {
    return `/portal/tech?id=${encodeURIComponent(techId)}&t=${encodeURIComponent(token)}`;
  }
  return `/portal/tech?t=${encodeURIComponent(token)}`;
}

export function inAppAgentPortal(agentId: string, token: string) {
  return `/portal/agent?id=${encodeURIComponent(agentId)}&t=${encodeURIComponent(token)}`;
}

export function buildTenantPortalLink(tenantId: string, token: string) {
  const inApp = inAppTenantPortal(tenantId, token);
  const url = ExpoLinking.createURL('/portal/tenant', {
    queryParams: { id: tenantId, t: token },
  });
  return { url, qrData: url, token, inApp };
}

export function buildTechPortalLink(token: string, techId?: string) {
  const inApp = inAppTechPortal(token, techId);
  const queryParams: Record<string, string> = { t: token };
  if (techId) queryParams.id = techId;
  const url = ExpoLinking.createURL('/portal/tech', { queryParams });
  return { url, qrData: url, token, inApp };
}

export function buildAgentPortalLink(agentId: string, token: string) {
  const inApp = inAppAgentPortal(agentId, token);
  const url = ExpoLinking.createURL('/portal/agent', {
    queryParams: { id: agentId, t: token },
  });
  return { url, qrData: url, token, inApp };
}

/** Prefer opening inside the app; never rely on https://spp.beta. */
export function resolvePortalInAppFromUrl(url: string): string | null {
  const raw = String(url || '').trim();
  if (!raw) return null;
  if (raw.startsWith('/portal/')) return raw;

  try {
    const parsed = ExpoLinking.parse(raw);
    const path = `/${(parsed.path || '').replace(/^\//, '')}`;
    const q = parsed.queryParams || {};
    const id = String(q.id || '');
    const t = String(q.t || '');

    if (path.includes('portal/tenant') || path.endsWith('/tenant') || /\/tenant\//.test(raw)) {
      const pathId = raw.match(/\/tenant\/([^/?#]+)/)?.[1];
      const tenantId = id || pathId || '';
      if (tenantId && t) return inAppTenantPortal(tenantId, t);
    }
    if (path.includes('portal/tech') || path.endsWith('/tech') || /\/tech(\?|$)/.test(raw)) {
      if (t) return inAppTechPortal(t, id || undefined);
    }
    if (path.includes('portal/agent') || path.endsWith('/agent') || /\/agent\//.test(raw)) {
      const pathId = raw.match(/\/agent\/([^/?#]+)/)?.[1];
      const agentId = id || pathId || '';
      if (agentId && t) return inAppAgentPortal(agentId, t);
    }
  } catch { /* ignore */ }

  // Legacy https://spp.beta/portal/tenant/ID?t=TOKEN
  const legacyTenant = raw.match(/\/portal\/tenant\/([^/?#]+)\?[^#]*t=([^&#]+)/i);
  if (legacyTenant) return inAppTenantPortal(decodeURIComponent(legacyTenant[1]), decodeURIComponent(legacyTenant[2]));
  const legacyTech = raw.match(/\/portal\/tech(?:\?|&)(?:id=([^&#]+)&)?t=([^&#]+)/i)
    || raw.match(/\/portal\/tech\?t=([^&#]+)/i);
  if (legacyTech) {
    if (legacyTech.length >= 3 && legacyTech[2]) {
      return inAppTechPortal(decodeURIComponent(legacyTech[2]), legacyTech[1] ? decodeURIComponent(legacyTech[1]) : undefined);
    }
    if (legacyTech[1]) return inAppTechPortal(decodeURIComponent(legacyTech[1]));
  }
  const legacyAgent = raw.match(/\/portal\/agent\/([^/?#]+)\?[^#]*t=([^&#]+)/i);
  if (legacyAgent) return inAppAgentPortal(decodeURIComponent(legacyAgent[1]), decodeURIComponent(legacyAgent[2]));

  return null;
}
