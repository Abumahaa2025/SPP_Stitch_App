import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { LoadingOrb } from './LoadingOrb';
import { colors, spacing, typography } from '../theme';

type Props = {
  icon?: keyof typeof Feather.glyphMap;
  eyebrow?: string;
  title: string;
  body?: string;
  /** When true, replaces the icon chip with the SPP breathing orb. */
  orb?: boolean;
  testID?: string;
};

/**
 * Premium reusable empty state.
 * Never crowded. Always calm. Always intentional.
 */
export function EmptyState({
  icon = 'check-circle', eyebrow, title, body, orb, testID,
}: Props) {
  return (
    <Animated.View
      entering={FadeIn.duration(500)}
      style={styles.wrap}
      testID={testID}
    >
      {orb ? (
        <LoadingOrb size={48} />
      ) : (
        <View style={styles.iconChip}>
          <Feather name={icon} size={16} color={colors.textDim} />
        </View>
      )}
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: spacing['2xl'],
    paddingHorizontal: spacing.lg,
    gap: 4,
  },
  iconChip: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.md,
  },
  eyebrow: {
    color: colors.textMuted,
    fontSize: 10.5,
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontWeight: typography.weight.medium,
    marginTop: 8,
  },
  title: {
    color: colors.text,
    fontSize: 17,
    fontWeight: typography.weight.semibold,
    letterSpacing: -0.3,
    marginTop: 6,
    textAlign: 'center',
  },
  body: {
    color: colors.textMuted,
    fontSize: 13.5,
    lineHeight: 20,
    marginTop: 8,
    textAlign: 'center',
    maxWidth: 280,
  },
});
