import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import Animated, {
  useSharedValue, useAnimatedProps, withTiming, Easing,
  useDerivedValue,
} from 'react-native-reanimated';
import { colors, typography } from '../theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = {
  score: number;
  size?: number;
  stroke?: number;
  label?: string;
  sublabel?: string;
  statusText?: string;
};

/**
 * Premium circular health indicator.
 * - Faint track, wide emerald glow, animated gold-tinted gradient arc.
 * - Center: elegant score with delta caption + micro sublabel.
 */
export function HealthRing({
  score, size = 168, stroke = 12, label, sublabel, statusText,
}: Props) {
  const clamped = Math.max(0, Math.min(100, score));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(clamped / 100, {
      duration: 1300, easing: Easing.out(Easing.cubic),
    });
  }, [clamped, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: c * (1 - progress.value),
  }));

  const scoreVal = useDerivedValue(() => Math.round(progress.value * clamped));
  const [display, setDisplay] = React.useState(0);
  useEffect(() => {
    const id = setInterval(() => setDisplay(scoreVal.value), 40);
    return () => clearInterval(id);
  }, [scoreVal]);

  const status =
    statusText ??
    (clamped >= 85 ? 'Excellent' : clamped >= 70 ? 'Stable' : 'Attention');

  const numberSize = Math.max(28, Math.round(size * 0.24));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Defs>
          <SvgGradient id="ring" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.emerald} stopOpacity="1" />
            <Stop offset="0.55" stopColor="#8FD8A8" stopOpacity="0.95" />
            <Stop offset="1" stopColor={colors.gold} stopOpacity="0.9" />
          </SvgGradient>
        </Defs>
        {/* Faint track */}
        <Circle
          cx={size / 2} cy={size / 2} r={r}
          stroke="rgba(255,255,255,0.055)" strokeWidth={stroke} fill="none"
        />
        {/* Ambient glow */}
        <Circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={colors.emeraldGlow} strokeWidth={stroke + 10}
          strokeLinecap="round" fill="none" opacity={0.18}
        />
        {/* Progress arc */}
        <AnimatedCircle
          cx={size / 2} cy={size / 2} r={r}
          stroke="url(#ring)"
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${c} ${c}`}
          animatedProps={animatedProps}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>

      <View style={styles.center} pointerEvents="none">
        <Text style={[styles.score, { fontSize: numberSize, lineHeight: numberSize + 4 }]}>
          {display}
        </Text>
        {label ? <Text style={styles.label}>{label}</Text> : null}
        <View style={styles.statusDivider} />
        <Text style={[styles.status, { color: clamped >= 85 ? colors.emerald : clamped >= 70 ? colors.gold : colors.warning }]}>
          {status}
        </Text>
        {sublabel ? <Text style={styles.sublabel}>{sublabel}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  score: {
    fontWeight: typography.weight.semibold,
    color: colors.text,
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  label: {
    marginTop: 4,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    fontWeight: typography.weight.medium,
  },
  statusDivider: {
    width: 14, height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.14)',
    marginVertical: 6,
  },
  status: {
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    fontWeight: typography.weight.medium,
  },
  sublabel: {
    marginTop: 4,
    fontSize: 10,
    color: colors.textSubtle,
  },
});
