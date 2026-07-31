import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AgreementPulse } from '@/src/components/AgreementPulse';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';

type Props = {
  children: React.ReactNode;
  lead?: string;
};

/** Visual command-deck frame for Hub — layout polish only. */
export function HubDashboardShell({ children, lead }: Props) {
  const { t, isRTL } = useI18n();

  return (
    <View testID="hub-dashboard-shell">
      <Animated.View entering={FadeInDown.duration(480)}>
        <LinearGradient
          colors={['rgba(212,175,55,0.16)', 'rgba(6,11,20,0.4)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={[styles.heroRow, isRTL && styles.rowRtl]}>
            <AgreementPulse size={7} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.heroEyebrow, isRTL && styles.rtl]}>{t('hub.deck.eyebrow')}</Text>
              <Text style={[styles.heroTitle, isRTL && styles.rtl]}>{t('hub.deck.title')}</Text>
            </View>
          </View>
          {lead ? (
            <Text style={[styles.heroLead, isRTL && styles.rtl]} numberOfLines={2}>
              {lead}
            </Text>
          ) : null}
          <View style={styles.heroRule} />
        </LinearGradient>
      </Animated.View>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    marginHorizontal: -4,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderRadius: radius.lg,
  },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowRtl: { flexDirection: 'row-reverse' },
  heroEyebrow: {
    color: colors.gold,
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontWeight: typography.weight.medium,
  },
  heroTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: typography.weight.semibold,
    letterSpacing: typography.letter.tight,
    marginTop: 2,
  },
  heroLead: {
    color: colors.textDim,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 10,
  },
  heroRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderGold,
    marginTop: 14,
  },
  body: { gap: 2 },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
});
