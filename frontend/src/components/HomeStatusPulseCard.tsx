import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { GlassCard } from '@/src/components/GlassCard';
import { AppIcon } from '@/src/components/ui/AppIcon';
import { AgreementPulse } from '@/src/components/AgreementPulse';
import type { Briefing, NotifT } from '@/src/api/client';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';

type Props = {
  briefing: Briefing | null;
  notifications: NotifT[];
  testID?: string;
};

/** Top-of-home status strip — display only, derived from existing briefing data. */
export function HomeStatusPulseCard({ briefing, notifications, testID = 'home-status-pulse' }: Props) {
  const { t, isRTL } = useI18n();

  const alertCount = notifications.length;
  const topDecision = briefing?.decisions?.[0];
  const topAction = topDecision?.title ?? briefing?.headline ?? t('home.status.noAction');
  const isLive = Boolean(briefing && (briefing.properties_count > 0 || briefing.decisions.length > 0));

  return (
    <Animated.View entering={FadeInDown.duration(520).delay(20)} style={styles.wrap} testID={testID}>
      <GlassCard padding={0} radiusToken="lg" edge="gold" bright>
        <LinearGradient
          colors={['rgba(212,175,55,0.14)', 'rgba(80,200,120,0.08)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          <View style={[styles.inner, isRTL && styles.innerRtl]}>
            <View style={[styles.statusCol, isRTL && styles.colRtl]}>
              <View style={[styles.statusHead, isRTL && styles.rowRtl]}>
                <AgreementPulse size={6} />
                <Text style={[styles.eyebrow, isRTL && styles.rtl]}>{t('home.status.eyebrow')}</Text>
              </View>
              <Text style={[styles.statusValue, isRTL && styles.rtl]}>
                {isLive ? t('home.status.live') : t('home.status.ready')}
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={[styles.metricCol, isRTL && styles.colRtl]}>
              <View style={[styles.metricHead, isRTL && styles.rowRtl]}>
                <AppIcon name="bell" size="sm" accent="gold" />
                <Text style={[styles.metricLabel, isRTL && styles.rtl]}>{t('home.status.alerts')}</Text>
              </View>
              <Text style={styles.metricValue}>{alertCount}</Text>
            </View>

            <View style={styles.divider} />

            <View style={[styles.actionCol, isRTL && styles.colRtl]}>
              <View style={[styles.metricHead, isRTL && styles.rowRtl]}>
                <AppIcon name="zap" size="sm" accent="emerald" />
                <Text style={[styles.metricLabel, isRTL && styles.rtl]}>{t('home.status.today')}</Text>
              </View>
              <Text style={[styles.actionText, isRTL && styles.rtl]} numberOfLines={2}>
                {topAction}
              </Text>
            </View>
          </View>
        </LinearGradient>
      </GlassCard>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  gradient: { borderRadius: radius.lg, overflow: 'hidden' },
  inner: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingVertical: 16,
    paddingHorizontal: 14,
    gap: 10,
  },
  innerRtl: { flexDirection: 'row-reverse' },
  statusCol: { flex: 1.1, justifyContent: 'center', gap: 6 },
  metricCol: { flex: 0.7, justifyContent: 'center', gap: 4, alignItems: 'center' },
  actionCol: { flex: 1.4, justifyContent: 'center', gap: 4 },
  colRtl: { alignItems: 'flex-end' },
  statusHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowRtl: { flexDirection: 'row-reverse' },
  eyebrow: {
    color: colors.textMuted,
    fontSize: 9,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    fontWeight: typography.weight.medium,
  },
  statusValue: {
    color: colors.emerald,
    fontSize: 12,
    fontWeight: typography.weight.semibold,
    letterSpacing: 0.2,
  },
  metricHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metricLabel: {
    color: colors.textMuted,
    fontSize: 9,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontWeight: typography.weight.medium,
  },
  metricValue: {
    color: colors.gold,
    fontSize: 22,
    fontWeight: typography.weight.semibold,
    fontVariant: ['tabular-nums'],
  },
  actionText: {
    color: colors.text,
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: typography.weight.medium,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderStrong,
    marginVertical: 4,
  },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
});
