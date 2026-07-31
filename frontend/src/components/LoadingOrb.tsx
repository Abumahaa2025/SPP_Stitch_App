import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing,
} from 'react-native-reanimated';

type Props = { size?: number };

/**
 * The SPP orb. Emerald core, gold halo, breathing.
 * Used as the loading state, splash, and idle chat indicator.
 */
export function LoadingOrb({ size = 84 }: Props) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withRepeat(
      withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
      -1, true,
    );
  }, [p]);

  const halo = useAnimatedStyle(() => ({
    opacity: 0.45 + p.value * 0.4,
    transform: [{ scale: 1 + p.value * 0.15 }],
  }));
  const core = useAnimatedStyle(() => ({
    opacity: 0.85 + p.value * 0.15,
    transform: [{ scale: 0.9 + p.value * 0.1 }],
  }));

  return (
    <View style={{ width: size * 2, height: size * 2, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[styles.abs, halo, { width: size * 2, height: size * 2 }]}>
        <LinearGradient
          colors={['rgba(212,175,55,0.25)', 'rgba(80,200,120,0)']}
          style={[StyleSheet.absoluteFill, { borderRadius: size }]}
        />
      </Animated.View>
      <Animated.View style={[styles.abs, core, { width: size, height: size }]}>
        <LinearGradient
          colors={['rgba(80,200,120,0.85)', 'rgba(212,175,55,0.35)']}
          style={[StyleSheet.absoluteFill, { borderRadius: size / 2 }]}
        />
      </Animated.View>
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
});
