import React from 'react';
import { View, Text, StyleSheet, Pressable, ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { colors, spacing, typography, radius } from '../theme';
import { useI18n } from '../i18n';

type Props = {
  icon?: string;
  eyebrow?: string;
  title: string;
  subtitle: string;
  onPressHeader?: () => void;
  actionLabel?: string;
  onAction?: () => void;
  delay?: number;
  children?: React.ReactNode;
  testID?: string;
  style?: ViewStyle;
};

/**
 * Source web PAGE_META + section block — large, self-explanatory Arabic-first sections.
 */
export function WebSection({
  icon,
  eyebrow,
  title,
  subtitle,
  onPressHeader,
  actionLabel,
  onAction,
  delay = 0,
  children,
  testID,
  style,
}: Props) {
  const { isRTL } = useI18n();
  const HeaderWrap = onPressHeader ? Pressable : View;

  return (
    <Animated.View
      entering={FadeInDown.duration(600).delay(delay)}
      style={[styles.wrap, style]}
      testID={testID}
    >
      <HeaderWrap
        onPress={onPressHeader ? () => { Haptics.selectionAsync(); onPressHeader(); } : undefined}
        style={styles.header}
      >
        {icon ? <Text style={styles.emoji}>{icon}</Text> : null}
        <View style={{ flex: 1 }}>
          {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        {onPressHeader ? (
          <Feather
            name={isRTL ? 'chevron-left' : 'chevron-right'}
            size={18}
            color={colors.textMuted}
            style={{ marginTop: 8 }}
          />
        ) : null}
      </HeaderWrap>

      {children ? <View style={styles.body}>{children}</View> : null}

      {actionLabel && onAction ? (
        <Pressable
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onAction(); }}
          style={styles.actionBtn}
          testID={testID ? `${testID}-action` : undefined}
        >
          <Text style={styles.actionText}>{actionLabel}</Text>
          <Feather name={isRTL ? 'arrow-left' : 'arrow-right'} size={14} color={colors.gold} />
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    backgroundColor: 'rgba(255,255,255,0.025)',
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  emoji: { fontSize: 28, lineHeight: 34 },
  eyebrow: {
    color: colors.emerald, fontSize: 10.5, letterSpacing: 2,
    textTransform: 'uppercase', fontWeight: typography.weight.medium,
  },
  title: {
    color: colors.text, fontSize: 22, fontWeight: typography.weight.semibold,
    letterSpacing: typography.letter.tight, marginTop: 4, lineHeight: 28,
  },
  subtitle: {
    color: colors.textDim, fontSize: 14, lineHeight: 22, marginTop: 8,
  },
  body: { marginTop: spacing.lg },
  actionBtn: {
    marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.goldEdge,
    backgroundColor: colors.goldSoft,
  },
  actionText: {
    color: colors.gold, fontSize: 14, fontWeight: typography.weight.semibold,
  },
});
