/**
 * Domain — Building entity (Domain Model §5.2).
 * Pure types + invariants. No I/O, env, or UI.
 */

export type BuildingSharedServices = {
  elevator?: boolean;
  parking?: boolean;
  centralGas?: boolean;
  sharedMeters?: boolean;
};

export type BuildingRecord = {
  /** Stable identity within the property */
  id: string;
  propertyId: string;
  /** Owner-facing building label / number */
  name: string;
  floors?: number;
  unitCount?: number;
  sharedServices?: BuildingSharedServices;
  /** Who pays for shared consumption / cleaning */
  commonAreaResponsibility?: 'owner' | 'tenant' | 'shared';
  commissionedAt?: string;
};

/** Invariant: a unit belongs to at most one building. */
export function assertUnitBuildingAttachment(
  unitBuildingId: string | undefined,
  buildings: BuildingRecord[],
): boolean {
  if (!unitBuildingId) return true;
  return buildings.some((b) => b.id === unitBuildingId);
}

/** Invariant helper: building ids unique within a property. */
export function buildingIdsUnique(buildings: BuildingRecord[]): boolean {
  const seen = new Set<string>();
  for (const b of buildings) {
    if (seen.has(b.id)) return false;
    seen.add(b.id);
  }
  return true;
}

export function makeBuildingId(propertyId: string, index: number): string {
  return `bld_${propertyId}_${index + 1}`;
}
