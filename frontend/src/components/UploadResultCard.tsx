import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { GlassCard } from '@/src/components/GlassCard';
import { colors, typography, spacing } from '@/src/theme';
import { useI18n } from '@/src/i18n';

export type UploadResult = {
  id: string;
  fileName: string;
  sourceFile: string;
  documentType: string;
  summary: string;
  detected: string[];
  whyItMatters: string;
  recommendedAction: string;
  confidence: number;
  linkedProperty?: string;
};

type Props = {
  result: UploadResult;
  testID?: string;
  onApprove?: () => void;
  onAsk?: () => void;
};

function confidenceTier(confidence: number): 'high' | 'medium' | 'low' {
  if (confidence >= 90) return 'high';
  if (confidence >= 70) return 'medium';
  return 'low';
}

/** Per-file upload analysis — narrative, magical review flow. */
export function UploadResultCard({ result, testID, onApprove, onAsk }: Props) {
  const { t, isRTL } = useI18n();
  const tier = confidenceTier(result.confidence);
  const tierColor = tier === 'high' ? colors.emerald : tier === 'medium' ? colors.gold : colors.danger;

  return (
    <GlassCard padding={22} radiusToken="lg" edge={tier === 'low' ? 'gold' : 'neutral'} testID={testID}>
      <View style={styles.top}>
        <Feather name="file-text" size={14} color={colors.textMuted} />
        <Text style={[styles.fileName, isRTL && styles.rtl]} numberOfLines={1}>{result.fileName}</Text>
      </View>

      <Phase label={t('upload.phase.detected')} value={result.documentType} accent />
      <Phase label={t('upload.phase.summary')} value={result.summary} />
      <Phase label={t('upload.phase.actions')} value={result.recommendedAction} accent="gold" />

      {result.linkedProperty ? (
        <Phase label={t('upload.phase.linked')} value={result.linkedProperty} accent="emerald" />
      ) : null}

      <View style={[styles.confBadge, { borderColor: tierColor + '66' }]}>
        <Text style={styles.confLabel}>{t('upload.phase.confidence')}</Text>
        <Text style={[styles.confText, { color: tierColor }]}>
          {t(`upload.confidence.${tier}`).replace('{n}', String(result.confidence))}
        </Text>
      </View>

      <View style={styles.actionRow}>
        <Pressable
          testID={`${testID}-approve`}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onApprove?.(); }}
          style={styles.primaryBtn}
        >
          <Text style={styles.primaryBtnText}>{t('upload.action.approve')}</Text>
        </Pressable>
        <Pressable
          testID={`${testID}-ask`}
          onPress={() => { Haptics.selectionAsync(); onAsk?.(); }}
          style={styles.secondaryBtn}
        >
          <Feather name="message-circle" size={14} color={colors.gold} />
          <Text style={styles.secondaryBtnText}>{t('upload.action.ask')}</Text>
        </Pressable>
      </View>
    </GlassCard>
  );
}

function Phase({
  label, value, accent,
}: { label: string; value: string; accent?: 'gold' | 'emerald' | true }) {
  const valueColor = accent === 'gold' ? colors.gold : accent === 'emerald' ? colors.emerald : colors.text;
  return (
    <View style={styles.phase}>
      <Text style={styles.phaseLabel}>{label}</Text>
      <Text style={[styles.phaseValue, accent && { color: valueColor }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  fileName: { flex: 1, color: colors.text, fontSize: 15, fontWeight: typography.weight.semibold },
  phase: { marginTop: 12 },
  phaseLabel: {
    color: colors.textMuted, fontSize: 10.5, letterSpacing: 1.4,
    textTransform: 'uppercase', fontWeight: typography.weight.medium,
  },
  phaseValue: { color: colors.textDim, fontSize: 15, lineHeight: 23, marginTop: 5 },
  confBadge: {
    alignSelf: 'flex-start', borderWidth: StyleSheet.hairlineWidth, borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 8, marginTop: 16, gap: 2,
  },
  confLabel: {
    color: colors.textMuted, fontSize: 9, letterSpacing: 1.2,
    textTransform: 'uppercase', fontWeight: typography.weight.medium,
  },
  confText: { fontSize: 11, letterSpacing: 0.8, fontWeight: typography.weight.medium },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: spacing.md },
  primaryBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 999, alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.goldEdge,
    backgroundColor: colors.goldSoft,
  },
  primaryBtnText: { color: colors.gold, fontSize: 13, fontWeight: typography.weight.semibold },
  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 12, borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  secondaryBtnText: { color: colors.textDim, fontSize: 12, fontWeight: typography.weight.medium },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
});
