import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing,
} from 'react-native-reanimated';

import { colors } from '@/src/theme';

type Props = { size?: number };

/** Distinctive Smart Property Employee mark — central AI assistant identity. */
export function SmartEmployeeMark({ size = 44 }: Props) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withRepeat(withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [p]);

  const pulse = useAnimatedStyle(() => ({
    opacity: 0.5 + p.value * 0.4,
    transform: [{ scale: 1 + p.value * 0.06 }],
  }));

  const r = size / 2;

  return (
    <View style={{ width: size, height: size }}>
      <Animated.View style={[styles.wrap, pulse, { width: size, height: size, borderRadius: r }]}>
        <LinearGradient
          colors={['rgba(212,175,95,0.45)', 'rgba(52,211,153,0.25)', 'rgba(6,11,20,0.9)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: r }]}
        />
        <View style={styles.face}>
          <View style={styles.eyes}>
            <View style={[styles.eye, { backgroundColor: colors.gold }]} />
            <View style={[styles.eye, { backgroundColor: colors.gold }]} />
          </View>
          <View style={styles.mouth} />
        </View>
        <View style={[styles.antenna, { left: size * 0.28 }]} />
        <View style={[styles.antenna, { right: size * 0.28 }]} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.goldEdge,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  face: { alignItems: 'center', gap: 5 },
  eyes: { flexDirection: 'row', gap: 10 },
  eye: { width: 6, height: 6, borderRadius: 3 },
  mouth: {
    width: 14, height: 3, borderRadius: 2,
    backgroundColor: colors.emerald, opacity: 0.85,
  },
  antenna: {
    position: 'absolute', top: 4, width: 2, height: 6,
    borderRadius: 1, backgroundColor: colors.gold, opacity: 0.7,
  },
});
