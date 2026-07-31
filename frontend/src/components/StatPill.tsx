import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../theme';

type Props = { label: string; value: string; hint?: string };

export function StatPill({ label, value, hint }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, gap: 2 },
  label: {
    fontSize: 10.5,
    color: colors.textMuted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontWeight: typography.weight.medium,
  },
  value: {
    fontSize: typography.numSm,
    color: colors.text,
    fontWeight: typography.weight.semibold,
    letterSpacing: typography.letter.tight,
    marginTop: spacing.xs,
  },
  hint: {
    fontSize: 11,
    color: colors.textSubtle,
    marginTop: 2,
  },
});
