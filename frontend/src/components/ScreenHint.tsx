import React from 'react';
import { Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { colors, typography, spacing } from '@/src/theme';
import { useI18n } from '@/src/i18n';

type Props = {
  text: string;
  delay?: number;
  testID?: string;
};

/** One-line page guidance — calm, below the header. */
export function ScreenHint({ text, delay = 40, testID }: Props) {
  const { isRTL } = useI18n();
  return (
    <Animated.View entering={FadeInDown.duration(450).delay(delay)} testID={testID}>
      <Text style={[styles.text, isRTL && styles.rtl]}>{text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  text: {
    color: colors.textMuted,
    fontSize: typography.small,
    lineHeight: 21,
    marginBottom: spacing.md,
  },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
});
