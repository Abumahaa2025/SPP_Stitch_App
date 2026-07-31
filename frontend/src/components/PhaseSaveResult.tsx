import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { GlassCard } from '@/src/components/GlassCard';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';

export type SummaryRow = { label: string; value: string };

export type SaveAction = { label: string; onPress: () => void; primary?: boolean };

type Props = {
  /** Short confirmation — e.g. "تم الحفظ بنجاح" */
  savedMessage?: string;
  /** Section heading for created entity details */
  createdTitle?: string;
  rows: SummaryRow[];
  nextHint?: string;
  children?: React.ReactNode;
  /** At least one action recommended; always include home/continue where applicable */
  actions: SaveAction[];
  testID?: string;
};

/** Post-save — what was created + mandatory next-step actions (no dead ends). */
export function PhaseSaveResult({
  savedMessage, createdTitle, rows, nextHint, children, actions, testID = 'phase-save-result',
}: Props) {
  const { t, isRTL } = useI18n();

  return (
    <Animated.View entering={FadeInDown.duration(500)} testID={testID}>
      <GlassCard padding={20} radiusToken="lg" edge="emerald">
        <Text style={styles.emoji}>✅</Text>
        <Text style={[styles.saved, isRTL && styles.rtl]}>
          {savedMessage ?? t('result.saved' as any)}
        </Text>
        <Text style={[styles.sectionLabel, isRTL && styles.rtl]}>
          {createdTitle ?? t('result.createdTitle' as any)}
        </Text>
        {rows.map((r) => (
          <View key={`${r.label}-${r.value}`} style={[styles.row, isRTL && styles.rowRtl]}>
            <Text style={[styles.rowLabel, isRTL && styles.rtl]}>{r.label}</Text>
            <Text style={[styles.rowValue, isRTL && styles.rtl]} selectable numberOfLines={4}>{r.value}</Text>
          </View>
        ))}
        {children}
        {nextHint ? (
          <View style={styles.nextBox}>
            <Text style={[styles.nextLabel, isRTL && styles.rtl]}>{t('result.next' as any)}</Text>
            <Text style={[styles.nextText, isRTL && styles.rtl]}>{nextHint}</Text>
          </View>
        ) : null}
        <View style={styles.actions}>
          {actions.map((a) => (
            <Pressable
              key={a.label}
              style={a.primary ? styles.primaryBtn : styles.secondaryBtn}
              onPress={() => { Haptics.selectionAsync(); a.onPress(); }}
              testID={`${testID}-action-${a.label}`}
            >
              <Text style={a.primary ? styles.primaryText : styles.secondaryText}>{a.label}</Text>
            </Pressable>
          ))}
        </View>
      </GlassCard>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  emoji: { fontSize: 28, marginBottom: spacing.sm },
  saved: {
    color: colors.emerald, fontSize: 14, fontWeight: typography.weight.semibold,
  },
  sectionLabel: {
    color: colors.text, fontSize: 16, fontWeight: typography.weight.semibold,
    marginTop: spacing.md, marginBottom: 8,
  },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    gap: 12, paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  rowRtl: { flexDirection: 'row-reverse' },
  rowLabel: { color: colors.textMuted, fontSize: 12, flex: 1 },
  rowValue: { color: colors.text, fontSize: 13, fontWeight: typography.weight.medium, flex: 1.2, textAlign: 'right' },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  nextBox: {
    marginTop: spacing.md, padding: 12, borderRadius: radius.md,
    backgroundColor: colors.goldSoft, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.goldEdge,
  },
  nextLabel: {
    color: colors.gold, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase',
    fontWeight: typography.weight.semibold,
  },
  nextText: { color: colors.text, fontSize: 14, marginTop: 4 },
  actions: { marginTop: spacing.lg, gap: 8 },
  primaryBtn: {
    backgroundColor: colors.emerald, borderRadius: radius.md,
    paddingVertical: 14, alignItems: 'center',
  },
  primaryText: { color: colors.bg, fontSize: 14, fontWeight: typography.weight.semibold },
  secondaryBtn: {
    borderRadius: radius.md, paddingVertical: 14, alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  secondaryText: { color: colors.text, fontSize: 13, fontWeight: typography.weight.medium },
});
