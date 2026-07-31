/** Official / canonical tenant registry — independent of transient import previews. */

export type CanonicalTenantStatus = 'active' | 'vacated' | 'transferred';

export type CanonicalTenantSource = 'latest_statement' | 'manual_official' | 'import';

export type CanonicalTenantEventKind =
  | 'synced_from_statement'
  | 'created'
  | 'updated'
  | 'rent_changed'
  | 'vacated'
  | 'transferred'
  | 'new_tenant'
  | 'contact_ready';

export type CanonicalTenantEvent = {
  id: string;
  kind: CanonicalTenantEventKind;
  at: string;
  tenantId: string;
  unitNumber?: string;
  detail?: string;
  payload?: Record<string, string | number | boolean>;
};

export type CanonicalTenant = {
  id: string;
  /** Links to PropertyOS tenant id when present */
  osTenantId?: string;
  unitId: string;
  unitNumber: string;
  name: string;
  phone: string;
  email?: string;
  nationalId?: string;
  contractNumber?: string;
  rentAmount: number;
  status: CanonicalTenantStatus;
  /** Official for auto-communication (WhatsApp / alerts) */
  official: boolean;
  source: CanonicalTenantSource;
  lastStatementAt?: string;
  moveInDate?: string;
  vacatedAt?: string;
  transferredToUnitId?: string;
  transferredToUnitNumber?: string;
  previousName?: string;
  notes?: string;
  updatedAt: string;
};

export type CanonicalTenantState = {
  tenants: CanonicalTenant[];
  events: CanonicalTenantEvent[];
  lastSyncedAt?: string;
  lastStatementPeriod?: string;
};
