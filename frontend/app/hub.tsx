import React from 'react';
import { ScreenScaffold } from '@/src/components/ScreenScaffold';
import { StoryScreenHeader } from '@/src/components/StoryScreenHeader';
import { MoreMenu } from '@/src/components/MoreMenu';
import { useI18n } from '@/src/i18n';

export default function Hub() {
  const { t } = useI18n();

  return (
    <ScreenScaffold testID="hub-screen">
      <StoryScreenHeader
        question={t('more.title')}
        hint={t('more.sub')}
        testID="hub-header"
      />
      <MoreMenu />
    </ScreenScaffold>
  );
}
