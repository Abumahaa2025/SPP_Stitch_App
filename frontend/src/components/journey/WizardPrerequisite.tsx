import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { GlassCard } from '@/src/components/GlassCard';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';

type Props = {
  titleKey: string;
  bodyKey: string;
  actionKey: string;
  onAction: () => void;
  testID?: string;
};

/** Blocks a wizard step until a prerequisite is met — with one clear forward action. */
export function WizardPrerequisite({ titleKey, bodyKey, actionKey, onAction, testID }: Props) {
  const { t, isRTL } = useI18n();
  return (
    <GlassCard padding={18} radiusToken="md" edge="gold" testID={testID}>
      <Text style={[styles.title, isRTL && styles.rtl]}>{t(titleKey as any)}</Text>
      <Text style={[styles.body, isRTL && styles.rtl]}>{t(bodyKey as any)}</Text>
      <Pressable
        style={[styles.btn, isRTL && styles.rowRtl]}
        onPress={() => { Haptics.selectionAsync(); onAction(); }}
      >
        <Text style={styles.btnText}>{t(actionKey as any)}</Text>
        <Feather name={isRTL ? 'arrow-left' : 'arrow-right'} size={14} color={colors.bg} />
      </Pressable>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 15, fontWeight: typography.weight.semibold },
  body: { color: colors.textDim, fontSize: 13, lineHeight: 20, marginTop: 8 },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  rowRtl: { flexDirection: 'row-reverse' },
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: spacing.md, backgroundColor: colors.emerald, borderRadius: radius.md,
    paddingVertical: 12, paddingHorizontal: 16,
  },
  btnText: { color: colors.bg, fontSize: 13, fontWeight: typography.weight.semibold },
});
