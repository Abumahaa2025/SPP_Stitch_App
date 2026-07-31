import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { colors, radius, typography } from '@/src/theme';
import { useI18n } from '@/src/i18n';

type Props = {
  textKey: string;
  icon?: keyof typeof Feather.glyphMap;
  testID?: string;
};

/** Small inline guidance — Kowil-style micro-hints for onboarding. */
export function GuidanceChip({ textKey, icon = 'info', testID }: Props) {
  const { t, isRTL } = useI18n();
  return (
    <View style={[styles.wrap, isRTL && styles.rtlRow]} testID={testID}>
      <Feather name={icon} size={11} color={colors.emerald} />
      <Text style={[styles.text, isRTL && styles.rtlText]}>{t(textKey as never)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(52,211,153,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.emeraldEdge,
    marginTop: 10,
  },
  rtlRow: { flexDirection: 'row-reverse' },
  text: {
    flex: 1,
    color: colors.textDim,
    fontSize: 11.5,
    lineHeight: 17,
    fontWeight: typography.weight.medium,
  },
  rtlText: { writingDirection: 'rtl', textAlign: 'right' },
});
