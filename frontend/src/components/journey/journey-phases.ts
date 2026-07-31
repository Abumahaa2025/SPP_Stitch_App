import type { SetupPhaseId } from '@/src/types/property-os';

export const PHASE_EMOJI: Record<SetupPhaseId, string> = {
  property: '🏢',
  units: '🏠',
  tenants: '👤',
  contracts: '📄',
  alerts: '🔔',
  smartEmployee: '✨',
};

export const PHASE_INTRO: Record<Exclude<SetupPhaseId, 'smartEmployee'>, { titleKey: string; bodyKey: string }> = {
  property: { titleKey: 'journey.intro.property.title', bodyKey: 'journey.intro.property.body' },
  units: { titleKey: 'journey.intro.units.title', bodyKey: 'journey.intro.units.body' },
  tenants: { titleKey: 'journey.intro.tenants.title', bodyKey: 'journey.intro.tenants.body' },
  contracts: { titleKey: 'journey.intro.contracts.title', bodyKey: 'journey.intro.contracts.body' },
  alerts: { titleKey: 'journey.intro.alerts.title', bodyKey: 'journey.intro.alerts.body' },
};

export const PHASE_SUCCESS: Record<Exclude<SetupPhaseId, 'smartEmployee' | 'alerts'>, {
  titleKey: string;
  checklistKeys: string[];
  nextKey: string;
  nextPhase: SetupPhaseId;
}> = {
  property: {
    titleKey: 'journey.success.property.title',
    checklistKeys: ['journey.success.property.k1', 'journey.success.property.k2', 'journey.success.property.k3'],
    nextKey: 'journey.success.property.next',
    nextPhase: 'units',
  },
  units: {
    titleKey: 'journey.success.units.title',
    checklistKeys: ['journey.success.units.k1', 'journey.success.units.k2', 'journey.success.units.k3'],
    nextKey: 'journey.success.units.next',
    nextPhase: 'tenants',
  },
  tenants: {
    titleKey: 'journey.success.tenants.title',
    checklistKeys: ['journey.success.tenants.k1', 'journey.success.tenants.k2', 'journey.success.tenants.k3'],
    nextKey: 'journey.success.tenants.next',
    nextPhase: 'contracts',
  },
  contracts: {
    titleKey: 'journey.success.contracts.title',
    checklistKeys: ['journey.success.contracts.k1', 'journey.success.contracts.k2', 'journey.success.contracts.k3'],
    nextKey: 'journey.success.contracts.next',
    nextPhase: 'alerts',
  },
};

export const ALERTS_SUCCESS = {
  titleKey: 'journey.success.alerts.title',
  checklistKeys: ['journey.success.alerts.k1', 'journey.success.alerts.k2', 'journey.success.alerts.k3'],
  nextKey: 'journey.success.alerts.next',
  nextPhase: 'smartEmployee' as SetupPhaseId,
};

/** Progressive disclosure — only show completed + current + next phase. */
export function visiblePhases(phaseIndex: number, phases: { id: SetupPhaseId; complete: boolean }[]) {
  return (['property', 'units', 'tenants', 'contracts', 'alerts', 'smartEmployee'] as SetupPhaseId[]).filter((id, i) => {
    if (i <= phaseIndex + 1) return true;
    return phases.find((p) => p.id === id)?.complete;
  });
}
