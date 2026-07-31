import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeIn, FadeInDown, useSharedValue, useAnimatedStyle,
  withTiming, withDelay, Easing,
} from 'react-native-reanimated';

import { BrandOrb, Wordmark } from './BrandOrb';
import { colors, typography } from '../theme';
import { useI18n } from '../i18n';

type Props = {
  visible: boolean;
  /** How long the intro remains fully opaque before fading. */
  holdMs?: number;
};

/**
 * SPP Intro — luxury cold-start signature.
 * Logo entrance ~1.2s, bilingual identity, soft fade to app.
 */
export function SplashIntro({ visible, holdMs = 2000 }: Props) {
  const { t } = useI18n();
  const opacity = useSharedValue(1);
  const logoScale = useSharedValue(0.88);
  const logoOpacity = useSharedValue(0);
  const sheen = useSharedValue(0);

  useEffect(() => {
    logoOpacity.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) });
    logoScale.value = withTiming(1, { duration: 1200, easing: Easing.out(Easing.cubic) });
    sheen.value = withDelay(400, withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }));
  }, [logoOpacity, logoScale, sheen]);

  useEffect(() => {
    if (!visible) {
      opacity.value = withTiming(0, { duration: 560, easing: Easing.inOut(Easing.cubic) });
    }
  }, [visible, opacity]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    pointerEvents: (opacity.value > 0.02 ? 'auto' : 'none') as 'auto' | 'none',
  }));

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const sheenStyle = useAnimatedStyle(() => ({
    opacity: 0.25 + sheen.value * 0.35,
    transform: [{ scale: 0.95 + sheen.value * 0.08 }],
  }));

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, overlayStyle, { zIndex: 999 }]}
      pointerEvents={visible ? 'auto' : 'none'}
      testID="splash-intro"
    >
      <LinearGradient
        colors={['#0A1628', '#050A12', '#020509']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['transparent', 'rgba(212,175,55,0.06)', 'transparent']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[StyleSheet.absoluteFill, { opacity: 0.9 }]}
      />

      <Animated.View style={[styles.orbHalo, sheenStyle]}>
        <LinearGradient
          colors={['rgba(80,200,120,0.32)', 'rgba(212,175,55,0.12)', 'rgba(80,200,120,0)']}
          style={[StyleSheet.absoluteFill, { borderRadius: 280 }]}
        />
      </Animated.View>

      <View style={styles.horizon}>
        <View style={styles.horizonLine} />
      </View>

      <View style={styles.center}>
        <Animated.View style={logoStyle}>
          <View style={styles.logoStack}>
            <BrandOrb size={76} />
          </View>
        </Animated.View>

        <Animated.View entering={FadeIn.duration(800).delay(320)} style={{ marginTop: 22 }}>
          <Wordmark size="lg" showBilingualTagline />
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(700).delay(520)}>
          <Text style={styles.tagline}>{t('splash.tagline')}</Text>
        </Animated.View>
      </View>

      <Animated.View entering={FadeIn.duration(600).delay(800)} style={styles.footer}>
        <View style={styles.footerDot} />
        <Text style={styles.footerText}>{t('splash.footer')}</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  logoStack: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  orbHalo: {
    position: 'absolute',
    top: '28%',
    left: '50%',
    marginLeft: -280,
    marginTop: -280,
    width: 560,
    height: 560,
    overflow: 'hidden',
  },
  horizon: {
    position: 'absolute',
    top: '62%',
    left: 32,
    right: 32,
    alignItems: 'center',
  },
  horizonLine: {
    width: '100%',
    maxWidth: 200,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderGold,
  },
  tagline: {
    color: colors.textSubtle,
    fontSize: 9.5,
    letterSpacing: 2.8,
    fontWeight: typography.weight.medium,
    marginTop: 14,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  footer: {
    position: 'absolute',
    bottom: 56,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 10,
  },
  footerDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.emerald,
  },
  footerText: {
    color: colors.textSubtle,
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: typography.weight.medium,
  },
});
