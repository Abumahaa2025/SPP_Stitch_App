import { useCallback, useEffect, useMemo, useState } from 'react';
import { storage } from '@/src/utils/storage';
import type {
  ContractRecord,
  PaymentRecord,
  PropertyOSState,
  PropertyRecord,
  SetupPhaseId,
  SetupPhaseProgress,
  TenantRecord,
  UnitHistoryEntry,
  UnitRecord,
} from '@/src/types/property-os';
import {
  onContractEnded,
  onPaymentRecorded,
  onSetupCompleted,
  onTenantAdded,
} from '@/src/utils/operational-flow-engine';

const KEY = 'spp.propertyOS';

const DEFAULT: PropertyOSState = {
  property: null,
  units: [],
  tenants: [],
  contracts: [],
  alertsEnabled: false,
  technicianPortalToken: '',
  dismissedProgress: false,
  setupCompleted: false,
  unitHistory: [],
  payments: [],
};

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function portalBase() {
  return 'https://spp.beta/portal';
}

export function buildTenantPortal(tenantId: string, token: string) {
  const url = `${portalBase()}/tenant/${tenantId}?t=${token}`;
  return { url, qrData: url, token };
}

export function buildTechnicianPortal(token: string) {
  return `${portalBase()}/tech?t=${token}`;
}

export function buildWhatsAppWelcome(name: string, portalUrl: string, lang: 'ar' | 'en') {
  if (lang === 'ar') {
    return `مرحبًا ${name} 👋\n\nتم تفعيل بوابة المستأجر في SPP.\n\nرابطك الخاص:\n${portalUrl}\n\nيمكنك من خلالها:\n• عرض عقدك\n• طلب صيانة\n• متابعة البلاغات\n• استلام التنبيهات`;
  }
  return `Welcome ${name} 👋\n\nYour SPP tenant portal is ready.\n\nYour link:\n${portalUrl}\n\nYou can:\n• View your contract\n• Request maintenance\n• Track tickets\n• Receive alerts`;
}

function calcPhaseProgress(state: PropertyOSState, notifCount: number): SetupPhaseProgress[] {
  const targetUnits = Math.max(1, state.property?.unitCount ?? 1);
  const unitsPct = state.property
    ? Math.min(100, Math.round((state.units.length / targetUnits) * 100))
    : 0;
  const tenantsTarget = state.units.filter((u) => u.status === 'occupied').length || state.units.length || 1;
  const tenantsPct = state.units.length
    ? Math.min(100, Math.round((state.tenants.length / Math.max(1, tenantsTarget)) * 100))
    : 0;
  const contractsTarget = state.tenants.length || 1;
  const contractsPct = state.tenants.length
    ? Math.min(100, Math.round((state.contracts.length / contractsTarget) * 100))
    : 0;
  const alertsPct = state.alertsEnabled || notifCount >= 3 ? 100 : notifCount > 0 ? 40 : 0;

  const propertyComplete = Boolean(
    state.property?.name && state.property.city && state.property.unitCount > 0,
  );
  const unitsComplete = unitsPct >= 100 && state.units.length > 0;
  const tenantsComplete = tenantsPct >= 100 && state.tenants.length > 0;
  const contractsComplete = contractsPct >= 100 && state.contracts.length > 0;
  const alertsComplete = alertsPct >= 100;
  const smartComplete = propertyComplete && unitsComplete && tenantsComplete && contractsComplete && alertsComplete;

  const phases: Omit<SetupPhaseProgress, 'current'>[] = [
    { id: 'property', percent: propertyComplete ? 100 : state.property ? 60 : 0, complete: propertyComplete },
    { id: 'units', percent: unitsComplete ? 100 : unitsPct, complete: unitsComplete },
    { id: 'tenants', percent: tenantsComplete ? 100 : tenantsPct, complete: tenantsComplete },
    { id: 'contracts', percent: contractsComplete ? 100 : contractsPct, complete: contractsComplete },
    { id: 'alerts', percent: alertsComplete ? 100 : alertsPct, complete: alertsComplete },
    { id: 'smartEmployee', percent: smartComplete ? 100 : 0, complete: smartComplete },
  ];

  const firstIncomplete = phases.find((p) => !p.complete)?.id ?? 'smartEmployee';
  return phases.map((p) => ({ ...p, current: p.id === firstIncomplete }));
}

export function usePropertyOS(notifEnabledCount = 0) {
  const [state, setState] = useState<PropertyOSState>(DEFAULT);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const stored = await storage.getItem<string>(KEY, '');
      if (stored) {
        try {
          setState({ ...DEFAULT, ...JSON.parse(stored) });
        } catch { /* ignore */ }
      }
      setReady(true);
    })();
  }, []);

  const persist = useCallback((next: PropertyOSState) => {
    setState(next);
    storage.setItem(KEY, JSON.stringify(next));
  }, []);

  /** Re-read after upload Apply (other screens write spp.propertyOS). */
  const reload = useCallback(async () => {
    const stored = await storage.getItem<string>(KEY, '');
    if (!stored) return;
    try {
      setState({ ...DEFAULT, ...JSON.parse(stored) });
    } catch { /* ignore */ }
  }, []);

  const phases = useMemo(
    () => calcPhaseProgress(state, notifEnabledCount),
    [state, notifEnabledCount],
  );

  const overallPercent = useMemo(() => {
    const sum = phases.reduce((s, p) => s + p.percent, 0);
    return Math.round(sum / phases.length);
  }, [phases]);

  const nextPhase = useMemo(
    () => phases.find((p) => !p.complete)?.id ?? null,
    [phases],
  );

  const isFullyReady = phases.every((p) => p.complete);

  const saveProperty = useCallback((input: Omit<PropertyRecord, 'id' | 'createdAt'>) => {
    const property: PropertyRecord = {
      ...input,
      id: state.property?.id ?? uid('prop'),
      createdAt: state.property?.createdAt ?? new Date().toISOString(),
    };
    persist({
      ...state,
      property,
      startedAt: state.startedAt ?? new Date().toISOString(),
    });
    return property;
  }, [persist, state]);

  const addUnit = useCallback((input: Omit<UnitRecord, 'id' | 'propertyId'>) => {
    if (!state.property) return null;
    const unit: UnitRecord = {
      ...input,
      id: uid('unit'),
      propertyId: state.property.id,
    };
    persist({ ...state, units: [...state.units, unit] });
    return unit;
  }, [persist, state]);

  const addTenant = useCallback((
    input: Omit<TenantRecord, 'id' | 'portalToken' | 'portalUrl' | 'qrData' | 'whatsAppMessage'>,
    lang: 'ar' | 'en',
  ) => {
    const id = uid('tenant');
    const token = uid('tok').slice(-12);
    const portal = buildTenantPortal(id, token);
    const tenant: TenantRecord = {
      ...input,
      id,
      portalToken: portal.token,
      portalUrl: portal.url,
      qrData: portal.qrData,
      whatsAppMessage: buildWhatsAppWelcome(input.name, portal.url, lang),
    };
    persist({ ...state, tenants: [...state.tenants, tenant] });
    const unit = state.units.find((u) => u.id === input.unitId);
    void onTenantAdded(tenant, unit?.number);
    return tenant;
  }, [persist, state]);

  const addContract = useCallback((input: Omit<ContractRecord, 'id'>) => {
    const contract: ContractRecord = { ...input, id: uid('contract') };
    persist({ ...state, contracts: [...state.contracts, contract] });
    return contract;
  }, [persist, state]);

  const enableAlerts = useCallback(() => {
    persist({ ...state, alertsEnabled: true });
  }, [persist, state]);

  const ensureTechnicianPortal = useCallback(() => {
    const token = state.technicianPortalToken || uid('tech').slice(-12);
    if (!state.technicianPortalToken) {
      persist({ ...state, technicianPortalToken: token });
    }
    return buildTechnicianPortal(token);
  }, [persist, state]);

  const dismissProgress = useCallback(() => {
    persist({ ...state, dismissedProgress: true });
  }, [persist, state]);

  const resetProgressDismiss = useCallback(() => {
    persist({ ...state, dismissedProgress: false });
  }, [persist, state]);

  const markSetupComplete = useCallback(() => {
    persist({
      ...state,
      setupCompleted: true,
      dismissedProgress: true,
    });
    void onSetupCompleted();
  }, [persist, state]);

  const endContract = useCallback((contractId: string, unitId: string, tenant: TenantRecord) => {
    const contract = state.contracts.find((c) => c.id === contractId);
    const historyEntry: UnitHistoryEntry = {
      unitId,
      tenantName: tenant.name,
      lateAmount: 0,
      followUpCount: 0,
      note: contract ? `Contract ${contract.number} ended` : undefined,
      endedAt: new Date().toISOString(),
    };
    const unit = state.units.find((u) => u.id === unitId);
    persist({
      ...state,
      contracts: state.contracts.filter((c) => c.id !== contractId),
      units: state.units.map((u) => (u.id === unitId ? { ...u, status: 'vacant' as const } : u)),
      unitHistory: [...(state.unitHistory ?? []), historyEntry],
    });
    void onContractEnded(state, tenant, unit?.number);
  }, [persist, state]);

  const recordPayment = useCallback((unitId: string, tenantId: string, amount: number) => {
    const payment: PaymentRecord = {
      id: uid('pay'),
      unitId,
      tenantId,
      amount,
      paidAt: new Date().toISOString(),
    };
    const next: PropertyOSState = {
      ...state,
      payments: [...(state.payments ?? []), payment],
    };
    persist(next);
    void onPaymentRecorded(next, payment);
  }, [persist, state]);

  const reopenSetup = useCallback(() => {
    persist({ ...state, setupCompleted: false, dismissedProgress: false });
  }, [persist, state]);

  return {
    state,
    ready,
    reload,
    phases,
    overallPercent,
    nextPhase,
    isFullyReady,
    saveProperty,
    addUnit,
    addTenant,
    addContract,
    enableAlerts,
    ensureTechnicianPortal,
    dismissProgress,
    resetProgressDismiss,
    markSetupComplete,
    endContract,
    recordPayment,
    reopenSetup,
  };
}

export function phaseRoute(phase: SetupPhaseId): string {
  return `/setup/property-os?phase=${phase}`;
}
