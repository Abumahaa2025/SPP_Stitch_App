import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { GlassCard } from '@/src/components/GlassCard';
import { colors, spacing, typography } from '@/src/theme';
import { useI18n } from '@/src/i18n';

type HintKey = 'import' | 'maintenance' | 'smart' | 'services';

type Props = {
  feature: HintKey;
  testID?: string;
};

const HINT_KEYS: Record<HintKey, { hint: string; next: string }> = {
  import: { hint: 'opsv2.import.hint', next: 'opsv2.import.next' },
  maintenance: { hint: 'opsv2.maintenance.hint', next: 'opsv2.maintenance.next' },
  smart: { hint: 'opsv2.smart.hint', next: 'opsv2.smart.next' },
  services: { hint: 'opsv2.services.hint', next: 'opsv2.services.next' },
};

/** Brief operational guidance — why + what happens next. */
export function OperationHint({ feature, testID = 'operation-hint' }: Props) {
  const { t, isRTL } = useI18n();
  const keys = HINT_KEYS[feature];

  return (
    <GlassCard padding={14} radiusToken="md" edge="neutral" testID={testID}>
      <Text style={[styles.why, isRTL && styles.rtl]}>{t('opsv2.hint.why' as any)}</Text>
      <Text style={[styles.body, isRTL && styles.rtl]}>{t(keys.hint as any)}</Text>
      <Text style={[styles.why, isRTL && styles.rtl, { marginTop: spacing.sm }]}>
        {t('opsv2.hint.next' as any)}
      </Text>
      <Text style={[styles.body, isRTL && styles.rtl]}>{t(keys.next as any)}</Text>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  why: {
    color: colors.textMuted, fontSize: 10, letterSpacing: 0.8,
    textTransform: 'uppercase', fontWeight: typography.weight.semibold,
  },
  body: { color: colors.textDim, fontSize: 13, lineHeight: 20, marginTop: 4 },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
});
