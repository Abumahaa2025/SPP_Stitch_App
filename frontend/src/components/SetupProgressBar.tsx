import React, { useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { GlassCard } from '@/src/components/GlassCard';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';
import { phaseRoute, usePropertyOS } from '@/src/hooks/usePropertyOS';
import type { SetupPhaseId } from '@/src/types/property-os';
import { useNotificationPrefs } from '@/src/hooks/usePreferences';

type Props = {
  compact?: boolean;
  testID?: string;
};

/** Visible setup journey for owners — alerts stay in calc, shown as “Go live”. */
const PHASE_ORDER: SetupPhaseId[] = [
  'property', 'units', 'tenants', 'contracts', 'smartEmployee',
];

function phaseLabelKey(id: SetupPhaseId) {
  if (id === 'smartEmployee') return 'pos.phase.operations' as const;
  return `pos.phase.${id}` as const;
}

/** Persistent setup progress — visible until fully ready or dismissed. */
export function SetupProgressBar({ compact = false, testID = 'setup-progress' }: Props) {
  const { t, isRTL } = useI18n();
  const router = useRouter();
  const { countEnabled } = useNotificationPrefs();
  const { phases, overallPercent, nextPhase, isFullyReady, state, dismissProgress, markSetupComplete, ready, reload } = usePropertyOS(countEnabled);

  // Bug-fix: re-read PropertyOS on focus — after upload Apply (which persists
  // setupCompleted) the wizard/17% must not reappear on stale state.
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  useEffect(() => {
    if (ready && isFullyReady && !state.setupCompleted) {
      markSetupComplete();
    }
  }, [ready, isFullyReady, state.setupCompleted, markSetupComplete]);

  if (!ready || state.setupCompleted || state.dismissedProgress) return null;

  const nextLabel = nextPhase
    ? t(phaseLabelKey(nextPhase === 'alerts' ? 'smartEmployee' : nextPhase))
    : t('pos.phase.operations' as any);

  const goNext = () => {
    Haptics.selectionAsync();
    router.push((nextPhase ? phaseRoute(nextPhase) : '/setup/property-os') as any);
  };

  return (
    <Animated.View entering={FadeInDown.duration(500)} style={{ marginBottom: spacing.md }}>
      <GlassCard padding={compact ? 14 : 18} radiusToken="lg" edge="gold" testID={testID}>
        <View style={[styles.head, isRTL && styles.rowRtl]}>
          <Feather name="layers" size={14} color={colors.gold} />
          <Text style={[styles.title, isRTL && styles.rtl]}>{t('pos.progress.title')}</Text>
          <Text style={styles.pct}>{overallPercent}%</Text>
        </View>

        <Text style={[styles.sub, isRTL && styles.rtl]}>
          {t('pos.progress.overall').replace('{pct}', String(overallPercent)).replace('{next}', nextLabel)}
        </Text>

        {nextPhase ? (
          <Text style={[styles.nextHint, isRTL && styles.rtl]}>
            {t('pos.progress.nextLine' as any).replace('{next}', nextLabel)}
          </Text>
        ) : (
          <Text style={[styles.nextHint, isRTL && styles.rtl]}>{t('pos.progress.done' as any)}</Text>
        )}

        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${overallPercent}%` }]} />
        </View>

        {!compact ? (
          <View style={styles.phaseList}>
            {PHASE_ORDER.map((id) => {
              const phase = phases.find((p) => p.id === id);
              if (!phase) return null;
              const icon = phase.complete ? 'check-circle' : phase.current ? 'clock' : 'circle';
              const iconColor = phase.complete ? colors.emerald : phase.current ? colors.gold : colors.textSubtle;
              return (
                <View key={id} style={[styles.phaseRow, isRTL && styles.rowRtl]}>
                  <Feather name={icon as 'check-circle'} size={13} color={iconColor} />
                  <Text style={[styles.phaseLabel, isRTL && styles.rtl, phase.current && styles.phaseCurrent]}>
                    {phase.complete ? '✅ ' : phase.current ? '⏳ ' : '○ '}
                    {t(phaseLabelKey(id))}
                  </Text>
                  <Text style={styles.phasePct}>{phase.percent}%</Text>
                </View>
              );
            })}
          </View>
        ) : null}

        <View style={[styles.actions, isRTL && styles.rowRtl]}>
          <Pressable style={styles.primary} onPress={goNext} testID={`${testID}-continue`}>
            <Text style={styles.primaryText}>{t('pos.progress.continue')}</Text>
            <Feather name="arrow-right" size={13} color={colors.bg} />
          </Pressable>
          <Pressable onPress={dismissProgress} hitSlop={8} testID={`${testID}-dismiss`}>
            <Text style={styles.dismiss}>{t('pos.progress.dismiss')}</Text>
          </Pressable>
        </View>
      </GlassCard>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowRtl: { flexDirection: 'row-reverse' },
  title: { flex: 1, color: colors.text, fontSize: 13, fontWeight: typography.weight.semibold },
  pct: { color: colors.gold, fontSize: 12, fontWeight: typography.weight.semibold, fontVariant: ['tabular-nums'] },
  sub: { color: colors.textDim, fontSize: 12, lineHeight: 18, marginTop: 8 },
  nextHint: { color: colors.gold, fontSize: 12, lineHeight: 18, marginTop: 6, fontWeight: typography.weight.medium },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  barTrack: {
    height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)',
    marginTop: 12, overflow: 'hidden',
  },
  barFill: { height: '100%', backgroundColor: colors.gold, borderRadius: 2 },
  phaseList: { marginTop: 14, gap: 8 },
  phaseRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  phaseLabel: { flex: 1, color: colors.textMuted, fontSize: 12 },
  phaseCurrent: { color: colors.text, fontWeight: typography.weight.medium },
  phasePct: { color: colors.textSubtle, fontSize: 11, fontVariant: ['tabular-nums'] },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, gap: 12 },
  primary: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.emerald, borderRadius: radius.md,
    paddingVertical: 10, paddingHorizontal: 14,
  },
  primaryText: { color: colors.bg, fontSize: 12.5, fontWeight: typography.weight.semibold },
  dismiss: { color: colors.textMuted, fontSize: 11.5 },
});
