import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing,
} from 'react-native-reanimated';
import { colors, typography } from '../theme';

type Props = { size?: number; /** Header/shell — core orb only, no large halo pulse */ compact?: boolean };

/**
 * The definitive SPP identity mark.
 * A layered emerald→gold breathing orb with a hairline gold ring.
 * Used for splash, onboarding, chat empty state, brand loading.
 */
export function BrandOrb({ size = 84, compact = false }: Props) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withRepeat(
      withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
      -1, true,
    );
  }, [p]);

  const halo = useAnimatedStyle(() => ({
    opacity: 0.35 + p.value * 0.35,
    transform: [{ scale: 1 + p.value * 0.14 }],
  }));
  const glow = useAnimatedStyle(() => ({
    opacity: 0.55 + p.value * 0.3,
    transform: [{ scale: 0.9 + p.value * 0.12 }],
  }));
  const core = useAnimatedStyle(() => ({
    opacity: 0.9 + p.value * 0.1,
    transform: [{ scale: compact ? 0.94 + p.value * 0.06 : 0.86 + p.value * 0.1 }],
  }));

  const outer = size * 2;
  const midSize = size * 1.35;
  const box = compact ? size : outer;

  return (
    <View style={{ width: box, height: box, alignItems: 'center', justifyContent: 'center' }}>
      {!compact ? (
        <>
          <Animated.View style={[styles.abs, halo, { width: outer, height: outer, borderRadius: outer / 2 }]}>
            <LinearGradient
              colors={['rgba(212,175,55,0.18)', 'rgba(80,200,120,0)']}
              style={[StyleSheet.absoluteFill, { borderRadius: outer / 2 }]}
            />
          </Animated.View>
          <Animated.View style={[styles.abs, glow, { width: midSize, height: midSize, borderRadius: midSize / 2 }]}>
            <LinearGradient
              colors={['rgba(80,200,120,0.55)', 'rgba(80,200,120,0)']}
              style={[StyleSheet.absoluteFill, { borderRadius: midSize / 2 }]}
            />
          </Animated.View>
        </>
      ) : null}
      <Animated.View
        style={[
          styles.abs, core,
          {
            width: size, height: size, borderRadius: size / 2,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: 'rgba(212,175,55,0.45)',
          },
        ]}
      >
        <LinearGradient
          colors={['#78E0A5', '#4FCB84', '#2C8A5A']}
          start={{ x: 0.3, y: 0.15 }}
          end={{ x: 0.75, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: size / 2 }]}
        />
        {/* Inner top highlight */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute', left: '18%', top: '10%', width: '55%', height: '30%',
            backgroundColor: 'rgba(255,255,255,0.22)',
            borderRadius: size,
            transform: [{ rotate: '-20deg' }],
          }}
        />
      </Animated.View>
    </View>
  );
}

type WordmarkProps = {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  showTagline?: boolean;
  /** Smart Property, العقار الذكي — under SPP in shell chrome */
  showBilingualTagline?: boolean;
  align?: 'start' | 'center';
};

/**
 * SPP wordmark — the platform's identity in typography.
 */
export function Wordmark({ size = 'md', color = colors.text, showTagline, showBilingualTagline, align = 'start' }: WordmarkProps) {
  const spec =
    size === 'lg' ? { fontSize: 22, letterSpacing: 10 } :
    size === 'sm' ? { fontSize: 11, letterSpacing: 5 } :
    { fontSize: 14, letterSpacing: 7 };
  const tagSpec =
    size === 'lg' ? { en: 11, ar: 11 } :
    size === 'sm' ? { en: 8.5, ar: 8.5 } :
    { en: 9.5, ar: 9.5 };
  return (
    <View style={{ alignItems: align === 'center' ? 'center' : 'flex-start' }}>
      <Text
        style={{
          color,
          fontSize: spec.fontSize,
          letterSpacing: spec.letterSpacing,
          fontWeight: typography.weight.semibold,
          textAlign: align === 'center' ? 'center' : 'left',
        }}
      >
        S P P
      </Text>
      {showBilingualTagline ? (
        <Text style={[styles.bilingualTagline, align === 'center' && { textAlign: 'center' }]} numberOfLines={2}>
          <Text style={[styles.tagEn, { fontSize: tagSpec.en }]}>Smart Property Platform</Text>
          {'\n'}
          <Text style={[styles.tagAr, { fontSize: tagSpec.ar }]}>العقار الذكي</Text>
        </Text>
      ) : null}
      {showTagline ? (
        <Text style={styles.tagline}>AI OPERATING SYSTEM · REAL ESTATE</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  abs: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  tagline: {
    color: colors.textSubtle,
    fontSize: 9,
    letterSpacing: 2.5,
    fontWeight: typography.weight.medium,
    marginTop: 6,
  },
  bilingualTagline: { marginTop: 2, lineHeight: 13 },
  tagEn: {
    color: colors.textMuted,
    letterSpacing: 0.35,
    fontWeight: typography.weight.medium,
  },
  tagAr: {
    color: colors.textMuted,
    fontWeight: typography.weight.medium,
    writingDirection: 'rtl',
  },
});
