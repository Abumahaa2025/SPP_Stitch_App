import React, { useEffect } from 'react';
import { View, StyleSheet, Image } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing,
} from 'react-native-reanimated';

import { colors } from '@/src/theme';

const KOWIL_MARK = require('../../assets/images/kowil-mark.png');

type Props = { size?: number };

/**
 * Kowil mark — friendly Smart Property Employee avatar.
 * Soft emerald/gold mascot image with a gentle breathing pulse.
 */
export function SmartEmployeeMark({ size = 44 }: Props) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [p]);

  const pulse = useAnimatedStyle(() => ({
    opacity: 0.92 + p.value * 0.08,
    transform: [{ scale: 1 + p.value * 0.04 }],
  }));

  const r = size / 2;

  return (
    <View style={{ width: size, height: size }} accessibilityRole="image" accessibilityLabel="Kowil">
      <Animated.View
        style={[
          styles.wrap,
          pulse,
          {
            width: size,
            height: size,
            borderRadius: r,
            shadowRadius: size * 0.18,
          },
        ]}
      >
        <Image
          source={KOWIL_MARK}
          style={{ width: size, height: size, borderRadius: r }}
          resizeMode="cover"
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.goldEdge,
    overflow: 'hidden',
    backgroundColor: colors.bgElevated,
    shadowColor: colors.emerald,
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
});
