import React from 'react';
import { LegalScreen } from '@/src/components/LegalScreen';
import { useI18n } from '@/src/i18n';

export default function Privacy() {
  const { t } = useI18n();
  return (
    <LegalScreen
      testID="privacy-screen"
      question={t('page.q.privacy')}
      doc={{
        title: t('legal.privacy.title'),
        sub: t('legal.privacy.sub'),
        sections: [
          { h: t('legal.privacy.s1.h'), p: t('legal.privacy.s1.p') },
          { h: t('legal.privacy.s2.h'), p: t('legal.privacy.s2.p') },
          { h: t('legal.privacy.s3.h'), p: t('legal.privacy.s3.p') },
          { h: t('legal.privacy.s4.h'), p: t('legal.privacy.s4.p') },
          { h: t('legal.privacy.s5.h'), p: t('legal.privacy.s5.p') },
          { h: t('legal.privacy.s6.h'), p: t('legal.privacy.s6.p') },
        ],
      }}
    />
  );
}
