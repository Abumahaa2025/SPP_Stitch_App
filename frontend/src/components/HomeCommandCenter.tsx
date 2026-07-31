import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { GlassCard } from '@/src/components/GlassCard';
import { SmartEmployeeMark } from '@/src/components/SmartEmployeeMark';
import { PendingApprovalsPanel } from '@/src/components/PendingApprovalsPanel';
import { useAttentionPulse } from '@/src/hooks/useAttentionPulse';
import type { Briefing, DecisionT, NotifT } from '@/src/api/client';
import { formatNotification } from '@/src/utils/format-notification';
import { usePropertyOS } from '@/src/hooks/usePropertyOS';
import { useOperational } from '@/src/hooks/useOperational';
import { useNotificationPrefs } from '@/src/hooks/usePreferences';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';
import { phaseRoute } from '@/src/hooks/usePropertyOS';
import { ActionButton } from '@/src/components/ActionButton';

type Props = {
  briefing: Briefing | null;
  notifications: NotifT[];
};

function decisionRoute(d: DecisionT): string {
  if (d.kind === 'maintenance') return '/maintenance';
  if (d.kind === 'financial') return '/billing';
  if (d.kind === 'tenant') return '/contracts';
  return '/brain';
}

function greetingKey(): 'opsv2.home.goodMorning' | 'journey.home.greetingAfternoon' | 'journey.home.greetingEvening' {
  const h = new Date().getHours();
  if (h < 12) return 'opsv2.home.goodMorning';
  if (h < 17) return 'journey.home.greetingAfternoon';
  return 'journey.home.greetingEvening';
}

/** Daily work center — greeting, smart employee voice, today items, value signals. */
export function HomeCommandCenter({ briefing, notifications }: Props) {
  const { t, isRTL } = useI18n();
  const router = useRouter();
  const { countEnabled } = useNotificationPrefs();
  const { state: osState, isFullyReady, ready, nextPhase, reload } = usePropertyOS(countEnabled);
  const { openTickets, pendingActions, recentEvents } = useOperational();
  const { acknowledge } = useAttentionPulse();

  // Bug-fix: refresh PropertyOS on focus so post-Apply data shows immediately.
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const dailyMode = Boolean(osState.setupCompleted && osState.property);
  const lastDecision = briefing?.decisions?.[0];
  const expiring = briefing?.expiring_contracts ?? 0;
  const lateDecision = briefing?.decisions?.find((d) => d.kind === 'financial');
  const lastNotif = notifications[0];

  const employeeLines = useMemo(() => {
    const lines: string[] = [t('opsv2.employee.reviewed' as any)];
    if (expiring > 0 || osState.contracts.some((c) => {
      const end = new Date(c.endDate).getTime();
      return end - Date.now() < 1000 * 60 * 60 * 24 * 45;
    })) {
      lines.push(t('opsv2.employee.contractRenew' as any));
      lines.push(t('opsv2.employee.suggestReminder' as any));
    }
    if (openTickets.length) lines.push(t('opsv2.employee.ticketFollow' as any));
    if (pendingActions.length) lines.push(t('opsv2.employee.approvalWaiting' as any));
    return lines;
  }, [expiring, osState.contracts, openTickets, pendingActions, t]);

  const valueSignals = useMemo(() => {
    const items: string[] = [];
    if (osState.alertsEnabled) items.push(t('opsv2.value.alerts' as any));
    if ((osState.payments?.length ?? 0) > 0) items.push(t('opsv2.value.wallet' as any));
    if (osState.contracts.length) items.push(t('opsv2.value.contracts' as any));
    if (openTickets.length) items.push(t('opsv2.value.ticket' as any));
    if (recentEvents.length && !items.length) {
      items.push(t('opsv2.value.contracts' as any));
    }
    return items.slice(0, 3);
  }, [osState, openTickets, recentEvents, t]);

  const todayItems = useMemo(() => {
    const items: { key: string; label: string; body: string; route: string }[] = [];
    if (expiring > 0 || osState.contracts.some((c) => {
      const end = new Date(c.endDate).getTime();
      return end - Date.now() < 1000 * 60 * 60 * 24 * 45;
    })) {
      items.push({
        key: 'contract',
        label: t('opsv2.home.contractSoon' as any),
        body: t('journey.home.tap'),
        route: '/contracts',
      });
    }
    if (lateDecision) {
      items.push({
        key: 'late',
        label: t('opsv2.home.tenantLate' as any),
        body: lateDecision.title,
        route: decisionRoute(lateDecision),
      });
    }
    if (openTickets.length) {
      items.push({
        key: 'ticket',
        label: t('opsv2.home.newTicket' as any),
        body: openTickets[0].title,
        route: '/maintenance',
      });
    }
    if (pendingActions.length) {
      items.push({
        key: 'approval',
        label: t('opsv2.home.pendingApproval' as any),
        body: t(pendingActions[0].labelKey as any),
        route: '/brain',
      });
    }
    const stepBody = lastDecision?.title
      ?? (lastNotif
        ? formatNotification(lastNotif, (k) => t(k as Parameters<typeof t>[0])).headline
        : dailyMode ? t('home.daily.nextOps') : t('home.daily.nextSetup'));
    items.push({
      key: 'step',
      label: t('opsv2.home.nextStep' as any),
      body: stepBody,
      route: lastDecision ? decisionRoute(lastDecision) : dailyMode ? '/owner' : '/setup/property-os',
    });
    return items.slice(0, 5);
  }, [expiring, osState.contracts, lateDecision, openTickets, pendingActions, lastDecision, lastNotif, dailyMode, t]);

  const goAssistant = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/brain');
  };

  /**
   * Figma UX reorg — unify setup CTA into SetupProgressBar only.
   * Show this amber card only when the progress bar is dismissed (still incomplete).
   */
  const incomplete =
    ready && !dailyMode && !isFullyReady && Boolean(osState.dismissedProgress);

  return (
    <View testID="home-command-center">
      {incomplete ? (
        <Animated.View entering={FadeInDown.duration(450)} style={styles.incompleteWrap} testID="home-incomplete-cta">
          <GlassCard padding={16} radiusToken="md" edge="gold">
            <Text style={[styles.incompleteTitle, isRTL && styles.rtl]}>
              {t('home.incomplete.title' as any)}
            </Text>
            <Text style={[styles.incompleteBody, isRTL && styles.rtl]}>
              {!osState.property
                ? t('journey.home.nextSetup' as any)
                : t('pos.progress.nextLine' as any).replace(
                  '{next}',
                  nextPhase
                    ? t(
                      (nextPhase === 'alerts' || nextPhase === 'smartEmployee'
                        ? 'pos.phase.operations'
                        : `pos.phase.${nextPhase}`) as any,
                    )
                    : t('pos.phase.operations' as any),
                )}
            </Text>
            <ActionButton
              testID="home-incomplete-action"
              label={t('pos.progress.continue')}
              onPress={() => {
                Haptics.selectionAsync();
                router.push((nextPhase ? phaseRoute(nextPhase) : '/setup/property-os') as any);
              }}
              style={{ marginTop: 12 }}
            />
          </GlassCard>
        </Animated.View>
      ) : null}

      <Animated.View entering={FadeInDown.duration(550).delay(20)}>
        <Pressable onPress={goAssistant} testID="home-assistant-hero">
          <GlassCard padding={0} radiusToken="lg" edge="gold">
            <LinearGradient
              colors={['rgba(212,175,55,0.18)', 'rgba(80,200,120,0.12)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.assistantGrad}
            >
              <View style={[styles.assistantRow, isRTL && styles.rowRtl]}>
                <SmartEmployeeMark size={64} />
                <View style={styles.assistantText}>
                  <Text style={[styles.greeting, isRTL && styles.rtl]}>{t(greetingKey() as any)}</Text>
                  {employeeLines.map((line, i) => (
                    <Text key={i} style={[styles.employeeLine, isRTL && styles.rtl]} numberOfLines={2}>
                      {i === 0 ? '' : '› '}{line}
                    </Text>
                  ))}
                  <View style={[styles.assistantCta, isRTL && styles.rowRtl]}>
                    <Text style={styles.assistantCtaText}>{t('home.daily.assistantCta')}</Text>
                    <Feather name="mic" size={14} color={colors.gold} />
                  </View>
                </View>
              </View>
            </LinearGradient>
          </GlassCard>
        </Pressable>
      </Animated.View>

      {valueSignals.length ? (
        <Animated.View entering={FadeInDown.duration(450).delay(50)} style={styles.valueWrap}>
          {valueSignals.map((v, i) => (
            <View key={i} style={styles.valueChip}>
              <Text style={styles.valueCheck}>✓</Text>
              <Text style={[styles.valueText, isRTL && styles.rtl]}>{v}</Text>
            </View>
          ))}
        </Animated.View>
      ) : null}

      <Animated.View entering={FadeInDown.duration(500).delay(80)} style={styles.todayWrap}>
        <Text style={[styles.todayTitle, isRTL && styles.rtl]}>{t('journey.home.today')}</Text>
        {todayItems.map((item, i) => (
          <Pressable
            key={item.key}
            onPress={() => { Haptics.selectionAsync(); router.push(item.route as any); }}
            style={({ pressed }) => pressed && { opacity: 0.88 }}
            testID={`home-today-${item.key}`}
          >
            <GlassCard padding={16} radiusToken="md" edge={i === todayItems.length - 1 ? 'gold' : 'neutral'} style={styles.todayCard}>
              <View style={[styles.todayRow, isRTL && styles.rowRtl]}>
                <Text style={styles.todayCheck}>✓</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.todayLabel, isRTL && styles.rtl]}>{item.label}</Text>
                  <Text style={[styles.todayBody, isRTL && styles.rtl]} numberOfLines={2}>{item.body}</Text>
                </View>
                <Feather name="chevron-right" size={16} color={colors.textMuted} />
              </View>
            </GlassCard>
          </Pressable>
        ))}
      </Animated.View>

      {dailyMode ? (
        <PendingApprovalsPanel onAction={() => { void acknowledge(); }} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  incompleteWrap: { marginBottom: spacing.md },
  incompleteTitle: {
    color: colors.text, fontSize: typography.body, fontWeight: typography.weight.semibold,
  },
  incompleteBody: { color: colors.textDim, fontSize: typography.small, lineHeight: 20, marginTop: 6 },
  assistantGrad: { borderRadius: radius.lg, padding: 22 },
  assistantRow: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  rowRtl: { flexDirection: 'row-reverse' },
  assistantText: { flex: 1, gap: 4 },
  greeting: {
    color: colors.gold, fontSize: 15, fontWeight: typography.weight.semibold,
    letterSpacing: 0.3, marginBottom: 4,
  },
  employeeLine: {
    color: colors.textDim, fontSize: typography.small, lineHeight: 20,
  },
  assistantCta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  assistantCtaText: { color: colors.gold, fontSize: typography.small, fontWeight: typography.weight.semibold },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  valueWrap: { marginTop: spacing.md, gap: 6 },
  valueChip: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  valueCheck: { color: colors.emerald, fontSize: 12 },
  valueText: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  todayWrap: { marginTop: spacing.lg, gap: spacing.sm },
  todayTitle: {
    color: colors.textMuted, fontSize: 11, letterSpacing: 0.8,
    textTransform: 'uppercase', fontWeight: typography.weight.semibold,
    marginBottom: 4,
  },
  todayCard: { marginBottom: spacing.xs },
  todayRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  todayCheck: { color: colors.emerald, fontSize: 14, fontWeight: typography.weight.bold },
  todayLabel: { color: colors.text, fontSize: typography.body, fontWeight: typography.weight.medium },
  todayBody: { color: colors.textDim, fontSize: typography.small, marginTop: 2, lineHeight: 18 },
});
