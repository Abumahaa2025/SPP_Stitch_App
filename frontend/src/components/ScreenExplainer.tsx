import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { GlassCard } from '@/src/components/GlassCard';
import { colors, spacing, typography } from '@/src/theme';

type Props = {
  text: string;
  edge?: 'gold' | 'emerald' | 'neutral';
  delay?: number;
  testID?: string;
};

/** One-line screen purpose — mirrors Source web PAGE_META subtitles. */
export function ScreenExplainer({ text, edge = 'emerald', delay = 60, testID }: Props) {
  return (
    <Animated.View entering={FadeInDown.duration(550).delay(delay)} style={{ marginBottom: spacing.lg }}>
      <GlassCard padding={18} radiusToken="lg" edge={edge} testID={testID}>
        <View style={styles.row}>
          <View style={[styles.icon, edge === 'gold' ? styles.iconGold : styles.iconEmerald]}>
            <Feather name="info" size={14} color={edge === 'gold' ? colors.gold : colors.emerald} />
          </View>
          <Text style={styles.text}>{text}</Text>
        </View>
      </GlassCard>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  icon: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center', justifyContent: 'center',
  },
  iconEmerald: { borderColor: colors.emeraldEdge, backgroundColor: colors.emeraldSoft },
  iconGold: { borderColor: colors.goldEdge, backgroundColor: colors.goldSoft },
  text: { flex: 1, color: colors.textDim, fontSize: 14, lineHeight: 22 },
});
