import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { GlassCard } from '@/src/components/GlassCard';
import { AliveEmpty } from '@/src/components/AliveEmpty';
import type { IntelligenceInsight } from '@/src/api/intelligence';
import { colors, spacing, typography } from '@/src/theme';
import { useI18n } from '@/src/i18n';

const PRIORITY_EDGE: Record<string, 'gold' | 'emerald' | 'neutral'> = {
  critical: 'gold',
  high: 'gold',
  medium: 'neutral',
  low: 'emerald',
};

type Props = {
  insights: IntelligenceInsight[];
  delay?: number;
  prominent?: boolean;
};

export function IntelligenceInsightsSection({ insights, delay = 200, prominent }: Props) {
  const { t, isRTL } = useI18n();
  const router = useRouter();

  const go = (ins: IntelligenceInsight) => {
    Haptics.selectionAsync();
    if (ins.property_id) router.push(`/property/${ins.property_id}` as any);
    else if (ins.route) router.push(ins.route as any);
    else router.push('/maintenance');
  };

  if (!insights.length) {
    return (
      <Animated.View entering={FadeInDown.duration(650).delay(delay)} style={{ marginTop: spacing.lg }} testID="intelligence-section">
        <AliveEmpty
          title={t('alive.intelligence.title')}
          body={t('alive.intelligence.body')}
        />
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeInDown.duration(650).delay(delay)} style={{ marginTop: spacing.md }} testID="intelligence-section">
      <View style={{ gap: spacing.md }}>
        {insights.map((ins, i) => (
          <Animated.View key={ins.id} entering={FadeInDown.duration(600).delay(delay + 60 * i)}>
            <Pressable onPress={() => go(ins)}>
              <GlassCard
                padding={prominent ? 24 : 20}
                radiusToken="lg"
                edge={PRIORITY_EDGE[ins.priority] ?? 'neutral'}
                testID={`intelligence-insight-${ins.id}`}
              >
                <Text style={[styles.headline, isRTL && styles.rtl]}>{ins.headline}</Text>
                <Text style={[styles.body, isRTL && styles.rtl]}>{ins.why}</Text>

                <View style={styles.actionRow}>
                  <Feather name="check-circle" size={14} color={colors.gold} />
                  <Text style={[styles.action, isRTL && styles.rtl]}>{ins.action}</Text>
                </View>

                {ins.impact ? (
                  <Text style={[styles.impact, isRTL && styles.rtl]}>
                    {t('intelligence.impactPrefix')} {ins.impact}
                  </Text>
                ) : null}

                <View style={styles.footer}>
                  <Text style={styles.confidence}>
                    {t('intelligence.confidenceShort').replace('{n}', String(ins.confidence))}
                  </Text>
                  <Feather name={isRTL ? 'arrow-left' : 'arrow-right'} size={14} color={colors.gold} />
                </View>
              </GlassCard>
            </Pressable>
          </Animated.View>
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  prominentLead: {
    color: colors.textDim,
    fontSize: 15,
    lineHeight: 24,
    marginBottom: spacing.md,
  },
  headline: {
    color: colors.text,
    fontSize: 17,
    fontWeight: typography.weight.semibold,
    lineHeight: 26,
    letterSpacing: typography.letter.tight,
  },
  body: {
    color: colors.textDim,
    fontSize: 14,
    lineHeight: 22,
    marginTop: 10,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  action: {
    flex: 1,
    color: colors.gold,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: typography.weight.medium,
  },
  impact: {
    color: colors.emerald,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
  },
  confidence: {
    color: colors.textSubtle,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  empty: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 22,
  },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
});
