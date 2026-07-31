import React from 'react';
import { LegalScreen } from '@/src/components/LegalScreen';
import { useI18n } from '@/src/i18n';

export default function Terms() {
  const { t } = useI18n();
  return (
    <LegalScreen
      testID="terms-screen"
      question={t('page.q.terms')}
      doc={{
        title: t('legal.terms.title'),
        sub: t('legal.terms.sub'),
        sections: [
          { h: t('legal.terms.s1.h'), p: t('legal.terms.s1.p') },
          { h: t('legal.terms.s2.h'), p: t('legal.terms.s2.p') },
          { h: t('legal.terms.s3.h'), p: t('legal.terms.s3.p') },
          { h: t('legal.terms.s4.h'), p: t('legal.terms.s4.p') },
          { h: t('legal.terms.s5.h'), p: t('legal.terms.s5.p') },
          { h: t('legal.terms.s6.h'), p: t('legal.terms.s6.p') },
          { h: t('legal.terms.s7.h'), p: t('legal.terms.s7.p') },
        ],
      }}
    />
  );
}
