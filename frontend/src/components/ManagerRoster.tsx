import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { ManagerCard } from '@/src/components/ManagerCard';
import type { ManagerDef } from '@/src/data/managers';
import { proactiveForManager } from '@/src/utils/manager-voice';
import type { Briefing } from '@/src/api/client';
import type { IntelligenceInsight, PortfolioMemory } from '@/src/api/intelligence';
import { colors, spacing, typography } from '@/src/theme';
import { useI18n } from '@/src/i18n';

type Props = {
  managers: ManagerDef[];
  briefing: Briefing | null;
  insights: IntelligenceInsight[];
  memory: PortfolioMemory | null;
  titleKey?: string;
  subKey?: string;
  compact?: boolean;
  testID?: string;
};

export function ManagerRoster({
  managers,
  briefing,
  insights,
  memory,
  titleKey = 'os.team.title',
  subKey = 'os.team.sub',
  compact,
  testID = 'manager-roster',
}: Props) {
  const { t, isRTL } = useI18n();

  return (
    <View style={styles.wrap} testID={testID}>
      <Text style={[styles.title, isRTL && styles.rtl]}>{t(titleKey as 'os.team.title')}</Text>
      <Text style={[styles.sub, isRTL && styles.rtl]}>{t(subKey as 'os.team.sub')}</Text>
      <View style={styles.list}>
        {managers.map((m, i) => (
          <ManagerCard
            key={m.key}
            manager={m}
            proactive={proactiveForManager(m.key, (k) => t(k as Parameters<typeof t>[0]), briefing, insights, memory)}
            delay={60 + i * 50}
            compact={compact}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing['2xl'] },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: typography.weight.semibold,
    letterSpacing: typography.letter.tight,
  },
  sub: {
    color: colors.textDim,
    fontSize: 14,
    lineHeight: 22,
    marginTop: 6,
    marginBottom: spacing.lg,
  },
  list: { gap: spacing.md },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
});
