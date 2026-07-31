import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { GlassCard } from '@/src/components/GlassCard';
import { AppIcon } from '@/src/components/ui/AppIcon';
import { PressableScale } from '@/src/components/ui/PressableScale';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';
import { usePropertyOS } from '@/src/hooks/usePropertyOS';
import { useNotificationPrefs } from '@/src/hooks/usePreferences';
import { dailyOpsSuggestions } from '@/src/utils/daily-ops-engine';

const PROMPT_KEYS = [
  'os.ask.health',
  'os.ask.attention',
  'os.ask.invoice',
  'os.ask.opportunities',
] as const;

type Props = {
  delay?: number;
  testID?: string;
};

/** Center of the OS — ask anything, meet your executive. */
export function ExecutiveAskBar({ delay = 80, testID = 'executive-ask-bar' }: Props) {
  const { t, isRTL, lang } = useI18n();
  const router = useRouter();
  const { countEnabled } = useNotificationPrefs();
  const { state: osState } = usePropertyOS(countEnabled);
  const dailyMode = Boolean(osState.property && osState.units.length > 0);
  const promptLabels = dailyMode
    ? dailyOpsSuggestions(osState, lang).slice(0, 4)
    : PROMPT_KEYS.map((k) => t(k));

  const open = (prefill?: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: '/brain', params: prefill ? { q: prefill } : {} } as any);
  };

  return (
    <Animated.View entering={FadeInDown.duration(600).delay(delay)} testID={testID}>
      <PressableScale onPress={() => open()}>
        <GlassCard padding={22} radiusToken="lg" edge="gold">
          <View style={styles.row}>
            <View style={styles.orb}>
              <Text style={styles.orbEmoji}>🤖</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, isRTL && styles.rtl]}>{t('os.ask.title')}</Text>
              <Text style={[styles.hint, isRTL && styles.rtl]} numberOfLines={2}>{t('os.ask.hintShort')}</Text>
            </View>
            <AppIcon name={isRTL ? 'chevron-left' : 'chevron-right'} size="lg" accent="gold" />
          </View>
        </GlassCard>
      </PressableScale>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        style={{ marginTop: spacing.md }}
      >
        {promptLabels.map((label, i) => (
          <PressableScale
            key={`${label}-${i}`}
            onPress={() => open(label)}
            style={styles.chip}
            testID={`ask-prompt-${i}`}
            scaleTo={0.96}
          >
            <Text style={[styles.chipText, isRTL && styles.rtl]} numberOfLines={1}>{label}</Text>
          </PressableScale>
        ))}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  orb: {
    width: 48, height: 48, borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.goldEdge,
    backgroundColor: colors.goldSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  orbEmoji: { fontSize: 24 },
  title: {
    color: colors.text,
    fontSize: 17,
    fontWeight: typography.weight.semibold,
    letterSpacing: typography.letter.tight,
  },
  hint: { color: colors.textDim, fontSize: typography.small, lineHeight: 22, marginTop: 4 },
  chips: { gap: 8, paddingRight: spacing.lg },
  chip: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
    maxWidth: 260,
  },
  chipText: { color: colors.textDim, fontSize: typography.small, lineHeight: 20 },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
});
