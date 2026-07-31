/**
 * ListRow — the tappable row primitive for lists across Beta 18.
 *
 * Codifies the pattern already used in `support.tsx`, `more.tsx`, and
 * numerous menu-style screens: a GlassCard containing icon chip + label
 * + hint + trailing chevron. This component wraps that pattern so we
 * stop re-implementing it in every file.
 *
 * Design contract (matches existing Beta 18 rows):
 *   · Icon chip: 40×40, radius 20, hairline border
 *   · Label: fontSize 15, semibold, letterSpacing -0.2
 *   · Hint: fontSize 12.5, muted, marginTop 3
 *   · Trailing: chevron/arrow that auto-mirrors in RTL
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { GlassCard } from './GlassCard';
import { colors, spacing, typography, radius, iconSize, cardPadding } from '../theme';
import { useI18n } from '../i18n';

type Accent = 'gold' | 'emerald' | 'neutral' | 'danger';

type Props = {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle?: string;
  /** Trailing pill · e.g. "3" or "قريباً". */
  meta?: string;
  /** Colored accent — drives icon chip + card edge. */
  accent?: Accent;
  /** Trailing indicator. */
  trailing?: 'chevron' | 'arrow' | 'external' | null;
  onPress?: () => void;
  disabled?: boolean;
  testID?: string;
};

const ACCENT_COLOR: Record<Accent, string> = {
  gold: colors.gold,
  emerald: colors.emerald,
  neutral: colors.textDim,
  danger: colors.danger,
};

export function ListRow({
  icon, title, subtitle, meta, accent = 'neutral', trailing = 'chevron',
  onPress, disabled, testID,
}: Props) {
  const { isRTL } = useI18n();
  const accentColor = ACCENT_COLOR[accent];
  const chipBg =
    accent === 'gold' ? colors.goldSoft :
    accent === 'emerald' ? colors.emeraldSoft :
    accent === 'danger' ? 'rgba(233,107,107,0.13)' :
    'rgba(255,255,255,0.02)';
  const chipEdge =
    accent === 'gold' ? colors.goldEdge :
    accent === 'emerald' ? colors.emeraldEdge :
    accent === 'danger' ? 'rgba(233,107,107,0.32)' :
    colors.border;

  const trailingName =
    trailing === 'chevron' ? (isRTL ? 'chevron-left' : 'chevron-right') :
    trailing === 'arrow' ? (isRTL ? 'arrow-left' : 'arrow-right') :
    trailing === 'external' ? 'arrow-up-right' :
    null;

  const inner = (
    <GlassCard
      padding={cardPadding.compact}
      radiusToken="lg"
      edge={accent === 'danger' ? 'neutral' : (accent as any)}
    >
      <View style={[styles.row, isRTL && { flexDirection: 'row-reverse' }]}>
        <View style={[styles.chip, { borderColor: chipEdge, backgroundColor: chipBg }]}>
          <Feather name={icon} size={iconSize.md} color={accentColor} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={[styles.title, isRTL && styles.rtl]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.subtitle, isRTL && styles.rtl]} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {meta ? (
          <View style={styles.meta}>
            <Text style={styles.metaText}>{meta}</Text>
          </View>
        ) : null}
        {trailingName ? (
          <Feather name={trailingName} size={iconSize.md} color={colors.textDim} />
        ) : null}
      </View>
    </GlassCard>
  );

  if (!onPress) return inner;

  return (
    <Pressable
      testID={testID}
      disabled={disabled}
      onPress={() => { Haptics.selectionAsync(); onPress(); }}
      style={({ pressed }) => [
        { marginBottom: spacing.sm },
        pressed && !disabled && { opacity: 0.9, transform: [{ scale: 0.995 }] },
        disabled && { opacity: 0.55 },
      ]}
    >
      {inner}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  chip: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center', justifyContent: 'center',
  },
  title: {
    color: colors.text, fontSize: 15,
    fontWeight: typography.weight.semibold, letterSpacing: -0.2,
  },
  rtl: { textAlign: 'right', writingDirection: 'rtl' },
  subtitle: { color: colors.textMuted, fontSize: 12.5, lineHeight: 18 },
  meta: {
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  metaText: {
    color: colors.textDim, fontSize: 10.5, letterSpacing: 0.4,
    fontWeight: typography.weight.medium, fontVariant: ['tabular-nums'],
  },
});
