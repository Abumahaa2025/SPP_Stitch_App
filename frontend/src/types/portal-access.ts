/** Portal access & shared agents — additive layer (separate from property-os.ts). */

export type AgentPermissions = {
  contracts: boolean;
  maintenance: boolean;
  tenants: boolean;
  wallet: boolean;
  settings: boolean;
};

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

export type PortalUserType = 'tenant' | 'technician' | 'agent';

export type PortalAccessEntry = {
  userId: string;
  userType: PortalUserType;
  name: string;
  lastLoginAt?: string;
  linkActive: boolean;
};

export type PortalAccessState = {
  agents: PropertyAgentRecord[];
  accessLog: PortalAccessEntry[];
};
