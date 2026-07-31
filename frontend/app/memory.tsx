import React, { useEffect, useState } from 'react';
import { RefreshControl } from 'react-native';
import { colors } from '@/src/theme';

import { ScreenScaffold } from '@/src/components/ScreenScaffold';
import { StoryScreenHeader } from '@/src/components/StoryScreenHeader';
import { PortfolioMemoryCard } from '@/src/components/PortfolioMemoryCard';
import { api } from '@/src/api/client';
import type { PortfolioMemory } from '@/src/api/intelligence';
import { useI18n } from '@/src/i18n';

export default function MemoryScreen() {
  const { t } = useI18n();
  const [memory, setMemory] = useState<PortfolioMemory | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      setMemory(await api.portfolioMemory());
    } catch {
      setMemory(null);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <ScreenScaffold
      testID="memory-screen"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.gold} />
      }
    >
      <StoryScreenHeader question={t('page.q.memory')} hint={t('memory.sub')} showBack testID="memory-header" />
      <PortfolioMemoryCard memory={memory} delay={80} expanded />
    </ScreenScaffold>
  );
}
