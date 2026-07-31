import type { PropertyOSState } from '@/src/types/property-os';

const SETUP = '/setup/property-os';

/** Spec §5.5 — unready ops section opens short setup instead of empty screen. */
export function resolveOwnerOpsRoute(key: string, state: PropertyOSState, fallback: string): string {
  if (!state.property) return SETUP;
  if (key === 'units' && state.units.length === 0) return SETUP;
  if (key === 'tenants' && state.tenants.length === 0) return SETUP;
  if (key === 'contracts' && state.contracts.length === 0) return SETUP;
  if (key === 'payments' && !(state.paymentLedger?.length || state.tenants.length)) return SETUP;
  if (key === 'imports' && !state.lastImportBatchId && state.units.length === 0) return SETUP;
  if (key === 'wallet' && !state.property) return SETUP;
  return fallback;
}

/** Spec §5.5 — urgent counts on daily ops tiles (0 = hide badge). */
export function ownerOpsUrgentCount(key: string, state: PropertyOSState): number {
  const daysUntil = (iso: string) =>
    Math.round((new Date(iso).getTime() - Date.now()) / 86400000);

  switch (key) {
    case 'units':
      return state.units.filter((u) => u.status === 'vacant' || u.status === 'maintenance').length;
    case 'contracts':
      return state.contracts.filter((c) => {
        if (!/^\d{4}-\d{2}-\d{2}/.test(c.endDate || '')) return false;
        const d = daysUntil(c.endDate);
        return d >= 0 && d <= 30;
      }).length;
    case 'tenants':
      return Math.max(0, state.tenants.length - state.contracts.length);
    case 'payments':
      return (state.paymentLedger ?? []).filter((l) => (l.remaining ?? 0) > 0).length
        || (state.unitHistory ?? []).filter((h) => (h.lateAmount ?? 0) > 0).length;
    case 'maintenance':
      return state.units.filter((u) => u.status === 'maintenance').length;
    default:
      return 0;
  }
}
