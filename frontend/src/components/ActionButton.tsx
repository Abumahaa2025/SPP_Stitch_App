import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, radius, typography } from '@/src/theme';

export type ActionStatus = 'idle' | 'loading' | 'success' | 'error';

type Props = {
  label: string;
  loadingLabel?: string;
  successLabel?: string;
  errorLabel?: string;
  status?: ActionStatus;
  onPress: () => void;
  onRetry?: () => void;
  disabled?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
  tone?: 'gold' | 'emerald';
};

/** Spec §13 — every primary action: loading / success / error / retry. */
export function ActionButton({
  label,
  loadingLabel,
  successLabel,
  errorLabel,
  status = 'idle',
  onPress,
  onRetry,
  disabled,
  testID,
  style,
  tone = 'gold',
}: Props) {
  const bg = tone === 'emerald' ? colors.emerald : colors.gold;
  const busy = status === 'loading';
  const isError = status === 'error';
  const isSuccess = status === 'success';
  const text = isError
    ? (errorLabel || label)
    : isSuccess
      ? (successLabel || label)
      : busy
        ? (loadingLabel || label)
        : label;

  return (
    <Pressable
      testID={testID}
      disabled={disabled || busy}
      onPress={() => {
        if (isError && onRetry) onRetry();
        else onPress();
      }}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: isError ? colors.danger : bg, opacity: pressed || busy ? 0.85 : 1 },
        style,
      ]}
    >
      {busy ? <ActivityIndicator color={colors.bg} size="small" /> : null}
      <Text style={styles.text}>{isError && onRetry ? `${text} · ↻` : text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 48,
    borderRadius: radius.pill,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  text: {
    color: colors.bg,
    fontSize: 15,
    fontWeight: typography.weight.semibold,
  },
});
