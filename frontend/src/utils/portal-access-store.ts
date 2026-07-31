import { storage } from '@/src/utils/storage';
import type {
  AgentPermissions,
  PortalAccessEntry,
  PortalAccessState,
  PropertyAgentRecord,
} from '@/src/types/portal-access';

const KEY = 'spp.portalAccess';

const DEFAULT: PortalAccessState = { agents: [], accessLog: [] };

let cache: PortalAccessState = { ...DEFAULT };
const listeners = new Set<() => void>();

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function portalBase() {
  return 'https://spp.beta/portal';
}

export function subscribePortalAccess(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  listeners.forEach((fn) => fn());
}

export async function loadPortalAccess(): Promise<PortalAccessState> {
  const raw = await storage.getItem<string>(KEY, '');
  if (raw) {
    try {
      cache = { ...DEFAULT, ...JSON.parse(raw) };
    } catch { /* ignore */ }
  }
  return cache;
}

export async function savePortalAccess(next: PortalAccessState) {
  cache = next;
  await storage.setItem(KEY, JSON.stringify(next));
  notify();
}

export async function addAgent(
  input: { name: string; phone: string; email: string; permissions: AgentPermissions },
): Promise<PropertyAgentRecord> {
  const s = await loadPortalAccess();
  const id = uid('agent');
  const token = uid('tok').slice(-12);
  const url = `${portalBase()}/agent/${id}?t=${token}`;
  const agent: PropertyAgentRecord = {
    ...input,
    id,
    portalToken: token,
    portalUrl: url,
    qrData: url,
    createdAt: new Date().toISOString(),
    linkActive: true,
  };
  await savePortalAccess({ ...s, agents: [...s.agents, agent] });
  return agent;
}

export async function recordPortalLogin(
  userId: string,
  userType: PortalAccessEntry['userType'],
  name: string,
) {
  const s = await loadPortalAccess();
  const now = new Date().toISOString();
  const existing = s.accessLog.find((e) => e.userId === userId && e.userType === userType);
  const entry: PortalAccessEntry = existing
    ? { ...existing, lastLoginAt: now, linkActive: true }
    : { userId, userType, name, lastLoginAt: now, linkActive: true };
  const accessLog = [
    entry,
    ...s.accessLog.filter((e) => !(e.userId === userId && e.userType === userType)),
  ].slice(0, 50);
  await savePortalAccess({ ...s, accessLog });
}

export async function toggleAgentLink(agentId: string, active: boolean) {
  const s = await loadPortalAccess();
  const agents = s.agents.map((a) => (a.id === agentId ? { ...a, linkActive: active } : a));
  await savePortalAccess({ ...s, agents });
}

export function inAppAgentRoute(agentId: string, token: string) {
  return `/portal/agent?id=${agentId}&t=${token}`;
}
