import { storage } from '@/src/utils/storage';
import type {
  AgentFollowUp,
  AgentPermissions,
  FollowUpActor,
  FollowUpDomain,
  FollowUpMediaItem,
  FollowUpStatus,
  PortalAccessEntry,
  PortalAccessState,
  PropertyAgentRecord,
  PropertyGuardRecord,
} from '@/src/types/portal-access';
import {
  DEFAULT_AGENT_PERMISSIONS,
  normalizeAgentPermissions,
} from '@/src/types/portal-access';
import { buildAgentPortalLink, buildGuardPortalLink, inAppAgentPortal } from '@/src/utils/portal-links';

const KEY = 'spp.portalAccess';

const DEFAULT: PortalAccessState = {
  agents: [],
  guards: [],
  followUps: [],
  accessLog: [],
};

let cache: PortalAccessState = { ...DEFAULT };
const listeners = new Set<() => void>();

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function subscribePortalAccess(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  listeners.forEach((fn) => fn());
}

function normalizeReply(r: Record<string, unknown>): {
  at: string; actor: FollowUpActor; text: string; authorName: string;
} {
  return {
    at: String(r.at || ''),
    actor: (r.actor as FollowUpActor) || 'agent',
    // Legacy replies stored message under `name`.
    text: String(r.text ?? r.name ?? ''),
    authorName: String(r.authorName || ''),
  };
}

function normalizeState(raw: Partial<PortalAccessState>): { state: PortalAccessState; dirty: boolean } {
  let dirty = false;
  const agents = (raw.agents || []).map((a) => ({
    ...a,
    permissions: normalizeAgentPermissions(a.permissions),
  }));
  const guards = (raw.guards || []).map((g) => {
    if (!g.portalToken) dirty = true;
    const portalToken = g.portalToken || uid('gtok').slice(-12);
    const portalUrl = g.portalUrl || buildGuardPortalLink(g.id, portalToken, { name: g.name }).url;
    if (!g.portalUrl) dirty = true;
    return {
      ...g,
      portalToken,
      portalUrl,
      linkActive: g.linkActive !== false,
    };
  });
  const followUps = (raw.followUps || []).map((f) => ({
    ...f,
    replies: (f.replies || []).map((r) => normalizeReply(r as unknown as Record<string, unknown>)),
  }));
  return {
    dirty,
    state: {
      agents,
      guards,
      followUps,
      accessLog: raw.accessLog || [],
    },
  };
}

export async function loadPortalAccess(): Promise<PortalAccessState> {
  const raw = await storage.getItem<string>(KEY, '');
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      const { state, dirty } = normalizeState({ ...DEFAULT, ...parsed });
      cache = state;
      if (dirty) {
        await storage.setItem(KEY, JSON.stringify(cache));
      }
    } catch { /* ignore */ }
  } else {
    cache = { ...DEFAULT };
  }
  return cache;
}

export async function savePortalAccess(next: PortalAccessState) {
  cache = normalizeState(next).state;
  await storage.setItem(KEY, JSON.stringify(cache));
  notify();
}

export async function addAgent(
  input: { name: string; phone: string; email: string; permissions: AgentPermissions },
): Promise<PropertyAgentRecord> {
  const s = await loadPortalAccess();
  const id = uid('agent');
  const token = uid('tok').slice(-12);
  const built = buildAgentPortalLink(id, token, { name: input.name });
  const agent: PropertyAgentRecord = {
    ...input,
    permissions: normalizeAgentPermissions(input.permissions),
    id,
    portalToken: token,
    portalUrl: built.url,
    qrData: built.qrData,
    createdAt: new Date().toISOString(),
    linkActive: true,
  };
  await savePortalAccess({ ...s, agents: [...s.agents, agent] });
  return agent;
}

export async function updateAgentPermissions(
  agentId: string,
  permissions: AgentPermissions,
): Promise<void> {
  const s = await loadPortalAccess();
  const agents = s.agents.map((a) => (
    a.id === agentId
      ? { ...a, permissions: normalizeAgentPermissions(permissions) }
      : a
  ));
  await savePortalAccess({ ...s, agents });
}

export async function addGuard(
  input: { name: string; phone: string; notes?: string; pairedAgentId?: string },
): Promise<PropertyGuardRecord> {
  const s = await loadPortalAccess();
  const id = uid('guard');
  const token = uid('gtok').slice(-12);
  const built = buildGuardPortalLink(id, token, { name: input.name.trim() });
  const guard: PropertyGuardRecord = {
    id,
    name: input.name.trim(),
    phone: input.phone.trim(),
    notes: input.notes?.trim(),
    pairedAgentId: input.pairedAgentId,
    portalToken: token,
    portalUrl: built.url,
    createdAt: new Date().toISOString(),
    linkActive: true,
  };
  await savePortalAccess({ ...s, guards: [...s.guards, guard] });
  return guard;
}

export async function createFollowUp(input: {
  title: string;
  body: string;
  domain: FollowUpDomain;
  createdBy: FollowUpActor;
  createdByName: string;
  agentId?: string;
  guardId?: string;
  status?: FollowUpStatus;
}): Promise<AgentFollowUp> {
  const s = await loadPortalAccess();
  const now = new Date().toISOString();
  const item: AgentFollowUp = {
    id: uid('fu'),
    title: input.title.trim(),
    body: input.body.trim(),
    domain: input.domain,
    status: input.status || 'open',
    createdBy: input.createdBy,
    createdByName: input.createdByName,
    agentId: input.agentId,
    guardId: input.guardId,
    createdAt: now,
    updatedAt: now,
    replies: [],
  };
  await savePortalAccess({ ...s, followUps: [item, ...s.followUps].slice(0, 80) });
  return item;
}

export async function replyFollowUp(
  followUpId: string,
  actor: FollowUpActor,
  authorName: string,
  message: string,
  nextStatus?: FollowUpStatus,
  media?: FollowUpMediaItem[],
): Promise<void> {
  const s = await loadPortalAccess();
  const now = new Date().toISOString();
  const text = message.trim() || (
    media?.length
      ? (media[0].kind === 'video' ? 'Video attachment' : 'Photo attachment')
      : ''
  );
  if (!text && !media?.length) return;
  const followUps = s.followUps.map((f) => {
    if (f.id !== followUpId) return f;
    return {
      ...f,
      updatedAt: now,
      status: nextStatus || (
        actor === 'guard' ? 'waiting_agent'
          : actor === 'agent' ? 'waiting_owner'
            : actor === 'owner' ? 'waiting_agent'
              : f.status
      ),
      replies: [
        ...f.replies,
        {
          at: now,
          actor,
          text,
          authorName,
          ...(media?.length ? { media } : {}),
        },
      ],
    };
  });
  await savePortalAccess({ ...s, followUps });
}

/** Guard claims an assigned follow-up task (notification → accept). */
export async function acceptGuardFollowUp(followUpId: string): Promise<void> {
  const s = await loadPortalAccess();
  const now = new Date().toISOString();
  const followUps = s.followUps.map((f) => {
    if (f.id !== followUpId) return f;
    if (f.guardAcceptedAt) return f;
    return {
      ...f,
      guardAcceptedAt: now,
      updatedAt: now,
      status: f.status === 'open' ? 'waiting_guard' : f.status,
    };
  });
  await savePortalAccess({ ...s, followUps });
}

export async function setFollowUpStatus(followUpId: string, status: FollowUpStatus) {
  const s = await loadPortalAccess();
  const followUps = s.followUps.map((f) => (
    f.id === followUpId ? { ...f, status, updatedAt: new Date().toISOString() } : f
  ));
  await savePortalAccess({ ...s, followUps });
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
  return inAppAgentPortal(agentId, token);
}

export function inAppAgentFollowUpsRoute(agentId: string, token: string) {
  return `/portal/agent-followups?id=${encodeURIComponent(agentId)}&t=${encodeURIComponent(token)}`;
}

export { inAppGuardPortal } from '@/src/utils/portal-links';

export { DEFAULT_AGENT_PERMISSIONS, normalizeAgentPermissions };
