import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { colors, spacing, typography, radius } from '@/src/theme';

export type KpiItem = { key: string; label: string; value: string; hint?: string };

type Props = { items: KpiItem[]; testID?: string };

/** Source web #koilKpiStrip / #statStrip — horizontal KPI cards. */
export function KpiStrip({ items, testID }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.wrap}
      testID={testID}
    >
      {items.map((item) => (
        <View key={item.key} style={styles.card}>
          <Text style={styles.label}>{item.label}</Text>
          <Text style={styles.value}>{item.value}</Text>
          {item.hint ? <Text style={styles.hint}>{item.hint}</Text> : null}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: -spacing.lg, marginBottom: spacing.lg },
  row: { gap: 10, paddingHorizontal: spacing.lg },
  card: {
    minWidth: 108, paddingVertical: 14, paddingHorizontal: 14,
    borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border, backgroundColor: 'rgba(255,255,255,0.03)',
  },
  label: {
    color: colors.textMuted, fontSize: 10, letterSpacing: 1.2,
    textTransform: 'uppercase', fontWeight: typography.weight.medium,
  },
  value: {
    color: colors.text, fontSize: 20, fontWeight: typography.weight.semibold,
    marginTop: 6, fontVariant: ['tabular-nums'],
  },
  hint: { color: colors.textSubtle, fontSize: 10, marginTop: 4 },
});
