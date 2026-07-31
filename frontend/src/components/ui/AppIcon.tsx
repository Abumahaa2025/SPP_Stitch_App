import React from 'react';
import { Feather } from '@expo/vector-icons';
import { colors } from '@/src/theme';

export const ICON_SIZE = { sm: 14, md: 16, lg: 18 } as const;
export type IconSize = keyof typeof ICON_SIZE;
export type IconAccent = 'gold' | 'emerald' | 'muted' | 'text';

const ACCENT_COLOR: Record<IconAccent, string> = {
  gold: colors.gold,
  emerald: colors.emerald,
  muted: colors.textMuted,
  text: colors.textDim,
};

type Props = {
  name: keyof typeof Feather.glyphMap;
  size?: IconSize;
  accent?: IconAccent;
  color?: string;
};

/** Unified Feather icon — consistent size and color across the shell. */
export function AppIcon({ name, size = 'md', accent = 'muted', color }: Props) {
  return (
    <Feather
      name={name}
      size={ICON_SIZE[size]}
      color={color ?? ACCENT_COLOR[accent]}
    />
  );
}
