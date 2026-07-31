import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeInDown, useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing,
} from 'react-native-reanimated';

import { GlassCard } from '@/src/components/GlassCard';
import type { CommandItem, CommandItemKind } from '@/src/utils/command-center';
import type { DecisionT } from '@/src/api/client';
import { colors, spacing, typography } from '@/src/theme';
import { useI18n } from '@/src/i18n';

const KIND_ICON: Record<CommandItemKind, keyof typeof Feather.glyphMap> = {
  reviewed: 'check-circle',
  found: 'zap',
  solved: 'shield',
  recommend: 'target',
  watching: 'eye',
};

const KIND_COLOR: Record<CommandItemKind, string> = {
  reviewed: colors.emerald,
  found: colors.gold,
  solved: colors.emerald,
  recommend: colors.gold,
  watching: colors.gold,
};

function LiveDot() {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [p]);
  const anim = useAnimatedStyle(() => ({
    opacity: 0.4 + p.value * 0.6,
    transform: [{ scale: 0.85 + p.value * 0.35 }],
  }));
  return (
    <Animated.View style={[styles.liveDot, anim]} />
  );
}

type Props = {
  greeting: string;
  lead: string;
  work: CommandItem[];
  recommendations: DecisionT[];
  ownerName?: string;
  onRecommend?: (d: DecisionT) => void;
  testID?: string;
};

/** Owner headquarters — SPP already worked; everything actionable. */
export function CommandCenter({
  greeting, lead, work, recommendations, ownerName, onRecommend, testID = 'command-center',
}: Props) {
  const { t, isRTL } = useI18n();
  const router = useRouter();

  const open = (item: CommandItem) => {
    Haptics.selectionAsync();
    if (item.propertyId) router.push(`/property/${item.propertyId}` as any);
    else if (item.route) router.push(item.route as any);
  };

  return (
    <Animated.View entering={FadeInDown.duration(650).delay(40)} testID={testID}>
      <GlassCard padding={26} radiusToken="lg" edge="gold" bright testID="command-center-card">
        <View style={styles.headRow}>
          <Text style={[styles.greeting, isRTL && styles.rtl]} testID="cmd-greeting">
            {greeting}{ownerName ? (isRTL ? `، ${ownerName}` : `, ${ownerName}`) : ''}.
          </Text>
          <View style={styles.liveChip}>
            <LiveDot />
            <Text style={styles.liveText}>{t('cmd.live')}</Text>
          </View>
        </View>

        <Text style={[styles.lead, isRTL && styles.rtl]}>{lead}</Text>

        <View style={styles.workList}>
          {work.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => open(item)}
              style={({ pressed }) => [styles.workRow, pressed && { opacity: 0.88 }]}
              testID={`cmd-work-${item.id}`}
            >
              <View style={[styles.iconWrap, { borderColor: KIND_COLOR[item.kind] + '44' }]}>
                <Feather name={KIND_ICON[item.kind]} size={14} color={KIND_COLOR[item.kind]} />
              </View>
              <Text style={[styles.workText, isRTL && styles.rtl]}>{item.text}</Text>
              {item.live ? <LiveDot /> : null}
              <Feather name={isRTL ? 'chevron-left' : 'chevron-right'} size={14} color={colors.textSubtle} />
            </Pressable>
          ))}
        </View>

        {recommendations.length > 0 ? (
          <View style={styles.recBlock}>
            <Text style={[styles.recTitle, isRTL && styles.rtl]}>{t('cmd.recommend.title')}</Text>
            {recommendations.slice(0, 3).map((d) => (
              <Pressable
                key={d.id}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onRecommend?.(d); }}
                style={({ pressed }) => [styles.recRow, pressed && { opacity: 0.85 }]}
                testID={`cmd-rec-${d.id}`}
              >
                <Feather name="arrow-up-right" size={13} color={colors.gold} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.recAction, isRTL && styles.rtl]} numberOfLines={2}>
                    {d.recommended_action || d.title}
                  </Text>
                  <Text style={[styles.recWhy, isRTL && styles.rtl]} numberOfLines={1}>{d.reason}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}
      </GlassCard>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  greeting: {
    flex: 1,
    color: colors.text,
    fontSize: 26,
    fontWeight: typography.weight.semibold,
    letterSpacing: typography.letter.tight,
    lineHeight: 34,
  },
  liveChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.emeraldEdge,
    backgroundColor: colors.emeraldSoft,
  },
  liveText: {
    color: colors.emerald, fontSize: 9, letterSpacing: 1.4,
    textTransform: 'uppercase', fontWeight: typography.weight.medium,
  },
  liveDot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: colors.emerald,
  },
  lead: {
    color: colors.textDim, fontSize: 15, lineHeight: 24,
    marginTop: spacing.sm, marginBottom: spacing.lg,
  },
  workList: { gap: 2 },
  workRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
  },
  iconWrap: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center', justifyContent: 'center',
  },
  workText: {
    flex: 1, fontSize: 15, lineHeight: 22,
    fontWeight: typography.weight.medium, color: colors.text,
  },
  recBlock: { marginTop: spacing.lg, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider },
  recTitle: {
    color: colors.gold, fontSize: 11, letterSpacing: 1.6,
    textTransform: 'uppercase', fontWeight: typography.weight.medium, marginBottom: spacing.sm,
  },
  recRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    paddingVertical: 10,
  },
  recAction: { color: colors.text, fontSize: 14, lineHeight: 20, fontWeight: typography.weight.semibold },
  recWhy: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
});
