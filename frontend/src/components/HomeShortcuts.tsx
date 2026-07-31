import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { HOME_SHORTCUTS, type HomeShortcut } from '@/src/data/home-directory';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';

type Props = {
  onScrollToPriorities?: () => void;
  delay?: number;
  testID?: string;
  /** Figma UX reorg — allow a curated subset (dashboard quick-access strip). */
  items?: HomeShortcut[];
  /** Hide subtitle — Figma dashboard strip uses title only. */
  compact?: boolean;
};

export function HomeShortcuts({
  onScrollToPriorities,
  delay = 100,
  testID = 'home-shortcuts',
  items,
  compact = false,
}: Props) {
  const { t, isRTL } = useI18n();
  const router = useRouter();

  return (
    <Animated.View entering={FadeInDown.duration(600).delay(delay)} style={styles.wrap} testID={testID}>
      <Text style={[styles.title, isRTL && styles.rtl]}>{t('org.shortcuts.title')}</Text>
      {!compact ? (
        <Text style={[styles.sub, isRTL && styles.rtl]}>{t('org.shortcuts.sub')}</Text>
      ) : (
        <View style={styles.compactGap} />
      )}
      <View style={[styles.grid, isRTL && styles.gridRtl]}>
        {(items ?? HOME_SHORTCUTS).map((sc) => {
          const accent = sc.accent === 'emerald' ? colors.emerald : colors.gold;
          return (
            <Pressable
              key={sc.key}
              testID={`shortcut-${sc.key}`}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                if (sc.anchor === 'priorities') {
                  onScrollToPriorities?.();
                  return;
                }
                if (sc.route) router.push(sc.route as any);
              }}
              style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
            >
              {/* Figma: gold outline icon directly on dark card — no icon circle. */}
              <Feather name={sc.icon} size={20} color={accent} />
              <Text style={[styles.label, isRTL && styles.rtl]} numberOfLines={2}>
                {t(sc.labelKey as 'org.short.today')}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.xl },
  title: {
    color: colors.text, fontSize: 15, fontWeight: typography.weight.semibold,
    letterSpacing: typography.letter.tight,
  },
  sub: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 4, marginBottom: spacing.md },
  compactGap: { height: spacing.sm },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridRtl: { flexDirection: 'row-reverse' },
  tile: {
    width: '23%',
    minWidth: 72,
    flexGrow: 1,
    alignItems: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 6,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.025)',
  },
  tilePressed: { backgroundColor: 'rgba(255,255,255,0.05)' },
  label: {
    color: colors.text, fontSize: 11, lineHeight: 15,
    textAlign: 'center', fontWeight: typography.weight.medium,
  },
});
