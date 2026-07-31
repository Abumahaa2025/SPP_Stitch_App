import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, spacing, typography, radius } from '@/src/theme';

export type PulseItem = { key: string; label: string; value: string; onPress?: () => void };

type Props = { items: PulseItem[]; testID?: string };

/** Source web #homePulseRow — المهام · المتأخرات · الصيانة · التحصيل */
export function PulseRow({ items, testID }: Props) {
  return (
    <View style={styles.wrap} testID={testID}>
      {items.map((item) => (
        <Pressable
          key={item.key}
          style={styles.chip}
          onPress={() => { if (item.onPress) { Haptics.selectionAsync(); item.onPress(); } }}
        >
          <Text style={styles.value}>{item.value}</Text>
          <Text style={styles.label}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.lg },
  chip: {
    flexGrow: 1, minWidth: '22%', paddingVertical: 12, paddingHorizontal: 10,
    borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border, backgroundColor: 'rgba(255,255,255,0.025)',
    alignItems: 'center',
  },
  value: { color: colors.text, fontSize: 18, fontWeight: typography.weight.semibold },
  label: { color: colors.textMuted, fontSize: 10, marginTop: 4, letterSpacing: 0.5 },
});
