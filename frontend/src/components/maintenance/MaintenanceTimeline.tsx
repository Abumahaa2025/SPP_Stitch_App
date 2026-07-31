import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { GlassCard } from '@/src/components/GlassCard';
import type { MaintenanceTicket } from '@/src/types/operational';
import {
  ensureTimeline, timelineLabelKey, calcProgress,
} from '@/src/utils/maintenance-engine';
import { colors, spacing, typography } from '@/src/theme';
import { useI18n } from '@/src/i18n';
import { formatDate } from '@/src/utils/locale';

type Props = {
  ticket: MaintenanceTicket;
  showProgress?: boolean;
  showEta?: boolean;
};

export function MaintenanceTimeline({ ticket, showProgress = true, showEta = true }: Props) {
  const { t, isRTL } = useI18n();
  const timeline = ensureTimeline(ticket);
  const progress = ticket.progressPercent ?? calcProgress(timeline);

  return (
    <GlassCard padding={16} radiusToken="md" edge="emerald">
      {showProgress ? (
        <View style={styles.progressRow}>
          <Text style={[styles.progressLabel, isRTL && styles.rtl]}>
            {t('maint.progress' as any)}: {progress}%
          </Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
        </View>
      ) : null}

      {showEta && ticket.etaMinutes && ticket.status !== 'closed' ? (
        <Text style={[styles.eta, isRTL && styles.rtl]}>
          {t('maint.eta' as any)}: {ticket.etaMinutes} {t('maint.minutes' as any)}
          {ticket.etaArrivalAt ? ` · ${formatDate(ticket.etaArrivalAt)}` : ''}
        </Text>
      ) : null}

      <View style={{ marginTop: spacing.md }}>
        {timeline.map((ev, i) => (
          <Animated.View key={ev.kind} entering={FadeInDown.duration(300).delay(i * 30)}>
            <View style={[styles.row, isRTL && styles.rowRtl]}>
              <View style={[styles.dot, ev.done ? styles.dotDone : styles.dotPending]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.step, isRTL && styles.rtl, ev.done && styles.stepDone]}>
                  {ev.done ? '🟢' : '⚪'} {t(timelineLabelKey(ev.kind) as any)}
                </Text>
                {ev.at ? (
                  <Text style={[styles.time, isRTL && styles.rtl]}>{formatDate(ev.at)}</Text>
                ) : null}
              </View>
            </View>
            {i < timeline.length - 1 ? <View style={styles.line} /> : null}
          </Animated.View>
        ))}
      </View>

      {ticket.sppInsight ? (
        <View style={styles.insight}>
          <Feather name="cpu" size={14} color={colors.gold} />
          <Text style={[styles.insightText, isRTL && styles.rtl]}>
            {t(ticket.sppInsight as any)}
          </Text>
        </View>
      ) : null}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  progressRow: { marginBottom: spacing.sm },
  progressLabel: { color: colors.gold, fontSize: 13, fontWeight: typography.weight.semibold },
  progressBar: {
    height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.08)', marginTop: 6,
  },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: colors.emerald },
  eta: { color: colors.textDim, fontSize: 12, marginBottom: spacing.sm },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  rowRtl: { flexDirection: 'row-reverse' },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  dotDone: { backgroundColor: colors.emerald },
  dotPending: { backgroundColor: colors.textSubtle },
  step: { color: colors.textMuted, fontSize: 13 },
  stepDone: { color: colors.text },
  time: { color: colors.textSubtle, fontSize: 10, marginTop: 2 },
  line: {
    width: 2, height: 14, backgroundColor: colors.border,
    marginLeft: 3, marginVertical: 2,
  },
  insight: {
    flexDirection: 'row', gap: 8, marginTop: spacing.md,
    padding: 10, borderRadius: 8, backgroundColor: colors.goldSoft,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.goldEdge,
  },
  insightText: { flex: 1, color: colors.text, fontSize: 12, lineHeight: 18 },
});
