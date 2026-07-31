import React from 'react';
import { ScreenScaffold } from '@/src/components/ScreenScaffold';
import { StoryScreenHeader } from '@/src/components/StoryScreenHeader';
import { ServiceActivationPanel } from '@/src/components/ServiceActivationPanel';
import { OperationHint } from '@/src/components/OperationHint';
import { useI18n } from '@/src/i18n';

export default function ServiceActivationScreen() {
  const { t } = useI18n();

  return (
    <ScreenScaffold testID="services-activation">
      <StoryScreenHeader
        question={t('op.services.title')}
        hint={t('op.services.sub')}
        showBack
        testID="services-header"
      />
      <OperationHint feature="services" />
      <ServiceActivationPanel />
    </ScreenScaffold>
  );
}
