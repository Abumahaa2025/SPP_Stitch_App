import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { GlassCard } from './GlassCard';
import { colors, radius, spacing, typography } from '../theme';
import type { DecisionT } from '../api/client';
import { useI18n } from '../i18n';

const kindIcon: Record<string, keyof typeof Feather.glyphMap> = {
  maintenance: 'tool',
  financial: 'trending-up',
  tenant: 'users',
  opportunity: 'star',
};

type Props = {
  decision: DecisionT;
  rank?: number;
  onAccept?: () => void;
  onDetails?: () => void;
};

/**
 * Refined priority card — Apple/Linear/Stripe hybrid.
 * Softer separators, hairline dividers instead of gradient borders,
 * tighter typography, less visual weight on secondary meta.
 */
export function ActionCard({ decision, rank, onAccept, onDetails }: Props) {
  const { t } = useI18n();
  const priorityMeta: Record<DecisionT['priority'], { label: string; color: string }> = {
    critical: { label: t('action.priority.critical'), color: colors.danger },
    high: { label: t('action.priority.high'), color: colors.gold },
    medium: { label: t('action.priority.medium'), color: colors.emerald },
    low: { label: t('action.priority.low'), color: colors.textMuted },
  };
  const meta = priorityMeta[decision.priority];
  const iconName = kindIcon[decision.kind] ?? 'zap';
  const highPriority = decision.priority === 'critical' || decision.priority === 'high';

  return (
    <GlassCard
      testID={`decision-card-${decision.id}`}
      edge={highPriority ? 'gold' : 'neutral'}
      padding={24}
      radiusToken="lg"
      style={{ marginBottom: spacing.md }}
    >
      {/* Header row — rank · priority · confidence */}
      <View style={styles.topRow}>
        {typeof rank === 'number' ? (
          <Text style={styles.rank}>{String(rank).padStart(2, '0')}</Text>
        ) : null}
        <View style={styles.priorityPill}>
          <View style={[styles.dot, { backgroundColor: meta.color }]} />
          <Text style={[styles.priorityLabel, { color: meta.color }]}>{meta.label}</Text>
        </View>
        <View style={{ flex: 1 }} />
        {(decision.priority === 'critical' || decision.priority === 'high') ? (
          <View style={styles.confidence}>
            <Text style={styles.confidenceValue}>{decision.confidence}</Text>
            <Text style={styles.confidenceLabel}>{t('action.certainty')}</Text>
          </View>
        ) : null}
      </View>

      {/* Body — icon + title */}
      <View style={styles.bodyRow}>
        <View style={[styles.iconWrap, highPriority && styles.iconWrapGold]}>
          <Feather name={iconName} size={15} color={highPriority ? colors.gold : colors.textDim} />
        </View>
        <Text style={[styles.title, { flex: 1 }]}>{decision.title}</Text>
      </View>

      <Text style={styles.reason}>{decision.reason}</Text>
      <Text style={styles.impact}>{decision.impact}</Text>

      <View style={styles.hair} />

      <Text style={styles.actionLabel}>{t('action.nextStep')}</Text>
      <View style={styles.actionRow}>
        <Pressable
          testID={`decision-accept-${decision.id}`}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onAccept?.();
          }}
          style={({ pressed }) => [
            styles.primaryBtn,
            highPriority ? styles.primaryBtnGold : styles.primaryBtnGhost,
            pressed && { opacity: 0.82, transform: [{ scale: 0.995 }] },
          ]}
        >
          <Text
            style={[
              styles.primaryBtnText,
              highPriority ? styles.primaryBtnTextGold : styles.primaryBtnTextGhost,
            ]}
            numberOfLines={2}
          >
            {decision.recommended_action}
          </Text>
        </Pressable>

        <Pressable
          testID={`decision-details-${decision.id}`}
          onPress={() => {
            Haptics.selectionAsync();
            onDetails?.();
          }}
          hitSlop={12}
          style={styles.secondaryBtn}
        >
          <Feather name="arrow-up-right" size={15} color={colors.textDim} />
        </Pressable>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rank: {
    fontSize: 10.5,
    color: colors.textSubtle,
    letterSpacing: 2.2,
    fontVariant: ['tabular-nums'],
    fontWeight: typography.weight.medium,
  },
  priorityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  dot: { width: 5, height: 5, borderRadius: 3 },
  priorityLabel: {
    fontSize: 10.5,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    fontWeight: typography.weight.medium,
  },
  confidence: { alignItems: 'flex-end' },
  confidenceValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: typography.weight.semibold,
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },
  confidenceLabel: {
    color: colors.textSubtle,
    fontSize: 9,
    marginTop: -2,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  bodyRow: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
    marginTop: spacing.lg,
  },
  iconWrap: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  iconWrapGold: {
    borderColor: colors.goldEdge,
    backgroundColor: colors.goldSoft,
  },
  title: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: typography.weight.semibold,
    letterSpacing: -0.35,
    paddingTop: 4,
  },
  reason: {
    marginTop: spacing.md,
    color: colors.textDim,
    fontSize: 14,
    lineHeight: 21,
  },
  impact: {
    marginTop: spacing.sm,
    color: colors.emerald,
    fontSize: 12.5,
    lineHeight: 18,
  },
  hair: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.divider,
    marginTop: spacing.lg,
  },
  actionLabel: {
    color: colors.textMuted, fontSize: 10.5, letterSpacing: 1.6,
    textTransform: 'uppercase', fontWeight: typography.weight.medium,
    marginTop: spacing.md,
  },
  actionRow: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },
  primaryBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  primaryBtnGold: {
    backgroundColor: colors.goldSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.goldEdge,
  },
  primaryBtnGhost: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  primaryBtnText: {
    fontSize: 13,
    fontWeight: typography.weight.medium,
    letterSpacing: 0.1,
    lineHeight: 18,
    textAlign: 'center',
  },
  primaryBtnTextGold: { color: colors.gold },
  primaryBtnTextGhost: { color: colors.text },
  secondaryBtn: {
    width: 44,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
});
