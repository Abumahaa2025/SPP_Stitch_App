import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { SmartEmployeeMark } from '@/src/components/SmartEmployeeMark';
import { GlassCard } from '@/src/components/GlassCard';
import { KOWIL_CAPABILITIES } from '@/src/data/kowil-capabilities';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';

type Props = { testID?: string };

/** Kowil × SPP welcome — العقار الذكي branding + capability highlights. */
export function KowilWelcomePanel({ testID }: Props) {
  const { t, isRTL } = useI18n();

  return (
    <View testID={testID}>
      <Animated.View entering={FadeInDown.duration(600)} style={styles.hero}>
        <LinearGradient
          colors={['rgba(212,175,95,0.18)', 'rgba(52,211,153,0.12)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <SmartEmployeeMark size={56} />
        <Text style={[styles.brandEyebrow, isRTL && styles.rtl]}>{t('kowil.welcome.eyebrow' as never)}</Text>
        <Text style={[styles.brandTitle, isRTL && styles.rtl]}>{t('kowil.welcome.title' as never)}</Text>
        <Text style={[styles.brandSub, isRTL && styles.rtl]}>{t('kowil.welcome.sub' as never)}</Text>
        <View style={[styles.trialPill, isRTL && styles.rtlRow]}>
          <Feather name="award" size={12} color={colors.gold} />
          <Text style={styles.trialText}>{t('kowil.welcome.trial' as never)}</Text>
        </View>
      </Animated.View>

      <Text style={[styles.featuresLabel, isRTL && styles.rtl]}>{t('kowil.welcome.features' as never)}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.featureRow}>
        {KOWIL_CAPABILITIES.map((cap, i) => (
          <Animated.View key={cap.id} entering={FadeInDown.duration(450).delay(80 + i * 40)}>
            <GlassCard padding={14} radiusToken="md" edge="neutral" style={styles.featureCard}>
              <Feather name={cap.icon} size={16} color={colors.gold} />
              <Text style={[styles.featureTitle, isRTL && styles.rtl]} numberOfLines={2}>
                {t(cap.titleKey as never)}
              </Text>
              <Text style={[styles.featureHint, isRTL && styles.rtl]} numberOfLines={3}>
                {t(cap.hintKey as never)}
              </Text>
            </GlassCard>
          </Animated.View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.goldEdge,
    marginBottom: spacing.md,
  },
  brandEyebrow: {
    color: colors.gold,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: spacing.md,
    fontWeight: typography.weight.semibold,
  },
  brandTitle: {
    color: colors.text,
    fontSize: 26,
    fontWeight: typography.weight.semibold,
    letterSpacing: -0.4,
    marginTop: 6,
    textAlign: 'center',
  },
  brandSub: {
    color: colors.textMuted,
    fontSize: 13.5,
    lineHeight: 21,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
  },
  trialPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.md,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.goldSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.goldEdge,
  },
  trialText: { color: colors.gold, fontSize: 11.5, fontWeight: typography.weight.semibold },
  featuresLabel: {
    color: colors.textMuted,
    fontSize: 10.5,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
    fontWeight: typography.weight.medium,
  },
  featureRow: { gap: 10, paddingBottom: 4 },
  featureCard: { width: 148, minHeight: 108 },
  featureTitle: { color: colors.text, fontSize: 12.5, fontWeight: typography.weight.semibold, marginTop: 8 },
  featureHint: { color: colors.textSubtle, fontSize: 10.5, lineHeight: 15, marginTop: 4 },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  rtlRow: { flexDirection: 'row-reverse' },
});
