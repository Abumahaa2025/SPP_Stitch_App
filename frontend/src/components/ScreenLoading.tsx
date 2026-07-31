import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { LoadingOrb } from '@/src/components/LoadingOrb';
import { colors, spacing, typography } from '@/src/theme';

type Props = {
  message: string;
  testID?: string;
};

/** Calm loading — orb + one line. Never show raw zeros while waiting. */
export function ScreenLoading({ message, testID }: Props) {
  return (
    <Animated.View entering={FadeIn.duration(400)} style={styles.wrap} testID={testID}>
      <LoadingOrb size={40} />
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['3xl'],
    gap: spacing.lg,
  },
  text: {
    color: colors.textMuted,
    fontSize: 14,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
});
