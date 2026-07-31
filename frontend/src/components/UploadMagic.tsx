import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  FadeIn, FadeInDown, useSharedValue, useAnimatedStyle,
  withRepeat, withTiming, Easing,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { GlassCard } from '@/src/components/GlassCard';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';

const PHASE_KEYS = ['receiving', 'reading', 'understanding', 'connecting', 'thinking'] as const;

type Props = {
  step: number;
  done: boolean;
};

function PulseOrb() {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [p]);
  const halo = useAnimatedStyle(() => ({
    opacity: 0.25 + p.value * 0.45,
    transform: [{ scale: 1 + p.value * 0.35 }],
  }));
  return (
    <View style={orbStyles.wrap}>
      <Animated.View style={[orbStyles.halo, halo]} />
      <View style={orbStyles.core} />
    </View>
  );
}

const orbStyles = StyleSheet.create({
  wrap: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  halo: {
    position: 'absolute', width: 48, height: 48, borderRadius: 24,
    backgroundColor: colors.gold,
  },
  core: {
    width: 14, height: 14, borderRadius: 7, backgroundColor: colors.gold,
  },
});

export function UploadMagic({ step, done }: Props) {
  const { t, isRTL } = useI18n();

  useEffect(() => {
    if (done) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [done]);

  const activeIdx = done ? PHASE_KEYS.length : Math.min(PHASE_KEYS.length - 1, Math.max(0, step - 2));

  return (
    <Animated.View entering={FadeInDown.duration(500)} style={styles.wrap} testID="upload-magic">
      <GlassCard padding={28} radiusToken="lg" edge="gold">
        <View style={styles.center}>
          {done ? (
            <Animated.View entering={FadeIn.duration(400)} style={styles.doneIcon}>
              <Feather name="check" size={28} color={colors.emerald} />
            </Animated.View>
          ) : (
            <PulseOrb />
          )}
        </View>

        <Text style={[styles.status, isRTL && styles.rtl]}>
          {done ? t('upload.magic.found') : t(`upload.magic.${PHASE_KEYS[activeIdx]}`)}
        </Text>

        <View style={styles.phases}>
          {PHASE_KEYS.map((key, i) => {
            const complete = done || i < activeIdx;
            const current = !done && i === activeIdx;
            return (
              <Animated.View
                key={key}
                entering={FadeIn.duration(300).delay(i * 60)}
                style={[styles.phaseRow, current && styles.phaseCurrent]}
              >
                <View style={[styles.phaseDot, complete && styles.phaseDone, current && styles.phaseActive]}>
                  {complete ? <Feather name="check" size={10} color={colors.bg} /> : null}
                </View>
                <Text style={[
                  styles.phaseText,
                  isRTL && styles.rtl,
                  complete && styles.phaseTextDone,
                  current && styles.phaseTextActive,
                ]}>
                  {t(`upload.magic.${key}`)}
                </Text>
              </Animated.View>
            );
          })}
        </View>
      </GlassCard>
    </Animated.View>
  );
}

export function UploadFoundHeader() {
  const { t, isRTL } = useI18n();
  return (
    <Animated.View entering={FadeInDown.duration(600).springify()} style={styles.foundWrap} testID="upload-found-header">
      <View style={styles.foundRow}>
        <View style={styles.foundCheck}>
          <Feather name="check" size={18} color={colors.emerald} />
        </View>
        <Text style={[styles.foundTitle, isRTL && styles.rtl]}>{t('upload.magic.found')}</Text>
      </View>
      <Text style={[styles.foundSub, isRTL && styles.rtl]}>{t('upload.magic.foundSub')}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.xl },
  center: { alignItems: 'center', marginBottom: spacing.lg },
  doneIcon: {
    width: 56, height: 56, borderRadius: 28,
    borderWidth: 1.5, borderColor: colors.emeraldEdge,
    backgroundColor: colors.emeraldSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  status: {
    color: colors.text,
    fontSize: 18,
    fontWeight: typography.weight.semibold,
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: spacing.lg,
  },
  phases: { gap: 6 },
  phaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: radius.sm,
  },
  phaseCurrent: { backgroundColor: 'rgba(212,175,55,0.06)' },
  phaseDot: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  phaseDone: { backgroundColor: colors.emerald, borderColor: colors.emerald },
  phaseActive: { borderColor: colors.gold, backgroundColor: colors.goldSoft },
  phaseText: { flex: 1, color: colors.textSubtle, fontSize: 14, lineHeight: 20 },
  phaseTextDone: { color: colors.textMuted },
  phaseTextActive: { color: colors.text, fontWeight: typography.weight.medium },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  foundWrap: { marginTop: spacing['2xl'], marginBottom: spacing.md },
  foundRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  foundCheck: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.emeraldEdge,
    backgroundColor: colors.emeraldSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  foundTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: typography.weight.semibold,
    letterSpacing: typography.letter.tight,
    flex: 1,
  },
  foundSub: { color: colors.textDim, fontSize: 14, lineHeight: 22, marginTop: 8, marginLeft: 48 },
});
