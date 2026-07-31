import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { GlassCard } from '@/src/components/GlassCard';
import { AppIcon } from '@/src/components/ui/AppIcon';
import type { SmartDecision } from '@/src/api/portfolio-analysis';
import { colors, spacing, typography } from '@/src/theme';
import { useI18n } from '@/src/i18n';

const PRIORITY_COLOR = {
  critical: colors.danger,
  high: colors.gold,
  medium: colors.info,
  low: colors.textMuted,
} as const;

type Props = { decisions: SmartDecision[]; delay?: number };

/** Phase 4 — smart employee decisions after analysis. */
export function UploadSmartDecisions({ decisions, delay = 280 }: Props) {
  const { t, isRTL } = useI18n();

  return (
    <Animated.View entering={FadeInDown.duration(550).delay(delay)} style={styles.wrap}>
      <View style={[styles.head, isRTL && styles.rowRtl]}>
        <AppIcon name="cpu" size="md" accent="gold" />
        <Text style={[styles.title, isRTL && styles.rtl]}>{t('upload.phase.decisions')}</Text>
      </View>
      {decisions.map((d, i) => (
        <Animated.View key={d.id} entering={FadeInDown.duration(450).delay(delay + 60 + i * 40)}>
          <GlassCard
            padding={16}
            radiusToken="md"
            edge={d.priority === 'critical' ? 'gold' : 'neutral'}
            style={styles.card}
          >
            <View style={[styles.row, isRTL && styles.rowRtl]}>
              <View style={[styles.dot, { backgroundColor: PRIORITY_COLOR[d.priority] }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.decTitle, isRTL && styles.rtl]}>{d.title}</Text>
                <Text style={[styles.decAction, isRTL && styles.rtl]}>{d.action}</Text>
              </View>
            </View>
          </GlassCard>
        </Animated.View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.lg },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: spacing.sm },
  rowRtl: { flexDirection: 'row-reverse' },
  title: { color: colors.text, fontSize: 16, fontWeight: typography.weight.semibold },
  card: { marginBottom: spacing.sm },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 6 },
  decTitle: { color: colors.text, fontSize: 14, lineHeight: 21, fontWeight: typography.weight.medium },
  decAction: { color: colors.gold, fontSize: 12, marginTop: 6 },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
});
