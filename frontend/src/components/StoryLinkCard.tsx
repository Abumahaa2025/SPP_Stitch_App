import React from 'react';
import { Text, StyleSheet, Pressable, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { GlassCard } from '@/src/components/GlassCard';
import { colors, spacing, typography } from '@/src/theme';
import { useI18n } from '@/src/i18n';

type Props = {
  title: string;
  body?: string;
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  delay?: number;
  testID?: string;
  edge?: 'gold' | 'emerald' | 'neutral';
};

/** Single breathing-room card — one idea, one action. */
export function StoryLinkCard({ title, body, icon, onPress, delay = 0, testID, edge = 'neutral' }: Props) {
  const { isRTL } = useI18n();
  return (
    <Animated.View entering={FadeInDown.duration(550).delay(delay)}>
      <Pressable
        testID={testID}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}
      >
        <GlassCard padding={24} radiusToken="lg" edge={edge}>
          <View style={styles.row}>
            <View style={styles.icon}>
              <Feather name={icon} size={18} color={colors.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, isRTL && styles.rtl]}>{title}</Text>
              {body ? <Text style={[styles.body, isRTL && styles.rtl]}>{body}</Text> : null}
            </View>
            <Feather name={isRTL ? 'chevron-left' : 'chevron-right'} size={18} color={colors.textMuted} />
          </View>
        </GlassCard>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  icon: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.goldEdge,
    backgroundColor: colors.goldSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  title: {
    color: colors.text,
    fontSize: 17,
    fontWeight: typography.weight.semibold,
    letterSpacing: typography.letter.tight,
    lineHeight: 24,
  },
  body: {
    color: colors.textDim,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 6,
  },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
});
