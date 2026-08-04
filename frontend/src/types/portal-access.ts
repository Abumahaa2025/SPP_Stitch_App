/** Portal access & shared agents — additive layer (separate from property-os.ts). */

/**
 * Owner-selectable agent scopes (requested product set):
 * contracts · rentals · electricity · water · maintenance
 * Legacy flags (tenants/wallet/settings) remain for backward compatibility.
 */
export type AgentPermissions = {
  contracts: boolean;
  rentals: boolean;
  electricity: boolean;
  water: boolean;
  maintenance: boolean;
  /** @deprecated prefer rentals — kept for older saved agents */
  tenants: boolean;
  wallet: boolean;
  settings: boolean;
};

/** Permissions the owner toggles when creating/editing an agent link. */
export const AGENT_OWNER_PERM_KEYS = [
  'contracts',
  'rentals',
  'electricity',
  'water',
  'maintenance',
] as const;

export type AgentOwnerPermKey = (typeof AGENT_OWNER_PERM_KEYS)[number];

export const DEFAULT_AGENT_PERMISSIONS: AgentPermissions = {
  contracts: true,
  rentals: true,
  electricity: false,
  water: false,
  maintenance: true,
  tenants: true,
  wallet: false,
  settings: false,
};

export function normalizeAgentPermissions(
  raw?: Partial<AgentPermissions> | null,
): AgentPermissions {
  const base = { ...DEFAULT_AGENT_PERMISSIONS, ...(raw || {}) };
  // Older agents used tenants for lease roster — map into rentals when missing.
  if (raw && raw.rentals === undefined && raw.tenants !== undefined) {
    base.rentals = Boolean(raw.tenants);
  }
  return base;
}

export type PropertyAgentRecord = {
  id: string;
  name: string;
  phone: string;
  email: string;
  permissions: AgentPermissions;
  portalToken: string;
  portalUrl: string;
  qrData: string;
  createdAt: string;
  lastLoginAt?: string;
  linkActive: boolean;
};

/** Building guard / حارس — linked to property for agent↔guard↔owner follow-ups. */
export type PropertyGuardRecord = {
  id: string;
  name: string;
  phone: string;
  notes?: string;
  createdAt: string;
  linkActive: boolean;
  /** Optional agent this guard is paired with */
  pairedAgentId?: string;
  /** In-app portal token (generated on create; backfilled on load if missing). */
  portalToken: string;
  /** HTTPS bridge share URL (WhatsApp-clickable). */
  portalUrl?: string;
};

export type FollowUpActor = 'owner' | 'agent' | 'guard';

export type FollowUpDomain =
  | 'contracts'
  | 'rentals'
  | 'electricity'
  | 'water'
  | 'maintenance'
  | 'general';

export type FollowUpStatus = 'open' | 'waiting_guard' | 'waiting_agent' | 'waiting_owner' | 'done';

export type AgentFollowUpReply = {
  at: string;
  actor: FollowUpActor;
  text: string;
  authorName: string;
};

export type AgentFollowUp = {
  id: string;
  title: string;
  body: string;
  domain: FollowUpDomain;
  status: FollowUpStatus;
  createdBy: FollowUpActor;
  createdByName: string;
  agentId?: string;
  guardId?: string;
  createdAt: string;
  updatedAt: string;
  replies: AgentFollowUpReply[];
};

export type PortalUserType = 'tenant' | 'technician' | 'agent' | 'guard';

export type PortalAccessEntry = {
  userId: string;
  userType: PortalUserType;
  name: string;
  lastLoginAt?: string;
  linkActive: boolean;
};

export type PortalAccessState = {
  agents: PropertyAgentRecord[];
  guards: PropertyGuardRecord[];
  followUps: AgentFollowUp[];
  accessLog: PortalAccessEntry[];
};
