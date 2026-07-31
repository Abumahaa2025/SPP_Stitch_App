import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { GlassCard } from '@/src/components/GlassCard';
import { colors, spacing, typography } from '@/src/theme';
import { useI18n } from '@/src/i18n';

type Props = {
  where: string;
  now: string;
  benefit: string;
  next: string;
  testID?: string;
};

/** Four short answers — where / now / benefit / next — readable in ~10 seconds. */
export function JourneyGuide({ where, now, benefit, next, testID = 'journey-guide' }: Props) {
  const { t, isRTL } = useI18n();
  const rows = [
    { label: t('journey.where' as any), value: where },
    { label: t('journey.now' as any), value: now },
    { label: t('journey.benefit' as any), value: benefit },
    { label: t('journey.next' as any), value: next },
  ];

  return (
    <GlassCard padding={14} radiusToken="md" edge="neutral" testID={testID} style={{ marginBottom: spacing.md }}>
      {rows.map((row, i) => (
        <View key={row.label} style={[styles.row, i > 0 && styles.rowGap, isRTL && styles.rowRtl]}>
          <Text style={[styles.label, isRTL && styles.rtl]}>{row.label}</Text>
          <Text style={[styles.value, isRTL && styles.rtl]}>{row.value}</Text>
        </View>
      ))}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  row: { gap: 2 },
  rowGap: { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  rowRtl: {},
  label: { color: colors.textMuted, fontSize: 10, letterSpacing: 0.6, fontWeight: typography.weight.semibold },
  value: { color: colors.textDim, fontSize: 13, lineHeight: 20 },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
});
