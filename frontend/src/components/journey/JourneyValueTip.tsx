import React, { useEffect, useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { GlassCard } from '@/src/components/GlassCard';
import { colors, typography } from '@/src/theme';
import { useI18n } from '@/src/i18n';

const TIPS = ['journey.value.1', 'journey.value.2', 'journey.value.3', 'journey.value.4'] as const;

export function JourneyValueTip({ testID = 'journey-value-tip' }: { testID?: string }) {
  const { t, isRTL } = useI18n();
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % TIPS.length), 8000);
    return () => clearInterval(id);
  }, []);

  return (
    <Animated.View entering={FadeIn.duration(400)} testID={testID}>
      <GlassCard padding={14} radiusToken="md" edge="gold">
        <Text style={[styles.text, isRTL && styles.rtl]}>✓ {t(TIPS[idx])}</Text>
      </GlassCard>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  text: { color: colors.textDim, fontSize: typography.small, lineHeight: 20 },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
});
