/**
 * Official tenant database — names from latest statement by default,
 * with manual official edits (vacate / transfer / new / rent) preserved.
 */
import type {
  CanonicalTenant,
  CanonicalTenantEvent,
  CanonicalTenantState,
  CanonicalTenantStatus,
} from '@/src/types/canonical-tenant';
import type { PropertyOSState, TenantRecord, UnitRecord } from '@/src/types/property-os';
import { storage } from '@/src/utils/storage';
import { buildTenantPortal, buildWhatsAppWelcome } from '@/src/hooks/usePropertyOS';

const KEY = 'spp.canonicalTenants';
const OS_KEY = 'spp.propertyOS';

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function emptyState(): CanonicalTenantState {
  return { tenants: [], events: [] };
}

export async function loadCanonicalTenants(): Promise<CanonicalTenantState> {
  const raw = await storage.getItem<string>(KEY, '');
  if (!raw) return emptyState();
  try {
    const parsed = JSON.parse(raw) as CanonicalTenantState;
    return {
      tenants: parsed.tenants ?? [],
      events: parsed.events ?? [],
      lastSyncedAt: parsed.lastSyncedAt,
      lastStatementPeriod: parsed.lastStatementPeriod,
    };
  } catch {
    return emptyState();
  }
}

async function persist(state: CanonicalTenantState) {
  await storage.setItem(KEY, JSON.stringify({
    ...state,
    events: (state.events || []).slice(0, 200),
  }));
  return state;
}

function pushEvent(
  state: CanonicalTenantState,
  kind: CanonicalTenantEvent['kind'],
  tenantId: string,
  detail?: string,
  extra?: Partial<CanonicalTenantEvent>,
): CanonicalTenantState {
  const ev: CanonicalTenantEvent = {
    id: uid('cte'),
    kind,
    at: new Date().toISOString(),
    tenantId,
    detail,
    ...extra,
  };
  return { ...state, events: [ev, ...(state.events || [])] };
}

/** Seed / refresh registry from PropertyOS after latest statement Apply. */
export async function syncCanonicalFromPropertyOS(
  os: PropertyOSState,
  opts?: {
    period?: string;
    /** Prefer statement names unless tenant is marked manual_official */
    forceStatementNames?: boolean;
    lang?: 'ar' | 'en';
  },
): Promise<CanonicalTenantState> {
  const prev = await loadCanonicalTenants();
  const now = new Date().toISOString();
  const byOsId = new Map(prev.tenants.map((t) => [t.osTenantId || t.id, t]));
  const byUnit = new Map(prev.tenants.filter((t) => t.status === 'active').map((t) => [t.unitId, t]));

  let nextTenants = [...prev.tenants];
  let events = [...(prev.events || [])];
  const touch = (kind: CanonicalTenantEvent['kind'], tenantId: string, detail?: string, unitNumber?: string) => {
    events = [{
      id: uid('cte'),
      kind,
      at: now,
      tenantId,
      detail,
      unitNumber,
    }, ...events];
  };

  for (const osTenant of os.tenants) {
    const unit = os.units.find((u) => u.id === osTenant.unitId);
    const unitNumber = unit?.number || '—';
    const rent = unit?.rentAmount ?? 0;
    const existing = byOsId.get(osTenant.id) || byUnit.get(osTenant.unitId);
    const keepManual = existing?.source === 'manual_official' && !opts?.forceStatementNames;

    if (existing) {
      const updated: CanonicalTenant = {
        ...existing,
        osTenantId: osTenant.id,
        unitId: osTenant.unitId,
        unitNumber,
        name: keepManual ? existing.name : (osTenant.name || existing.name),
        phone: keepManual ? existing.phone : (osTenant.phone || existing.phone),
        email: keepManual ? existing.email : (osTenant.email || existing.email),
        rentAmount: keepManual ? existing.rentAmount : (rent || existing.rentAmount),
        contractNumber: keepManual
          ? existing.contractNumber
          : (os.contracts.find((c) => c.tenantId === osTenant.id)?.number || existing.contractNumber),
        status: existing.status === 'vacated' && keepManual ? 'vacated' : 'active',
        official: true,
        source: keepManual ? 'manual_official' : 'latest_statement',
        lastStatementAt: now,
        moveInDate: osTenant.moveInDate || existing.moveInDate,
        updatedAt: now,
        previousName:
          !keepManual && existing.name && osTenant.name && existing.name !== osTenant.name
            ? existing.name
            : existing.previousName,
      };
      nextTenants = nextTenants.map((t) => (t.id === existing.id ? updated : t));
      if (!keepManual && existing.name !== updated.name) {
        touch('synced_from_statement', existing.id, `${existing.name} → ${updated.name}`, unitNumber);
      }
    } else {
      const id = uid('ct');
      const created: CanonicalTenant = {
        id,
        osTenantId: osTenant.id,
        unitId: osTenant.unitId,
        unitNumber,
        name: osTenant.name || '—',
        phone: osTenant.phone || '',
        email: osTenant.email || '',
        rentAmount: rent,
        contractNumber: os.contracts.find((c) => c.tenantId === osTenant.id)?.number || '',
        status: 'active',
        official: true,
        source: 'latest_statement',
        lastStatementAt: now,
        moveInDate: osTenant.moveInDate,
        updatedAt: now,
      };
      nextTenants = [created, ...nextTenants];
      touch('synced_from_statement', id, created.name, unitNumber);
      touch('contact_ready', id, created.phone || undefined, unitNumber);
    }
  }

  const state: CanonicalTenantState = {
    tenants: nextTenants,
    events: events.slice(0, 200),
    lastSyncedAt: now,
    lastStatementPeriod: opts?.period || prev.lastStatementPeriod,
  };
  return persist(state);
}

async function patchOsTenant(
  osTenantId: string | undefined,
  patch: Partial<TenantRecord> & { rentAmount?: number; unitStatus?: UnitRecord['status'] },
) {
  if (!osTenantId) return;
  const raw = await storage.getItem<string>(OS_KEY, '');
  if (!raw) return;
  let os: PropertyOSState;
  try {
    os = JSON.parse(raw) as PropertyOSState;
  } catch {
    return;
  }
  const tenants = os.tenants.map((t) => (t.id === osTenantId ? { ...t, ...patch, id: t.id } : t));
  let units = os.units;
  const tenant = tenants.find((t) => t.id === osTenantId);
  if (tenant && typeof patch.rentAmount === 'number') {
    units = units.map((u) => (u.id === tenant.unitId ? { ...u, rentAmount: patch.rentAmount! } : u));
  }
  if (tenant && patch.unitStatus) {
    units = units.map((u) => (u.id === tenant.unitId ? { ...u, status: patch.unitStatus! } : u));
  }
  const contracts = os.contracts.map((c) => {
    if (c.tenantId !== osTenantId) return c;
    if (typeof patch.rentAmount === 'number') return { ...c, rentAmount: patch.rentAmount };
    return c;
  });
  await storage.setItem(OS_KEY, JSON.stringify({ ...os, tenants, units, contracts }));
}

export async function updateCanonicalTenant(
  id: string,
  patch: Partial<Pick<CanonicalTenant, 'name' | 'phone' | 'email' | 'nationalId' | 'contractNumber' | 'notes' | 'rentAmount'>>,
): Promise<CanonicalTenantState> {
  const state = await loadCanonicalTenants();
  const prev = state.tenants.find((t) => t.id === id);
  if (!prev) return state;
  const now = new Date().toISOString();
  const next: CanonicalTenant = {
    ...prev,
    ...patch,
    official: true,
    source: 'manual_official',
    updatedAt: now,
  };
  let nextState: CanonicalTenantState = {
    ...state,
    tenants: state.tenants.map((t) => (t.id === id ? next : t)),
  };
  const rentChanged = typeof patch.rentAmount === 'number' && patch.rentAmount !== prev.rentAmount;
  nextState = pushEvent(
    nextState,
    rentChanged ? 'rent_changed' : 'updated',
    id,
    rentChanged
      ? `${prev.rentAmount} → ${patch.rentAmount}`
      : `${next.name} · ${next.phone}`,
    { unitNumber: next.unitNumber },
  );
  await patchOsTenant(prev.osTenantId, {
    name: next.name,
    phone: next.phone,
    email: next.email || '',
    nationalId: next.nationalId,
    rentAmount: next.rentAmount,
  });
  return persist(nextState);
}

export async function vacateCanonicalTenant(id: string, note?: string): Promise<CanonicalTenantState> {
  const state = await loadCanonicalTenants();
  const prev = state.tenants.find((t) => t.id === id);
  if (!prev) return state;
  const now = new Date().toISOString();
  const next: CanonicalTenant = {
    ...prev,
    status: 'vacated',
    vacatedAt: now,
    official: true,
    source: 'manual_official',
    notes: note || prev.notes,
    updatedAt: now,
  };
  let nextState: CanonicalTenantState = {
    ...state,
    tenants: state.tenants.map((t) => (t.id === id ? next : t)),
  };
  nextState = pushEvent(nextState, 'vacated', id, note || prev.name, { unitNumber: prev.unitNumber });

  // Mirror into PropertyOS: remove active tenant, mark unit vacant, history
  const raw = await storage.getItem<string>(OS_KEY, '');
  if (raw && prev.osTenantId) {
    try {
      const os = JSON.parse(raw) as PropertyOSState;
      const history = [
        ...(os.unitHistory || []),
        {
          unitId: prev.unitId,
          tenantName: prev.name,
          note: note || 'Vacated (official)',
          endedAt: now,
        },
      ];
      await storage.setItem(OS_KEY, JSON.stringify({
        ...os,
        tenants: os.tenants.filter((t) => t.id !== prev.osTenantId),
        contracts: os.contracts.filter((c) => c.tenantId !== prev.osTenantId),
        units: os.units.map((u) => (u.id === prev.unitId ? { ...u, status: 'vacant' as const } : u)),
        unitHistory: history,
      }));
    } catch { /* ignore */ }
  }
  return persist(nextState);
}

export async function transferCanonicalTenant(
  id: string,
  toUnitId: string,
  toUnitNumber: string,
  note?: string,
): Promise<CanonicalTenantState> {
  const state = await loadCanonicalTenants();
  const prev = state.tenants.find((t) => t.id === id);
  if (!prev) return state;
  const now = new Date().toISOString();
  const next: CanonicalTenant = {
    ...prev,
    status: 'transferred',
    transferredToUnitId: toUnitId,
    transferredToUnitNumber: toUnitNumber,
    unitId: toUnitId,
    unitNumber: toUnitNumber,
    official: true,
    source: 'manual_official',
    notes: note || prev.notes,
    updatedAt: now,
  };
  // Clear any other active occupant on target unit in registry
  let tenants = state.tenants.map((t) => {
    if (t.id === id) return next;
    if (t.unitId === toUnitId && t.status === 'active') {
      return { ...t, status: 'vacated' as CanonicalTenantStatus, vacatedAt: now, updatedAt: now, source: 'manual_official' as const };
    }
    return t;
  });
  let nextState: CanonicalTenantState = { ...state, tenants };
  nextState = pushEvent(
    nextState,
    'transferred',
    id,
    `${prev.unitNumber} → ${toUnitNumber}${note ? ` · ${note}` : ''}`,
    { unitNumber: toUnitNumber },
  );

  const raw = await storage.getItem<string>(OS_KEY, '');
  if (raw && prev.osTenantId) {
    try {
      const os = JSON.parse(raw) as PropertyOSState;
      await storage.setItem(OS_KEY, JSON.stringify({
        ...os,
        tenants: os.tenants.map((t) => (t.id === prev.osTenantId ? { ...t, unitId: toUnitId } : t)),
        contracts: os.contracts.map((c) => (c.tenantId === prev.osTenantId ? { ...c, unitId: toUnitId } : c)),
        units: os.units.map((u) => {
          if (u.id === prev.unitId) return { ...u, status: 'vacant' as const };
          if (u.id === toUnitId) return { ...u, status: 'occupied' as const, rentAmount: next.rentAmount || u.rentAmount };
          return u;
        }),
      }));
    } catch { /* ignore */ }
  }
  return persist(nextState);
}

export async function addNewOfficialTenant(input: {
  name: string;
  phone: string;
  unitId: string;
  unitNumber: string;
  rentAmount: number;
  contractNumber?: string;
  lang: 'ar' | 'en';
}): Promise<CanonicalTenantState> {
  const state = await loadCanonicalTenants();
  const now = new Date().toISOString();
  const osId = uid('tenant');
  const token = uid('tok').slice(-12);
  const portal = buildTenantPortal(osId, token);

  // Vacate previous active on same unit in registry
  let tenants = state.tenants.map((t) => {
    if (t.unitId === input.unitId && t.status === 'active') {
      return { ...t, status: 'vacated' as const, vacatedAt: now, updatedAt: now, source: 'manual_official' as const };
    }
    return t;
  });

  const created: CanonicalTenant = {
    id: uid('ct'),
    osTenantId: osId,
    unitId: input.unitId,
    unitNumber: input.unitNumber,
    name: input.name.trim(),
    phone: input.phone.trim(),
    rentAmount: input.rentAmount,
    contractNumber: input.contractNumber || '',
    status: 'active',
    official: true,
    source: 'manual_official',
    moveInDate: now.slice(0, 10),
    updatedAt: now,
  };
  tenants = [created, ...tenants];

  let nextState: CanonicalTenantState = { ...state, tenants };
  nextState = pushEvent(nextState, 'new_tenant', created.id, created.name, { unitNumber: input.unitNumber });
  nextState = pushEvent(nextState, 'contact_ready', created.id, created.phone, { unitNumber: input.unitNumber });

  const raw = await storage.getItem<string>(OS_KEY, '');
  if (raw) {
    try {
      const os = JSON.parse(raw) as PropertyOSState;
      const osTenant: TenantRecord = {
        id: osId,
        name: created.name,
        phone: created.phone,
        email: '',
        unitId: input.unitId,
        moveInDate: created.moveInDate || '',
        portalToken: portal.token,
        portalUrl: portal.url,
        qrData: portal.qrData,
        whatsAppMessage: buildWhatsAppWelcome(created.name, portal.url, input.lang),
      };
      // Remove prior OS tenants on same unit
      const keptTenants = os.tenants.filter((t) => t.unitId !== input.unitId);
      const keptContracts = os.contracts.filter((c) => {
        const t = os.tenants.find((x) => x.id === c.tenantId);
        return t?.unitId !== input.unitId;
      });
      await storage.setItem(OS_KEY, JSON.stringify({
        ...os,
        tenants: [...keptTenants, osTenant],
        contracts: [
          ...keptContracts,
          {
            id: uid('contract'),
            number: created.contractNumber || '',
            tenantId: osId,
            unitId: input.unitId,
            startDate: created.moveInDate || '',
            endDate: '',
            rentAmount: input.rentAmount,
            paymentType: 'monthly' as const,
            depositAmount: 0,
            specialTerms: input.lang === 'ar' ? 'مستأجر رسمي جديد' : 'New official tenant',
          },
        ],
        units: os.units.map((u) => (
          u.id === input.unitId
            ? { ...u, status: 'occupied' as const, rentAmount: input.rentAmount }
            : u
        )),
      }));
    } catch { /* ignore */ }
  }

  return persist(nextState);
}

/** Phone/name used for automated tenant messaging — official registry first. */
export async function resolveOfficialContact(osTenantId: string): Promise<{ name: string; phone: string } | null> {
  const state = await loadCanonicalTenants();
  const ct = state.tenants.find((t) => t.osTenantId === osTenantId && t.official && t.status === 'active');
  if (ct) return { name: ct.name, phone: ct.phone };
  return null;
}

export function buildWhatsAppCollectionMessage(ct: CanonicalTenant, ar: boolean, arrears?: number) {
  const amount = Number(arrears || 0).toLocaleString();
  if (ar) {
    return `السلام عليكم ${ct.name}،\n\nتذكير رسمي من إدارة العقار (وحدة ${ct.unitNumber}).\nالإيجار الشهري: ${ct.rentAmount.toLocaleString()} ر.س${arrears && arrears > 0 ? `\nالمتأخرات: ${amount} ر.س` : ''}\n\nنرجو التواصل لتسوية المستحقات.`;
  }
  return `Hello ${ct.name},\n\nOfficial reminder for unit ${ct.unitNumber}.\nMonthly rent: ${ct.rentAmount.toLocaleString()} SAR${arrears && arrears > 0 ? `\nArrears: ${amount} SAR` : ''}\n\nPlease contact us to settle dues.`;
}
