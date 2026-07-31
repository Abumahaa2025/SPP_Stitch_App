import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';

import { colors } from '@/src/theme';

type Tone = 'gold' | 'emerald' | 'neutral';

type Props = {
  icon: keyof typeof Feather.glyphMap;
  tone?: Tone;
  size?: number;
  emoji?: string;
};

const GRADIENTS: Record<Tone, [string, string]> = {
  gold: ['rgba(212,175,95,0.35)', 'rgba(212,175,95,0.06)'],
  emerald: ['rgba(52,211,153,0.32)', 'rgba(52,211,153,0.06)'],
  neutral: ['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.03)'],
};

const ICON_COLOR: Record<Tone, string> = {
  gold: colors.gold,
  emerald: colors.emerald,
  neutral: colors.textDim,
};

/** Premium illustrated nav glyph — gradient orb + icon or emoji. */
export function NavIllustration({ icon, tone = 'neutral', size = 36, emoji }: Props) {
  const r = size / 2;
  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: r }]}>
      <LinearGradient colors={GRADIENTS[tone]} style={[styles.grad, { borderRadius: r }]}>
        {emoji ? (
          <Text style={styles.emoji}>{emoji}</Text>
        ) : (
          <Feather name={icon} size={size * 0.42} color={ICON_COLOR[tone]} />
        )}
      </LinearGradient>
      <View style={[styles.ring, { borderRadius: r, borderColor: `${ICON_COLOR[tone]}33` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden' },
  grad: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  ring: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: StyleSheet.hairlineWidth,
  },
  emoji: { fontSize: 18, lineHeight: 22 },
});
