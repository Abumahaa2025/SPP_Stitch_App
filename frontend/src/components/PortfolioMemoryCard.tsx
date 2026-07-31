import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { GlassCard } from '@/src/components/GlassCard';
import { EmptyState } from '@/src/components/EmptyState';
import { AliveEmpty } from '@/src/components/AliveEmpty';
import type { PortfolioMemory } from '@/src/api/intelligence';
import { assetExperience } from '@/src/utils/memory-voice';
import { colors, spacing, typography } from '@/src/theme';
import { useI18n } from '@/src/i18n';

type Props = {
  memory: PortfolioMemory | null;
  delay?: number;
  testID?: string;
  expanded?: boolean;
};

export function PortfolioMemoryCard({ memory, delay = 80, testID = 'portfolio-memory-card', expanded }: Props) {
  const { t, lang, isRTL } = useI18n();

  if (memory === null) {
    return (
      <Animated.View entering={FadeInDown.duration(650).delay(delay)} style={{ marginTop: spacing.md }}>
        <EmptyState orb title={t('memory.loadingVoice')} testID={testID} />
      </Animated.View>
    );
  }

  const { assets } = memory;
  const topRisk = assets
    .slice()
    .sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      return (order[a.risk] ?? 9) - (order[b.risk] ?? 9) || b.fault_count - a.fault_count;
    })
    .slice(0, expanded ? 12 : 3);

  if (topRisk.length === 0) {
    return (
      <Animated.View entering={FadeInDown.duration(650).delay(delay)} style={{ marginTop: spacing.md }}>
        <GlassCard padding={22} radiusToken="lg" edge="emerald" testID={testID}>
          <AliveEmpty title={t('alive.memory.title')} body={t('alive.memory.body')} />
        </GlassCard>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeInDown.duration(650).delay(delay)} style={{ marginTop: spacing.md }}>
      <GlassCard padding={24} radiusToken="lg" edge="emerald" testID={testID}>
        <View style={{ gap: 18 }}>
          {topRisk.map((asset, i) => (
            <Animated.View
              key={asset.asset_id}
              entering={FadeInDown.duration(500).delay(delay + i * 60)}
              style={styles.experienceRow}
            >
              <View style={styles.quoteMark}>
                <Text style={styles.quoteChar}>“</Text>
              </View>
              <Text style={[styles.experience, isRTL && styles.rtl]}>
                {assetExperience(asset, lang)}
              </Text>
            </Animated.View>
          ))}
        </View>
      </GlassCard>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  experienceRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  quoteMark: { width: 20, alignItems: 'center' },
  quoteChar: { color: colors.emerald, fontSize: 28, lineHeight: 28, marginTop: -4 },
  experience: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    lineHeight: 26,
    fontWeight: typography.weight.medium,
  },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
});
