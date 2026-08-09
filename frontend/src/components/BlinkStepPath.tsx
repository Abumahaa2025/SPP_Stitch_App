/**
 * BlinkStepPath — organized step path with a blinking marker on the active step.
 * Reuses GlassCard + theme tokens; no identity redesign.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

import { GlassCard } from '@/src/components/GlassCard';
import type { TenantOpsStep } from '@/src/types/tenant-ops-journey';
import { colors, spacing, typography } from '@/src/theme';
import { useI18n } from '@/src/i18n';
import { formatDate } from '@/src/utils/locale';

type Props = {
  title: string;
  steps: TenantOpsStep[];
  testID?: string;
};

export function BlinkStepPath({ title, steps, testID = 'blink-step-path' }: Props) {
  const { isRTL, lang } = useI18n();
  const ar = lang === 'ar' || !!isRTL;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.25, duration: 550, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 550, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <GlassCard padding={16} radiusToken="md" edge="emerald" testID={testID}>
      <Text style={[styles.title, isRTL && styles.rtl]}>{title}</Text>
      <View style={{ marginTop: spacing.sm }}>
        {steps.map((step, i) => {
          const label = ar ? step.labelAr : step.labelEn;
          const detail = ar ? step.detailAr : step.detailEn;
          const active = step.status === 'active';
          const done = step.status === 'done';
          return (
            <View key={step.id} style={{ marginBottom: i < steps.length - 1 ? 4 : 0 }}>
              <View style={[styles.row, isRTL && styles.rowRtl]}>
                {active ? (
                  <Animated.View style={[styles.dotActive, { opacity: pulse }]} />
                ) : (
                  <View style={[styles.dot, done ? styles.dotDone : styles.dotPending]} />
                )}
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.step,
                      isRTL && styles.rtl,
                      done && styles.stepDone,
                      active && styles.stepActive,
                    ]}
                  >
                    {done ? '✓ ' : active ? '◉ ' : '○ '}
                    {label}
                  </Text>
                  {detail ? (
                    <Text style={[styles.detail, isRTL && styles.rtl]}>{detail}</Text>
                  ) : null}
                  {step.at ? (
                    <Text style={[styles.time, isRTL && styles.rtl]}>{formatDate(step.at)}</Text>
                  ) : null}
                </View>
              </View>
              {i < steps.length - 1 ? <View style={[styles.line, isRTL && styles.lineRtl]} /> : null}
            </View>
          );
        })}
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: typography.weight.semibold,
    letterSpacing: 0.4,
  },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  rowRtl: { flexDirection: 'row-reverse' },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  dotDone: { backgroundColor: colors.emerald },
  dotPending: { backgroundColor: colors.textSubtle },
  dotActive: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 3,
    backgroundColor: colors.gold,
    shadowColor: colors.gold,
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  step: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  stepDone: { color: colors.text },
  stepActive: { color: colors.gold, fontWeight: typography.weight.semibold },
  detail: { color: colors.textDim, fontSize: 11, marginTop: 2 },
  time: { color: colors.textSubtle, fontSize: 10, marginTop: 2 },
  line: {
    width: 2,
    height: 12,
    backgroundColor: colors.border,
    marginLeft: 4,
    marginVertical: 2,
  },
  lineRtl: { marginLeft: 0, marginRight: 4, alignSelf: 'flex-end' },
});
