import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { GlassCard } from '@/src/components/GlassCard';
import { PressableScale } from '@/src/components/ui/PressableScale';
import { AppIcon } from '@/src/components/ui/AppIcon';
import type { PortfolioAnalysis } from '@/src/api/portfolio-analysis';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';

type Props = {
  analysis: PortfolioAnalysis;
  onChoice: (key: 'update' | 'review' | 'cancel') => void;
  delay?: number;
};

/** Phase 3 — portfolio update prompt (no auto-save). */
export function UploadPortfolioPrompt({ analysis, onChoice, delay = 200 }: Props) {
  const { isRTL } = useI18n();

  return (
    <Animated.View entering={FadeInDown.duration(550).delay(delay)} style={styles.wrap}>
      <GlassCard padding={22} radiusToken="lg" edge="emerald">
        <View style={[styles.successRow, isRTL && styles.rowRtl]}>
          <AppIcon name="check-circle" size="md" accent="emerald" />
          <Text style={[styles.success, isRTL && styles.rtl]}>{analysis.success_message}</Text>
        </View>
        <Text style={[styles.prompt, isRTL && styles.rtl]}>{analysis.prompt_message}</Text>
        <View style={styles.options}>
          {analysis.prompt_options.map((opt) => (
            <PressableScale
              key={opt.key}
              onPress={() => {
                Haptics.selectionAsync();
                onChoice(opt.key as 'update' | 'review' | 'cancel');
              }}
              style={[
                styles.optBtn,
                opt.key === 'update' && styles.optPrimary,
                opt.key === 'cancel' && styles.optGhost,
              ]}
            >
              <Text
                style={[
                  styles.optText,
                  opt.key === 'update' && styles.optTextPrimary,
                  opt.key === 'cancel' && styles.optTextGhost,
                ]}
              >
                {opt.label}
              </Text>
            </PressableScale>
          ))}
        </View>
      </GlassCard>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.lg },
  successRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  rowRtl: { flexDirection: 'row-reverse' },
  success: { color: colors.emerald, fontSize: 15, fontWeight: typography.weight.semibold, flex: 1 },
  prompt: { color: colors.textDim, fontSize: 14, lineHeight: 22, marginBottom: 16 },
  options: { gap: 10 },
  optBtn: {
    paddingVertical: 14, paddingHorizontal: 16, borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)', alignItems: 'center',
  },
  optPrimary: { backgroundColor: colors.emerald, borderColor: colors.emeraldEdge },
  optGhost: { backgroundColor: 'transparent' },
  optText: { color: colors.text, fontSize: 14, fontWeight: typography.weight.medium },
  optTextPrimary: { color: colors.bg, fontWeight: typography.weight.semibold },
  optTextGhost: { color: colors.textMuted },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
});
