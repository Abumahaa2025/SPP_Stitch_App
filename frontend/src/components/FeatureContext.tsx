import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { GlassCard } from '@/src/components/GlassCard';
import { colors, spacing, typography } from '@/src/theme';
import { useI18n } from '@/src/i18n';

type Props = {
  why: string;
  benefit: string;
  background: string;
  delay?: number;
  testID?: string;
  defaultOpen?: boolean;
};

/** Why / benefit / background — from Source web capFeatureContext. */
export function FeatureContext({ why, benefit, background, delay = 100, testID, defaultOpen = false }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Animated.View entering={FadeInDown.duration(550).delay(delay)}>
      <Pressable onPress={() => setOpen((v) => !v)} testID={testID}>
        <GlassCard padding={18} radiusToken="lg" edge="neutral">
          <View style={styles.toggleRow}>
            <Feather name="help-circle" size={14} color={colors.textMuted} />
            <Text style={styles.toggleLabel}>{t('clarity.learnMore')}</Text>
            <Feather name={open ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textMuted} />
          </View>
          {open ? (
            <View style={styles.blocks}>
              <Block label={t('clarity.why')} text={why} />
              <Block label={t('clarity.benefit')} text={benefit} />
              <Block label={t('clarity.background')} text={background} />
            </View>
          ) : null}
        </GlassCard>
      </Pressable>
    </Animated.View>
  );
}

function Block({ label, text }: { label: string; text: string }) {
  return (
    <View style={styles.block}>
      <Text style={styles.blockLabel}>{label}</Text>
      <Text style={styles.blockText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toggleLabel: {
    flex: 1, color: colors.textMuted, fontSize: 12, letterSpacing: 1.2,
    textTransform: 'uppercase', fontWeight: typography.weight.medium,
  },
  blocks: { marginTop: spacing.md, gap: 14 },
  block: {},
  blockLabel: {
    color: colors.text, fontSize: 12, fontWeight: typography.weight.semibold,
    letterSpacing: 0.3,
  },
  blockText: { color: colors.textDim, fontSize: 13.5, lineHeight: 21, marginTop: 4 },
});
