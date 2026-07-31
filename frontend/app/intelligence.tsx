import React, { useEffect, useState } from 'react';
import { RefreshControl } from 'react-native';
import { colors } from '@/src/theme';

import { ScreenScaffold } from '@/src/components/ScreenScaffold';
import { StoryScreenHeader } from '@/src/components/StoryScreenHeader';
import { IntelligenceInsightsSection } from '@/src/components/IntelligenceInsightsSection';
import { api } from '@/src/api/client';
import type { IntelligenceInsight } from '@/src/api/intelligence';
import { useI18n } from '@/src/i18n';

export default function IntelligenceScreen() {
  const { t } = useI18n();
  const [insights, setInsights] = useState<IntelligenceInsight[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const r = await api.intelligence();
      setInsights(r.insights);
    } catch {
      setInsights([]);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <ScreenScaffold
      testID="intelligence-screen"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.gold} />
      }
    >
      <StoryScreenHeader question={t('page.q.insights')} hint={t('intelligence.sub')} showBack testID="intelligence-header" />
      <IntelligenceInsightsSection insights={insights} delay={80} prominent />
    </ScreenScaffold>
  );
}
