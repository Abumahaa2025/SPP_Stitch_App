import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { GlassCard } from '@/src/components/GlassCard';
import type { DailyStoryItem, StoryIcon } from '@/src/utils/daily-story';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';

const ICON_MAP: Record<StoryIcon, keyof typeof Feather.glyphMap> = {
  contract: 'file-text',
  maintenance: 'tool',
  collection: 'percent',
  opportunity: 'trending-up',
  sensor: 'activity',
  spark: 'zap',
};

const TONE_COLOR: Record<string, string> = {
  attention: colors.gold,
  neutral: colors.textDim,
  positive: colors.emerald,
  opportunity: colors.gold,
};

type Props = {
  greeting: string;
  intro: string;
  items: DailyStoryItem[];
  ownerName?: string;
  testID?: string;
};

export function DailyStory({ greeting, intro, items, ownerName, testID = 'daily-story' }: Props) {
  const { isRTL } = useI18n();
  const router = useRouter();

  const open = (item: DailyStoryItem) => {
    Haptics.selectionAsync();
    if (item.propertyId) router.push(`/property/${item.propertyId}` as any);
    else if (item.route) router.push(item.route as any);
  };

  return (
    <Animated.View entering={FadeInDown.duration(700).delay(60)} testID={testID}>
      <GlassCard padding={26} radiusToken="lg" edge="gold" testID="daily-story-card">
        <Text style={[styles.greeting, isRTL && styles.rtl]} testID="story-greeting">
          {greeting}{ownerName ? `، ${ownerName}` : ''}.
        </Text>
        <Text style={[styles.intro, isRTL && styles.rtl]}>{intro}</Text>

        <View style={styles.list}>
          {items.map((item, i) => (
            <Pressable
              key={item.id}
              onPress={() => open(item)}
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
              testID={`story-item-${item.id}`}
            >
              <View style={[styles.bullet, { borderColor: TONE_COLOR[item.tone] + '55' }]}>
                <Feather name={ICON_MAP[item.icon]} size={13} color={TONE_COLOR[item.tone]} />
              </View>
              <Text style={[styles.itemText, isRTL && styles.rtl, { color: TONE_COLOR[item.tone] ?? colors.text }]}>
                {item.text}
              </Text>
              <Feather
                name={isRTL ? 'chevron-left' : 'chevron-right'}
                size={14}
                color={colors.textSubtle}
              />
            </Pressable>
          ))}
        </View>

        {items.length === 0 ? (
          <Text style={[styles.empty, isRTL && styles.rtl]}>{/* filled by parent if needed */}</Text>
        ) : null}
      </GlassCard>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  greeting: {
    color: colors.text,
    fontSize: 26,
    fontWeight: typography.weight.semibold,
    letterSpacing: typography.letter.tight,
    lineHeight: 34,
  },
  intro: {
    color: colors.textDim,
    fontSize: 15,
    lineHeight: 24,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  list: { gap: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  bullet: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: typography.weight.medium,
  },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  empty: { color: colors.textMuted, fontSize: 14, marginTop: spacing.md },
});
