import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';

import { GlassCard } from '@/src/components/GlassCard';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';

type Props = {
  onServices: () => void;
  onUpload: () => void;
  onDaily: () => void;
  testID?: string;
};

const CHECKS = ['journey.launch.k1', 'journey.launch.k2', 'journey.launch.k3', 'journey.launch.k4'] as const;

export function JourneyLaunchComplete({ onServices, onUpload, onDaily, testID = 'journey-launch' }: Props) {
  const { t, isRTL } = useI18n();

  const choices = [
    { key: 'services', label: t('journey.launch.services'), icon: 'zap' as const, onPress: onServices },
    { key: 'upload', label: t('journey.launch.upload'), icon: 'upload' as const, onPress: onUpload },
    { key: 'daily', label: t('journey.launch.daily'), icon: 'home' as const, onPress: onDaily },
  ];

  return (
    <Animated.View entering={FadeInDown.duration(600)} testID={testID}>
      <GlassCard padding={28} radiusToken="lg" edge="emerald">
        <Text style={styles.emoji}>🎉</Text>
        <Text style={[styles.title, isRTL && styles.rtl]}>{t('journey.launch.title')}</Text>
        <Text style={[styles.lead, isRTL && styles.rtl]}>{t('journey.launch.lead')}</Text>
        {CHECKS.map((k) => (
          <Text key={k} style={[styles.check, isRTL && styles.rtl]}>✓ {t(k)}</Text>
        ))}
        <Text style={[styles.ask, isRTL && styles.rtl]}>{t('journey.launch.ask')}</Text>
        <View style={styles.choices}>
          {choices.map((c) => (
            <Pressable
              key={c.key}
              style={[styles.choice, isRTL && styles.rowRtl]}
              testID={`${testID}-${c.key}`}
              onPress={() => { Haptics.selectionAsync(); c.onPress(); }}
            >
              <Feather name={c.icon} size={16} color={colors.gold} />
              <Text style={[styles.choiceText, isRTL && styles.rtl]}>{c.label}</Text>
            </Pressable>
          ))}
        </View>
      </GlassCard>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  emoji: { fontSize: 40, textAlign: 'center', marginBottom: spacing.sm },
  title: {
    color: colors.text, fontSize: 22, fontWeight: typography.weight.semibold, textAlign: 'center',
  },
  lead: { color: colors.textDim, fontSize: 14, marginTop: 10, textAlign: 'center' },
  check: { color: colors.text, fontSize: 14, lineHeight: 24, marginTop: 6 },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  ask: {
    color: colors.textMuted, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase',
    marginTop: spacing.lg, marginBottom: spacing.sm, textAlign: 'center',
  },
  choices: { gap: 8 },
  choice: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 14, paddingHorizontal: 16, borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  rowRtl: { flexDirection: 'row-reverse' },
  choiceText: { color: colors.text, fontSize: 14, fontWeight: typography.weight.medium, flex: 1 },
});
