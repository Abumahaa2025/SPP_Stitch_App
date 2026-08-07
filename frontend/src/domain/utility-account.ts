/**
 * Domain — UtilityAccount standing entity (Domain Model §5.20 / §9).
 * Pure types + invariants. No I/O, env, or UI.
 */

export type UtilityKind = 'electricity' | 'water';
export type UtilityResponsibleParty = 'tenant' | 'owner' | 'included';

export type UtilityAccountRecord = {
  id: string;
  utilityKind: UtilityKind;
  accountNumber: string;
  meterNumber?: string;
  /** Serves a unit and/or building (at least one should be set when linked). */
  unitId?: string;
  buildingId?: string;
  propertyId?: string;
  responsibleParty: UtilityResponsibleParty;
  provider?: string;
  currentBalance?: number;
  dueDate?: string;
  paymentChannel?: string;
  createdAt: string;
  updatedAt: string;
  status: 'linked' | 'billing' | 'due' | 'overdue' | 'settled' | 'transferred' | 'closed';
};

/** Invariant: responsibility resolved before reminders (caller enforces send path). */
export function responsibilityResolved(account: UtilityAccountRecord): boolean {
  return Boolean(account.responsibleParty);
}

/** Invariant: account must serve a unit or building when fully linked. */
export function hasServiceTarget(account: UtilityAccountRecord): boolean {
  return Boolean(account.unitId || account.buildingId);
}
