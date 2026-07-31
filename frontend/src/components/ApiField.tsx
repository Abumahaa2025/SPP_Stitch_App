import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography } from '@/src/theme';
import { useI18n } from '@/src/i18n';

type Props = {
  label: string;
  value: string;
  highlight?: 'gold' | 'emerald';
};

/** mob-label / mob-value — always show Arabic (or EN) label before API-sourced content. */
export function ApiField({ label, value, highlight }: Props) {
  const { isRTL } = useI18n();
  if (!value?.trim()) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text
        style={[
          styles.value,
          isRTL && styles.rtl,
          highlight === 'gold' && { color: colors.gold },
          highlight === 'emerald' && { color: colors.emerald },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { marginTop: 10 },
  label: {
    color: colors.textMuted, fontSize: 10.5, letterSpacing: 1.6,
    textTransform: 'uppercase', fontWeight: typography.weight.medium,
  },
  value: { color: colors.textDim, fontSize: 14, lineHeight: 22, marginTop: 5 },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
});
