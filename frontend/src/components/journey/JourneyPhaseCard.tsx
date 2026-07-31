import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { GlassCard } from '@/src/components/GlassCard';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';

type Props = {
  emoji: string;
  titleKey: string;
  bodyKey: string;
  benefitKey?: string;
  whereLabel?: string;
  onStart: () => void;
  testID?: string;
};

/** Pre-phase intro — answers where / what / benefit before the form. */
export function JourneyPhaseCard({
  emoji, titleKey, bodyKey, benefitKey, whereLabel, onStart, testID = 'journey-phase-intro',
}: Props) {
  const { t, isRTL } = useI18n();

  return (
    <Animated.View entering={FadeInDown.duration(500)} testID={testID}>
      <GlassCard padding={22} radiusToken="lg" edge="gold">
        <Text style={styles.emoji}>{emoji}</Text>
        {whereLabel ? (
          <Text style={[styles.where, isRTL && styles.rtl]}>{whereLabel}</Text>
        ) : null}
        <Text style={[styles.title, isRTL && styles.rtl]}>{t(titleKey as any)}</Text>
        <Text style={[styles.body, isRTL && styles.rtl]}>{t(bodyKey as any)}</Text>
        {benefitKey ? (
          <View style={styles.benefitBox}>
            <Text style={[styles.benefitLabel, isRTL && styles.rtl]}>{t('journey.benefit')}</Text>
            <Text style={[styles.benefitText, isRTL && styles.rtl]}>{t(benefitKey as any)}</Text>
          </View>
        ) : null}
        <Pressable
          style={styles.cta}
          testID={`${testID}-start`}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onStart(); }}
        >
          <Text style={styles.ctaText}>{t('journey.start')}</Text>
        </Pressable>
      </GlassCard>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  emoji: { fontSize: 32, marginBottom: spacing.sm },
  where: {
    color: colors.textMuted, fontSize: 10, letterSpacing: 1.2,
    textTransform: 'uppercase', marginBottom: 6,
  },
  title: {
    color: colors.text, fontSize: 20, fontWeight: typography.weight.semibold,
    letterSpacing: typography.letter.tight,
  },
  body: { color: colors.textDim, fontSize: 14, lineHeight: 22, marginTop: 10 },
  benefitBox: {
    marginTop: spacing.md, padding: 12, borderRadius: radius.md,
    backgroundColor: colors.emeraldSoft, borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.emeraldEdge,
  },
  benefitLabel: {
    color: colors.emerald, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase',
    fontWeight: typography.weight.semibold,
  },
  benefitText: { color: colors.text, fontSize: 13, lineHeight: 20, marginTop: 4 },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  cta: {
    marginTop: spacing.lg, backgroundColor: colors.emerald, borderRadius: radius.md,
    paddingVertical: 14, alignItems: 'center',
  },
  ctaText: { color: colors.bg, fontSize: 15, fontWeight: typography.weight.semibold },
});
