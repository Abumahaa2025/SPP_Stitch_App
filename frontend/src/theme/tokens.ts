/**
 * SPP Design System — Dark Luxury tokens.
 * Everything premium in this app must consume from here.
 */

export const colors = {
  // Surfaces
  bg: '#050A12',             // slightly deeper for more depth
  bgElevated: '#0A1120',
  surface: '#0F1826',
  surfaceHi: '#1A2436',
  surfaceGlass: 'rgba(6, 11, 20, 0.58)',
  surfaceGlassStrong: 'rgba(6, 11, 20, 0.78)',
  glassSheen: 'rgba(255, 255, 255, 0.22)',  // inner top hairline
  glassSheenSoft: 'rgba(255, 255, 255, 0.08)',

  // Ink
  text: '#F5F7FA',
  textDim: '#C7D0DC',
  textMuted: '#8B95A5',
  textSubtle: '#5A6473',

  // Brand — gold primary + emerald secondary
  gold: '#D4AF37',
  goldSoft: 'rgba(212, 175, 55, 0.11)',
  goldEdge: 'rgba(212, 175, 55, 0.32)',
  emerald: '#4FCB84',
  emeraldSoft: 'rgba(80, 200, 120, 0.11)',
  emeraldEdge: 'rgba(80, 200, 120, 0.32)',
  emeraldGlow: 'rgba(80, 200, 120, 0.4)',

  // Semantic
  success: '#10B981',
  warning: '#F5B454',
  danger: '#E96B6B',
  info: '#5892E8',

  // Structure
  border: 'rgba(255, 255, 255, 0.07)',
  borderStrong: 'rgba(255, 255, 255, 0.12)',
  borderGold: 'rgba(212, 175, 55, 0.25)',
  divider: 'rgba(255, 255, 255, 0.04)',

  // Gradient stops
  heroTop: '#08121F',
  heroMid: '#050A12',
  auroraA: 'rgba(80, 200, 120, 0.14)',
  auroraB: 'rgba(212, 175, 55, 0.09)',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64,
} as const;

export const radius = {
  sm: 10,
  md: 18,
  lg: 26,
  xl: 34,
  pill: 999,
} as const;

/**
 * Icon size scale — enforces one visual rhythm across every screen.
 *
 * Existing Beta 18 usage tends to be size 12/14/16/18 · this scale
 * codifies those exact values so we stop guessing.
 *   xs (11) · pill metadata / footer icons
 *   sm (14) · card metadata / secondary CTAs
 *   md (16) · standard action icons (already the Beta 18 default)
 *   lg (18) · feature icons in header chips
 *   xl (22) · hero / illustrative icons
 */
export const iconSize = {
  xs: 11,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
} as const;

/**
 * Card padding scale — matches the padding values already scattered
 * across Beta 18 (18 · 20 · 22 · 26). Adopting this scale is optional
 * and non-breaking; every existing `padding={20}` keeps working as-is.
 *   compact (18) · list rows / dense tiles
 *   standard (22) · default informational card
 *   hero (28) · headline card at the top of a screen
 */
export const cardPadding = {
  compact: 18,
  standard: 22,
  hero: 28,
} as const;

export const typography = {
  // Strict scale from design spec.
  display: 32,
  largeTitle: 28,
  title: 22,
  cardTitle: 19,
  body: 16,
  small: 14,
  micro: 12,

  // Number scale (only when necessary)
  numLg: 36,
  numMd: 28,
  numSm: 22,

  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },

  letter: {
    tight: -0.6,
    normal: -0.2,
    loose: 0.4,
  },
};

export const shadows = {
  glass: {
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 20 },
    elevation: 14,
  },
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.38,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  glow: {
    shadowColor: colors.emerald,
    shadowOpacity: 0.32,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  gold: {
    shadowColor: colors.gold,
    shadowOpacity: 0.28,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  floating: {
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 36,
    shadowOffset: { width: 0, height: 22 },
    elevation: 22,
  },
};

export const motion = {
  fast: 200,
  base: 360,
  slow: 580,
  breath: 2800,
};

export const theme = { colors, spacing, radius, typography, shadows, motion, iconSize, cardPadding };
export default theme;
