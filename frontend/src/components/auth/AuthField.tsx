import React from 'react';
import { View, Text, StyleSheet, TextInputProps } from 'react-native';
import { KeyboardAwareTextInput } from '@/src/components/KeyboardAwareTextInput';
import { colors, radius, typography } from '@/src/theme';

type Props = TextInputProps & {
  label: string;
  isRTL: boolean;
  onFocusExtra?: () => void;
};

export function AuthField({ label, isRTL, onFocusExtra, style, ...rest }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, isRTL && styles.rtl]}>{label}</Text>
      <KeyboardAwareTextInput
        {...rest}
        placeholderTextColor={colors.textSubtle}
        onFocus={(e) => {
          onFocusExtra?.();
          rest.onFocus?.(e);
        }}
        style={[styles.input, isRTL && styles.inputRtl, style]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: {
    color: colors.textDim,
    fontSize: 12,
    marginBottom: 6,
    fontWeight: typography.weight.medium,
    letterSpacing: 0.3,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: colors.text,
    fontSize: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  inputRtl: { textAlign: 'right' },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
});
