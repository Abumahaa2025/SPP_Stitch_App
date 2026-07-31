import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { GlassCard } from '@/src/components/GlassCard';
import { PressableScale } from '@/src/components/ui/PressableScale';
import { AppIcon } from '@/src/components/ui/AppIcon';
import type { NextAction } from '@/src/api/portfolio-analysis';
import { colors, spacing, typography } from '@/src/theme';
import { useI18n } from '@/src/i18n';

type Props = {
  actions: NextAction[];
  message: string;
  delay?: number;
  /** Optional handler — keeps UI unchanged; wires engine actions without new pages */
  onAction?: (key: string) => void;
};

const ACTION_LABELS: Record<string, { en: string; ar: string }> = {
  update_portfolio: { en: 'Update portfolio', ar: 'تحديث المحفظة' },
  send_alerts: { en: 'Send alerts', ar: 'إرسال التنبيهات' },
  create_pdf: { en: 'Create PDF report', ar: 'إنشاء تقرير PDF' },
  compare_months: { en: 'Compare months', ar: 'مقارنة الأشهر' },
  profit_analysis: { en: 'Profit analysis', ar: 'تحليل الأرباح' },
  forecast_expenses: { en: 'Forecast expenses', ar: 'توقع المصروفات' },
  show_risks: { en: 'Show risks', ar: 'عرض المخاطر' },
  improvement_plan: { en: 'Improvement plan', ar: 'خطة تحسين' },
};

/** Phase 5 — what should I do now? */
export function UploadNextActions({ actions, message, delay = 360, onAction }: Props) {
  const { lang, isRTL } = useI18n();
  const router = useRouter();

  return (
    <Animated.View entering={FadeInDown.duration(550).delay(delay)} style={styles.wrap}>
      <Text style={[styles.question, isRTL && styles.rtl]}>{message}</Text>
      <View style={styles.grid}>
        {actions.map((a) => {
          const label = ACTION_LABELS[a.key]?.[lang] ?? a.key;
          return (
            <PressableScale
              key={a.key}
              style={styles.tile}
              onPress={() => {
                Haptics.selectionAsync();
                if (onAction) {
                  onAction(a.key);
                  return;
                }
                router.push(a.route as never);
              }}
            >
              <GlassCard padding={14} radiusToken="md">
                <AppIcon name={a.icon as 'database'} size="sm" accent="gold" />
                <Text style={[styles.label, isRTL && styles.rtl]} numberOfLines={2}>{label}</Text>
              </GlassCard>
            </PressableScale>
          );
        })}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.lg, marginBottom: spacing.xl },
  question: {
    color: colors.text, fontSize: 16, fontWeight: typography.weight.semibold,
    marginBottom: spacing.md,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: { width: '48%' },
  label: { color: colors.textDim, fontSize: 12, marginTop: 10, lineHeight: 17 },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
});
