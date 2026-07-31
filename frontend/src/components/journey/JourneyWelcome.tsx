import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { GlassCard } from '@/src/components/GlassCard';
import { BrandAnchor } from '@/src/components/BrandAnchor';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';

type Props = { onStart: () => void; testID?: string };

const CARDS = ['journey.welcome.card1', 'journey.welcome.card2', 'journey.welcome.card3'] as const;

export function JourneyWelcome({ onStart, testID = 'journey-welcome' }: Props) {
  const { t, isRTL } = useI18n();

  return (
    <View style={styles.wrap} testID={testID}>
      <BrandAnchor testID={`${testID}-brand`} />
      <Animated.View entering={FadeInDown.duration(600).delay(80)}>
        <GlassCard padding={28} radiusToken="lg" edge="gold">
          <Text style={[styles.title, isRTL && styles.rtl]}>{t('journey.welcome.title')}</Text>
          <Text style={[styles.lead, isRTL && styles.rtl]}>{t('journey.welcome.lead')}</Text>
          <View style={styles.cards}>
            {CARDS.map((key, i) => (
              <View key={key} style={[styles.cardRow, isRTL && styles.rowRtl]}>
                <Text style={styles.check}>✓</Text>
                <Text style={[styles.cardText, isRTL && styles.rtl]}>{t(key)}</Text>
              </View>
            ))}
          </View>
          <Pressable
            style={styles.cta}
            testID={`${testID}-start`}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onStart(); }}
          >
            <Text style={styles.ctaText}>{t('journey.welcome.start')}</Text>
          </Pressable>
        </GlassCard>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', gap: spacing.xl, paddingVertical: spacing['2xl'] },
  title: {
    color: colors.text, fontSize: 26, fontWeight: typography.weight.semibold,
    textAlign: 'center', letterSpacing: typography.letter.tight,
  },
  lead: {
    color: colors.textDim, fontSize: 15, lineHeight: 24, marginTop: 12, textAlign: 'center',
  },
  cards: { marginTop: spacing.lg, gap: 10 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowRtl: { flexDirection: 'row-reverse' },
  check: { color: colors.emerald, fontSize: 16, fontWeight: typography.weight.bold },
  cardText: { color: colors.text, fontSize: 15, flex: 1 },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  cta: {
    marginTop: spacing.xl, backgroundColor: colors.emerald, borderRadius: radius.md,
    paddingVertical: 16, alignItems: 'center',
  },
  ctaText: { color: colors.bg, fontSize: 16, fontWeight: typography.weight.semibold },
});
