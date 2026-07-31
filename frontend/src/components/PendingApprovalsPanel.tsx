import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { GlassCard } from '@/src/components/GlassCard';
import { useOperational } from '@/src/hooks/useOperational';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';

type Props = { testID?: string; onAction?: () => void };

function fmtParams(t: (k: any) => string, key: string, params?: Record<string, string>) {
  let s = t(key);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      s = s.replace(`{${k}}`, v);
    });
  }
  return s;
}

/** Employee suggestions that need owner approval before execution. */
export function PendingApprovalsPanel({ testID = 'pending-approvals', onAction }: Props) {
  const { t, isRTL } = useI18n();
  const { pendingActions, approveAction, dismissAction } = useOperational();

  if (!pendingActions.length) return null;

  return (
    <Animated.View entering={FadeInDown.duration(500).delay(220)} style={styles.wrap} testID={testID}>
      <Text style={[styles.title, isRTL && styles.rtl]}>{t('op.approvals.title')}</Text>
      {pendingActions.slice(0, 4).map((action, i) => (
        <GlassCard key={action.id} padding={14} radiusToken="md" style={styles.card}>
          <Text style={[styles.label, isRTL && styles.rtl]}>
            {fmtParams(t, action.labelKey, action.labelParams)}
          </Text>
          <View style={[styles.row, isRTL && styles.rowRtl]}>
            <Pressable
              style={styles.approve}
              onPress={() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                approveAction(action.id);
                onAction?.();
              }}
              testID={`approve-${action.id}`}
            >
              <Text style={styles.approveText}>{t('op.approvals.approve')}</Text>
            </Pressable>
            <Pressable
              style={styles.dismiss}
              onPress={() => { Haptics.selectionAsync(); dismissAction(action.id); onAction?.(); }}
              testID={`dismiss-${action.id}`}
            >
              <Text style={styles.dismissText}>{t('op.approvals.dismiss')}</Text>
            </Pressable>
          </View>
        </GlassCard>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.md },
  title: {
    color: colors.textMuted, fontSize: 11, letterSpacing: 0.8,
    textTransform: 'uppercase', fontWeight: typography.weight.semibold,
    marginBottom: spacing.sm,
  },
  card: { marginBottom: spacing.sm },
  label: { color: colors.text, fontSize: typography.small, lineHeight: 20 },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  row: { flexDirection: 'row', gap: 10, marginTop: 12 },
  rowRtl: { flexDirection: 'row-reverse' },
  approve: {
    flex: 1, paddingVertical: 10, borderRadius: radius.md,
    backgroundColor: colors.emeraldSoft, borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.emeraldEdge, alignItems: 'center',
  },
  approveText: { color: colors.emerald, fontSize: 12, fontWeight: typography.weight.semibold },
  dismiss: {
    paddingVertical: 10, paddingHorizontal: 14, borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  dismissText: { color: colors.textMuted, fontSize: 12 },
});
