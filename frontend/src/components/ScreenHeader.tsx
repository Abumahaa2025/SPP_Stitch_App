import React from 'react';
import { Text, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors, spacing, typography, radius } from '../theme';
import { useI18n } from '../i18n';

type Props = {
  eyebrow?: string;
  title: string;
  sub?: string;
  showBack?: boolean;
};

export function ScreenHeader({ eyebrow, title, sub, showBack }: Props) {
  const router = useRouter();
  const { isRTL } = useI18n();
  return (
    <Animated.View entering={FadeInDown.duration(700).delay(80)} style={styles.wrap}>
      {showBack ? (
        <Pressable
          testID="header-back"
          onPress={() => { Haptics.selectionAsync(); router.back(); }}
          style={styles.back}
          hitSlop={12}
        >
          <Feather name={isRTL ? 'arrow-right' : 'arrow-left'} size={16} color={colors.textDim} />
        </Pressable>
      ) : null}
      {eyebrow ? <Text style={[styles.eyebrow, isRTL && styles.rtl]}>{eyebrow}</Text> : null}
      <Text style={[styles.title, isRTL && styles.rtl]}>{title}</Text>
      {sub ? <Text style={[styles.sub, isRTL && styles.rtl]}>{sub}</Text> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing['2xl'] },
  back: {
    width: 38, height: 38, borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.025)',
    marginBottom: spacing.lg,
  },
  eyebrow: {
    color: colors.textMuted, fontSize: 10.5, letterSpacing: 2.4,
    textTransform: 'uppercase', fontWeight: typography.weight.medium,
    marginBottom: spacing.md,
  },
  title: {
    color: colors.text, fontSize: 30, lineHeight: 36,
    fontWeight: typography.weight.semibold, letterSpacing: -0.7,
  },
  sub: {
    color: colors.textMuted, fontSize: 14.5, lineHeight: 21,
    marginTop: spacing.md, maxWidth: '92%',
  },
  rtl: { writingDirection: 'rtl', textAlign: 'right', alignSelf: 'stretch' },
});
