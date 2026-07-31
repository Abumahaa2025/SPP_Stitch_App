import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, {
  FadeInDown, useSharedValue, useAnimatedStyle,
  withRepeat, withTiming, Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { GlassCard } from './GlassCard';
import type { VerdictT } from '../api/client';
import { fetchExecutiveCached } from '../api/executive-cache';
import { buildVerdictCache, resolveExecutiveVerdict } from '../api/executive-map';
import { colors, spacing, typography, radius } from '../theme';
import { useI18n } from '../i18n';

type Props = {
  /** Screen key: 'portfolio' | 'health' | 'property-{id}' | ... */
  screen: string;
  /** Local fallback only when /api/executive is unreachable. */
  fallback?: VerdictT;
  /** Cached bag of verdicts to avoid re-fetching on every mount. */
  cache?: Record<string, VerdictT | null>;
  onLoaded?: (bag: Record<string, VerdictT | null>) => void;
};

/**
 * The Brain — speaking on every surface with one voice.
 * All recommendations come from GET /api/executive only.
 */
export function BrainVerdict({ screen, fallback, cache, onLoaded }: Props) {
  const router = useRouter();
  const { t } = useI18n();
  const [verdict, setVerdict] = useState<VerdictT | null>(
    cache?.[screen] ?? fallback ?? null,
  );

  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
      -1, true,
    );
  }, [pulse]);

  useEffect(() => {
    if (cache?.[screen]) { setVerdict(cache[screen]); return; }
    let alive = true;
    fetchExecutiveCached()
      .then((exec) => {
        if (!alive) return;
        const bag = buildVerdictCache(exec);
        const fromExec = resolveExecutiveVerdict(exec, screen) ?? bag[screen] ?? fallback ?? null;
        setVerdict(fromExec);
        onLoaded?.({ ...bag, [screen]: fromExec });
      })
      .catch(() => {
        if (!alive) return;
        if (fallback) setVerdict(fallback);
      });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  const halo = useAnimatedStyle(() => ({
    opacity: 0.4 + pulse.value * 0.55,
    transform: [{ scale: 1 + pulse.value * 0.7 }],
  }));

  if (!verdict) return null;

  return (
    <Animated.View entering={FadeInDown.duration(600)}>
      <GlassCard
        padding={22}
        radiusToken="lg"
        edge="emerald"
        bright
        testID={`brain-verdict-${screen}`}
        style={{ marginBottom: spacing.lg }}
      >
        <View style={styles.topRow}>
          <View style={styles.dotWrap}>
            <Animated.View style={[styles.halo, halo]} />
            <View style={styles.dot} />
          </View>
          <Text style={styles.eyebrow}>{t('brain.verdict.eyebrow')}</Text>
        </View>

        <Text style={styles.headline}>{verdict.headline}</Text>

        <View style={styles.whyRow}>
          <View style={styles.whyBar} />
          <Text style={styles.why}>{verdict.why}</Text>
        </View>

        <Pressable
          testID={`brain-verdict-cta-${screen}`}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push(verdict.route as any);
          }}
          style={({ pressed }) => [
            styles.cta,
            pressed && { opacity: 0.85, transform: [{ scale: 0.995 }] },
          ]}
        >
          <Text style={styles.ctaText}>{verdict.action}</Text>
          <Feather name="arrow-right" size={14} color={colors.gold} />
        </Pressable>
      </GlassCard>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dotWrap: {
    width: 12, height: 12, alignItems: 'center', justifyContent: 'center',
  },
  halo: {
    position: 'absolute', width: 12, height: 12, borderRadius: 6,
    backgroundColor: colors.emerald,
  },
  dot: {
    width: 5, height: 5, borderRadius: 3,
    backgroundColor: colors.emerald,
  },
  eyebrow: {
    color: colors.emerald,
    fontSize: 10.5,
    letterSpacing: 1.8,
    fontWeight: typography.weight.medium,
  },
  headline: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: typography.weight.semibold,
    letterSpacing: -0.35,
    marginTop: spacing.md,
  },
  whyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: spacing.sm + 2,
  },
  whyBar: {
    width: 2, height: 14, borderRadius: 1,
    backgroundColor: colors.gold, opacity: 0.85, marginTop: 3,
  },
  why: {
    flex: 1,
    color: colors.textDim,
    fontSize: 13,
    lineHeight: 20,
    letterSpacing: -0.05,
  },
  cta: {
    marginTop: spacing.md,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.goldEdge,
    backgroundColor: colors.goldSoft,
  },
  ctaText: {
    color: colors.gold,
    fontSize: 12.5,
    letterSpacing: 0.2,
    fontWeight: typography.weight.medium,
  },
});
