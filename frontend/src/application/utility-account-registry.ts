/**
 * Application — UtilityAccount registry helpers (Domain Model §5.20).
 * Builds standing accounts from unit meter intent without inventing Sheets columns.
 */
import type { UtilityAccountRecord, UtilityKind } from '@/src/domain/utility-account';
import { hasServiceTarget, responsibilityResolved } from '@/src/domain/utility-account';

export type UnitMeterSeed = {
  unitId: string;
  propertyId?: string;
  buildingId?: string;
  electricityMeter?: string;
  waterMeter?: string;
  electricityResponsibility?: 'tenant' | 'owner' | 'included';
  waterResponsibility?: 'tenant' | 'owner' | 'included';
};

function stableAccountId(kind: UtilityKind, unitId: string, meterOrAccount: string): string {
  const key = `${kind}:${unitId}:${meterOrAccount}`.replace(/\s+/g, '');
  return `ua_${key}`;
}

/** Upsert standing utility accounts from unit meter fields (local Property OS). */
export function upsertAccountsFromUnitMeters(
  existing: UtilityAccountRecord[],
  seed: UnitMeterSeed,
  nowIso: string,
): UtilityAccountRecord[] {
  const byId = new Map(existing.map((a) => [a.id, a]));

  const upsert = (
    kind: UtilityKind,
    meter: string | undefined,
    responsible: 'tenant' | 'owner' | 'included' | undefined,
  ) => {
    const meterNumber = String(meter || '').trim();
    if (!meterNumber) return;
    const id = stableAccountId(kind, seed.unitId, meterNumber);
    const prev = byId.get(id);
    const next: UtilityAccountRecord = {
      id,
      utilityKind: kind,
      accountNumber: prev?.accountNumber || meterNumber,
      meterNumber,
      unitId: seed.unitId,
      buildingId: seed.buildingId || prev?.buildingId,
      propertyId: seed.propertyId || prev?.propertyId,
      responsibleParty: responsible || prev?.responsibleParty || 'tenant',
      provider: prev?.provider,
      currentBalance: prev?.currentBalance,
      dueDate: prev?.dueDate,
      paymentChannel: prev?.paymentChannel,
      createdAt: prev?.createdAt || nowIso,
      updatedAt: nowIso,
      status: prev?.status || 'linked',
    };
    if (!responsibilityResolved(next) || !hasServiceTarget(next)) {
      return;
    }
    byId.set(id, next);
  };

  upsert('electricity', seed.electricityMeter, seed.electricityResponsibility);
  upsert('water', seed.waterMeter, seed.waterResponsibility);

  return Array.from(byId.values());
}
