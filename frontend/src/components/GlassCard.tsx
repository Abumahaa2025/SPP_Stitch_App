import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, shadows } from '../theme';

type Props = {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  edge?: 'gold' | 'emerald' | 'neutral';
  padding?: number;
  radiusToken?: keyof typeof radius;
  testID?: string;
  /** When true, renders a stronger top-inner sheen. */
  bright?: boolean;
};

/**
 * Premium glassmorphic surface.
 *
 * Three layers of realism:
 *   1. Dark-smoked BlurView base.
 *   2. Diagonal tint gradient (highlight → shade).
 *   3. Hairline top-inner sheen, like real bevelled glass.
 *
 * Optional gold/emerald edge treatment for priority hierarchy.
 */
export function GlassCard({
  children, style, intensity = 44, edge = 'neutral',
  padding = 20, radiusToken = 'lg', testID, bright,
}: Props) {
  const r = radius[radiusToken];
  const borderColor =
    edge === 'gold' ? colors.borderGold :
    edge === 'emerald' ? colors.emeraldEdge :
    colors.borderStrong;

  return (
    <View
      testID={testID}
      style={[styles.wrap, shadows.glass, { borderRadius: r }, style]}
    >
      <BlurView
        intensity={Platform.OS === 'android' ? Math.min(intensity, 34) : intensity}
        tint="dark"
        style={[styles.blur, { borderRadius: r }]}
      >
        <LinearGradient
          colors={[
            bright ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.055)',
            'rgba(255,255,255,0.015)',
            'rgba(6,11,20,0.32)',
          ]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={[styles.tint, { borderRadius: r, borderColor, padding }]}
        >
          {/* Inner top sheen — bevel highlight */}
          <View
            pointerEvents="none"
            style={[
              styles.sheen,
              {
                borderTopLeftRadius: r,
                borderTopRightRadius: r,
                backgroundColor:
                  edge === 'gold'
                    ? 'rgba(212,175,55,0.28)'
                    : edge === 'emerald'
                      ? 'rgba(80,200,120,0.24)'
                      : colors.glassSheen,
              },
            ]}
          />
          {children}
        </LinearGradient>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    backgroundColor: colors.surfaceGlass,
  },
  blur: {
    overflow: 'hidden',
  },
  tint: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  sheen: {
    position: 'absolute',
    left: 1, right: 1, top: 0,
    height: StyleSheet.hairlineWidth,
    opacity: 0.9,
  },
});
