import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { colors } from '@/src/theme';

export type PulseIntensity = 'idle' | 'alert';

type Props = {
  color?: string;
  size?: number;
  /** idle = always-on calm breathe; alert = slightly clearer when attention is needed */
  intensity?: PulseIntensity;
  testID?: string;
};

const IDLE_MS = 3600;
const ALERT_MS = 3200;

/** SPP identity pulse — always breathing; calmer at idle, clearer when action is needed. */
export function AgreementPulse({
  color = colors.emerald,
  size = 6,
  intensity = 'idle',
  testID = 'agreement-pulse',
}: Props) {
  const breathe = useSharedValue(0);
  const isAlert = intensity === 'alert';

  useEffect(() => {
    breathe.value = withRepeat(
      withTiming(1, {
        duration: isAlert ? ALERT_MS : IDLE_MS,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true,
    );
  }, [isAlert, breathe]);

  const haloStyle = useAnimatedStyle(() => {
    if (isAlert) {
      return {
        opacity: 0.14 + breathe.value * 0.26,
        transform: [{ scale: 1 + breathe.value * 0.55 }],
      };
    }
    return {
      opacity: 0.07 + breathe.value * 0.11,
      transform: [{ scale: 1 + breathe.value * 0.28 }],
    };
  });

  const coreStyle = useAnimatedStyle(() => {
    if (isAlert) {
      return {
        opacity: 0.82 + breathe.value * 0.18,
        transform: [{ scale: 0.9 + breathe.value * 0.14 }],
      };
    }
    return {
      opacity: 0.5 + breathe.value * 0.18,
      transform: [{ scale: 0.94 + breathe.value * 0.08 }],
    };
  });

  const wrap = size * 2.4;

  return (
    <View
      testID={testID}
      style={{ width: wrap, height: wrap, alignItems: 'center', justifyContent: 'center' }}
    >
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: wrap,
            height: wrap,
            borderRadius: wrap / 2,
            backgroundColor: color,
          },
          haloStyle,
        ]}
      />
      <Animated.View
        style={[
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
            shadowColor: color,
            shadowOpacity: isAlert ? 0.5 : 0.28,
            shadowRadius: isAlert ? 4 : 2,
            shadowOffset: { width: 0, height: 0 },
          },
          coreStyle,
        ]}
      />
    </View>
  );
}
