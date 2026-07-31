import React from 'react';

import { JourneyGuide } from '@/src/components/JourneyGuide';
import { PHASE_INTRO, PHASE_SUCCESS } from '@/src/components/journey/journey-phases';
import { useI18n } from '@/src/i18n';
import type { SetupPhaseId } from '@/src/types/property-os';

type Props = {
  phase: SetupPhaseId;
  testID?: string;
};

/** Four journey answers for a setup phase — reuses existing copy keys. */
export function PhaseJourneyGuide({ phase, testID }: Props) {
  const { t } = useI18n();

  if (phase === 'smartEmployee') {
    return (
      <JourneyGuide
        where={t('pos.phase.operations' as any)}
        now={t('journey.intro.smartEmployee.body' as any)}
        benefit={t('journey.intro.smartEmployee.title' as any)}
        next={t('journey.launch.ask' as any)}
        testID={testID ?? 'phase-journey-smart'}
      />
    );
  }

  const intro = PHASE_INTRO[phase];
  const nextKey = phase in PHASE_SUCCESS
    ? PHASE_SUCCESS[phase as keyof typeof PHASE_SUCCESS].nextKey
    : 'pos.progress.done';

  return (
    <JourneyGuide
      where={t(`pos.phase.${phase}` as 'pos.phase.property')}
      now={t(intro.bodyKey as any)}
      benefit={t(intro.titleKey as any)}
      next={t(nextKey as any)}
      testID={testID ?? `phase-journey-${phase}`}
    />
  );
}
