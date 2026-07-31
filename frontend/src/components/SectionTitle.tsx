/**
 * SectionTitle — the ONE way every Beta 18 screen introduces a group.
 *
 * This primitive DOES NOT impose a new visual identity. It codifies the
 * eyebrow style already used across support.tsx (`faqTitle`), about.tsx
 * (`section`), portfolio.tsx and elsewhere:
 *   fontSize 10.5 · letterSpacing 2.0 · uppercase · medium weight
 *
 * Additive features:
 *   · Optional micro gold bar on the leading edge (auto-mirrors in RTL).
 *   · Optional count badge for lists (tabular-nums, gold-soft).
 *   · Optional trailing CTA (chevron by default).
 *   · Optional short sub-line.
 *
 * Adopt gradually — never overwrite an existing ad-hoc header wholesale.
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, spacing, typography, iconSize } from '../theme';
import { useI18n } from '../i18n';

type Props = {
  eyebrow: string;
  sub?: string;
  count?: number;
  onCtaPress?: () => void;
  ctaLabel?: string;
  /** Show the small gold bar on the leading edge. Default: true. */
  bar?: boolean;
  testID?: string;
};

export function SectionTitle({
  eyebrow, sub, count, onCtaPress, ctaLabel,
  bar = true, testID,
}: Props) {
  const { isRTL } = useI18n();
  return (
    <View style={styles.wrap} testID={testID}>
      <View style={[styles.row, isRTL && { flexDirection: 'row-reverse' }]}>
        {bar ? <View style={styles.bar} /> : null}
        <Text style={[styles.eyebrow, isRTL && styles.rtl]}>
          {eyebrow.toUpperCase()}
        </Text>
        {typeof count === 'number' ? (
          <View style={styles.count}>
            <Text style={styles.countText}>{count}</Text>
          </View>
        ) : null}
        <View style={{ flex: 1 }} />
        {onCtaPress ? (
          <Pressable
            testID={testID ? `${testID}-cta` : undefined}
            onPress={() => { Haptics.selectionAsync(); onCtaPress(); }}
            hitSlop={8}
            style={[styles.cta, isRTL && { flexDirection: 'row-reverse' }]}
          >
            {ctaLabel ? <Text style={styles.ctaText}>{ctaLabel}</Text> : null}
            <Feather
              name={isRTL ? 'chevron-left' : 'chevron-right'}
              size={iconSize.sm}
              color={colors.textMuted}
            />
          </Pressable>
        ) : null}
      </View>
      {sub ? (
        <Text style={[styles.sub, isRTL && styles.rtl]}>{sub}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bar: {
    width: 3, height: 12, borderRadius: 2,
    backgroundColor: colors.gold, opacity: 0.75,
  },
  eyebrow: {
    color: colors.textMuted, fontSize: 10.5, letterSpacing: 2,
    fontWeight: typography.weight.medium,
  },
  rtl: { textAlign: 'right', writingDirection: 'rtl' },
  count: {
    minWidth: 22, height: 20, borderRadius: 10,
    paddingHorizontal: 6,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.goldEdge,
    backgroundColor: colors.goldSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  countText: {
    color: colors.gold, fontSize: 10.5,
    fontWeight: typography.weight.semibold,
    fontVariant: ['tabular-nums'],
  },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ctaText: {
    color: colors.textMuted, fontSize: 11.5,
    letterSpacing: 0.4, fontWeight: typography.weight.medium,
  },
  sub: {
    color: colors.textSubtle, fontSize: 12, marginTop: 4, marginHorizontal: 11,
    lineHeight: 18, letterSpacing: 0.1,
  },
});
