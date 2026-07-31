import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { GlassCard } from '@/src/components/GlassCard';
import { colors, spacing, typography } from '@/src/theme';
import { useI18n } from '@/src/i18n';
import { usePropertyOS } from '@/src/hooks/usePropertyOS';
import { useNotificationPrefs } from '@/src/hooks/usePreferences';
import { buildSetupInsights } from '@/src/utils/property-os-insights';
import type { Briefing } from '@/src/api/client';

type Props = { briefing?: Briefing | null; testID?: string };

/** Smart employee insights from guided setup data + briefing. */
export function SmartEmployeeSetupInsights({ briefing = null, testID = 'pos-insights' }: Props) {
  const { t, isRTL } = useI18n();
  const router = useRouter();
  const { countEnabled } = useNotificationPrefs();
  const { state, isFullyReady, ready } = usePropertyOS(countEnabled);

  if (!ready || !state.property) return null;

  const insights = buildSetupInsights(state, briefing, (k) => t(k as Parameters<typeof t>[0]));
  if (!insights.length) return null;

  return (
    <Animated.View entering={FadeInDown.duration(550).delay(100)} style={{ marginTop: spacing.lg }}>
      <GlassCard padding={20} radiusToken="lg" edge={isFullyReady ? 'emerald' : 'gold'} testID={testID}>
        <Text style={[styles.title, isRTL && styles.rtl]}>{t('pos.insights.title')}</Text>
        <View style={{ marginTop: 12, gap: 10 }}>
          {insights.map((ins, i) => (
            <Pressable
              key={ins.id}
              onPress={() => {
                if (ins.actionRoute) {
                  Haptics.selectionAsync();
                  router.push(ins.actionRoute as any);
                }
              }}
              style={[styles.row, isRTL && styles.rowRtl]}
            >
              <View style={[
                styles.dot,
                ins.priority === 'high' && styles.dotHigh,
                ins.priority === 'medium' && styles.dotMed,
              ]}
              />
              <Text style={[styles.text, isRTL && styles.rtl]}>{ins.text}</Text>
            </Pressable>
          ))}
        </View>
      </GlassCard>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 15, fontWeight: typography.weight.semibold },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  rowRtl: { flexDirection: 'row-reverse' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  dot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: colors.textSubtle, marginTop: 7,
  },
  dotHigh: { backgroundColor: colors.danger },
  dotMed: { backgroundColor: colors.gold },
  text: { flex: 1, color: colors.textDim, fontSize: 13.5, lineHeight: 21 },
});
