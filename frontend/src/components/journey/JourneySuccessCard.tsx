import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { GlassCard } from '@/src/components/GlassCard';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';

type Props = {
  titleKey: string;
  checklistKeys: string[];
  nextKey: string;
  onContinue: () => void;
  testID?: string;
};

/** Post-phase success — what was saved + next step. */
export function JourneySuccessCard({
  titleKey, checklistKeys, nextKey, onContinue, testID = 'journey-success',
}: Props) {
  const { t, isRTL } = useI18n();

  return (
    <Animated.View entering={FadeInDown.duration(550)} testID={testID}>
      <GlassCard padding={24} radiusToken="lg" edge="emerald">
        <Text style={styles.emoji}>🎉</Text>
        <Text style={[styles.title, isRTL && styles.rtl]}>{t(titleKey as any)}</Text>
        <Text style={[styles.sub, isRTL && styles.rtl]}>{t('journey.what')}</Text>
        {checklistKeys.map((k) => (
          <Text key={k} style={[styles.check, isRTL && styles.rtl]}>✓ {t(k as any)}</Text>
        ))}
        <View style={styles.nextBox}>
          <Text style={[styles.nextLabel, isRTL && styles.rtl]}>{t('journey.next')}</Text>
          <Text style={[styles.nextText, isRTL && styles.rtl]}>{t(nextKey as any)}</Text>
        </View>
        <Pressable
          style={styles.cta}
          testID={`${testID}-continue`}
          onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); onContinue(); }}
        >
          <Text style={styles.ctaText}>{t('journey.continue')}</Text>
        </Pressable>
      </GlassCard>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  emoji: { fontSize: 36, marginBottom: spacing.sm },
  title: {
    color: colors.text, fontSize: 20, fontWeight: typography.weight.semibold,
  },
  sub: {
    color: colors.textMuted, fontSize: 11, letterSpacing: 0.8,
    textTransform: 'uppercase', marginTop: spacing.md, marginBottom: 8,
  },
  check: { color: colors.text, fontSize: 14, lineHeight: 24, marginTop: 4 },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  nextBox: {
    marginTop: spacing.lg, padding: 12, borderRadius: radius.md,
    backgroundColor: colors.goldSoft, borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.goldEdge,
  },
  nextLabel: {
    color: colors.gold, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase',
    fontWeight: typography.weight.semibold,
  },
  nextText: { color: colors.text, fontSize: 14, marginTop: 4, fontWeight: typography.weight.medium },
  cta: {
    marginTop: spacing.lg, backgroundColor: colors.gold, borderRadius: radius.md,
    paddingVertical: 14, alignItems: 'center',
  },
  ctaText: { color: colors.bg, fontSize: 15, fontWeight: typography.weight.semibold },
});
