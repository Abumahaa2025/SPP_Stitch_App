import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing,
  SharedValue, interpolate, Extrapolation,
} from 'react-native-reanimated';
import { colors, motion } from '../theme';

type Props = { scrollY?: SharedValue<number> };

/**
 * Cinematic ambient background.
 *
 * Four cinematographic layers:
 *   1. Ink — the deep navy base gradient.
 *   2. Emerald aurora — top right, slow breathing.
 *   3. Gold aurora — mid left, opposite phase.
 *   4. Deep aurora — bottom right, subtle depth.
 * Parallax reacts to scroll for a living world.
 */
export function AmbientBackground({ scrollY }: Props) {
  const emerald = useSharedValue(0);
  const gold = useSharedValue(0);
  const deep = useSharedValue(0);

  useEffect(() => {
    emerald.value = withRepeat(
      withTiming(1, { duration: motion.breath, easing: Easing.inOut(Easing.sin) }),
      -1, true,
    );
    gold.value = withRepeat(
      withTiming(1, { duration: motion.breath + 900, easing: Easing.inOut(Easing.sin) }),
      -1, true,
    );
    deep.value = withRepeat(
      withTiming(1, { duration: motion.breath + 1700, easing: Easing.inOut(Easing.sin) }),
      -1, true,
    );
  }, [emerald, gold, deep]);

  const emeraldStyle = useAnimatedStyle(() => {
    const shift = scrollY ? interpolate(scrollY.value, [0, 600], [0, -160], Extrapolation.CLAMP) : 0;
    return {
      opacity: 0.32 + emerald.value * 0.18,
      transform: [{ translateY: shift }, { scale: 1 + emerald.value * 0.04 }],
    };
  });
  const goldStyle = useAnimatedStyle(() => {
    const shift = scrollY ? interpolate(scrollY.value, [0, 600], [0, -90], Extrapolation.CLAMP) : 0;
    return {
      opacity: 0.2 + (1 - gold.value) * 0.16,
      transform: [{ translateY: shift }, { scale: 1 + (1 - gold.value) * 0.035 }],
    };
  });
  const deepStyle = useAnimatedStyle(() => {
    const shift = scrollY ? interpolate(scrollY.value, [0, 600], [0, -40], Extrapolation.CLAMP) : 0;
    return {
      opacity: 0.14 + deep.value * 0.08,
      transform: [{ translateY: shift }],
    };
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Base ink */}
      <LinearGradient
        colors={[colors.heroTop, colors.heroMid, '#020509']}
        locations={[0, 0.52, 1]}
        style={StyleSheet.absoluteFill}
      />
      {/* Emerald aurora — top right */}
      <Animated.View style={[styles.emeraldOrb, emeraldStyle]}>
        <LinearGradient
          colors={['rgba(80,200,120,0.48)', 'rgba(80,200,120,0)']}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      {/* Gold aurora — left mid */}
      <Animated.View style={[styles.goldOrb, goldStyle]}>
        <LinearGradient
          colors={['rgba(212,175,55,0.36)', 'rgba(212,175,55,0)']}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      {/* Deep aurora — bottom right for balance */}
      <Animated.View style={[styles.deepOrb, deepStyle]}>
        <LinearGradient
          colors={['rgba(88,146,232,0.28)', 'rgba(88,146,232,0)']}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      {/* Bottom fade so tab bar has depth */}
      <LinearGradient
        colors={['rgba(5,10,18,0)', 'rgba(2,5,9,0.9)']}
        style={styles.bottomFade}
      />
      {/* Top fade for status bar readability */}
      <LinearGradient
        colors={['rgba(5,10,18,0.55)', 'rgba(5,10,18,0)']}
        style={styles.topFade}
      />
      <View style={styles.vignette} />
    </View>
  );
}

const styles = StyleSheet.create({
  emeraldOrb: {
    position: 'absolute',
    top: -240, right: -180,
    width: 600, height: 600,
    borderRadius: 300,
    overflow: 'hidden',
  },
  goldOrb: {
    position: 'absolute',
    top: 300, left: -220,
    width: 540, height: 540,
    borderRadius: 270,
    overflow: 'hidden',
  },
  deepOrb: {
    position: 'absolute',
    bottom: -260, right: -140,
    width: 480, height: 480,
    borderRadius: 240,
    overflow: 'hidden',
  },
  bottomFade: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0, height: 280,
  },
  topFade: {
    position: 'absolute',
    left: 0, right: 0, top: 0, height: 140,
  },
  vignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5,10,18,0.28)',
  },
});
