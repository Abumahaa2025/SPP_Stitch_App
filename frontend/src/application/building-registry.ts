/**
 * Application — Building registry helpers for Property OS.
 * Syncs first-class buildings with legacy buildingCount (backward compatible).
 * Does not rename Smart Import columns or Sheets identities.
 */
import {
  type BuildingRecord,
  makeBuildingId,
  buildingIdsUnique,
} from '@/src/domain/building';

export type BuildingSyncInput = {
  propertyId: string;
  buildingCount: number;
  existing?: BuildingRecord[];
};

/**
 * Ensure N building identities exist for the property.
 * Preserves existing ids/names when possible; never deletes historical attachment ids
 * beyond trimming surplus empty buildings when count shrinks.
 */
export function ensureBuildingsForProperty(input: BuildingSyncInput): BuildingRecord[] {
  const count = Math.max(0, Math.floor(input.buildingCount || 0));
  const prev = [...(input.existing || [])];
  const next: BuildingRecord[] = [];

  for (let i = 0; i < count; i += 1) {
    const existing = prev[i];
    if (existing) {
      next.push({
        ...existing,
        propertyId: input.propertyId,
        name: existing.name || String(i + 1),
      });
    } else {
      next.push({
        id: makeBuildingId(input.propertyId, i),
        propertyId: input.propertyId,
        name: String(i + 1),
        unitCount: 0,
      });
    }
  }

  if (!buildingIdsUnique(next)) {
    // Repair duplicate ids without inventing sheet columns.
    return next.map((b, i) => ({
      ...b,
      id: makeBuildingId(input.propertyId, i),
    }));
  }
  return next;
}

/** Derive legacy count from first-class buildings (or fall back). */
export function buildingCountFromRegistry(
  buildings: BuildingRecord[] | undefined,
  fallbackCount: number,
): number {
  if (buildings && buildings.length > 0) return buildings.length;
  return Math.max(0, fallbackCount || 0);
}

/**
 * Attach a unit to a building when buildings exist and unit has no buildingId.
 * Default: first building. Does not reassign if already set.
 */
export function attachUnitToDefaultBuilding(
  unitBuildingId: string | undefined,
  buildings: BuildingRecord[],
): string | undefined {
  if (unitBuildingId) return unitBuildingId;
  return buildings[0]?.id;
}
