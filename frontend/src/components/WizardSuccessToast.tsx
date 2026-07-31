import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { GlassCard } from '@/src/components/GlassCard';
import { colors, spacing, typography } from '@/src/theme';
import { useI18n } from '@/src/i18n';

type Props = { message: string; testID?: string };

/** Brief success flash (~1s) between wizard steps. */
export function WizardSuccessToast({ message, testID = 'wizard-success-toast' }: Props) {
  const { isRTL } = useI18n();
  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(200)}
      style={styles.wrap}
      pointerEvents="none"
      testID={testID}
    >
      <GlassCard padding={18} radiusToken="lg" edge="emerald">
        <Text style={[styles.text, isRTL && styles.rtl]}>{message}</Text>
      </GlassCard>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute', top: '38%', left: spacing.lg, right: spacing.lg, zIndex: 100,
  },
  text: {
    color: colors.text, fontSize: 15, fontWeight: typography.weight.semibold, textAlign: 'center',
  },
  rtl: { writingDirection: 'rtl' },
});
