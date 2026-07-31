import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { ScreenScaffold } from '@/src/components/ScreenScaffold';
import { StoryScreenHeader } from '@/src/components/StoryScreenHeader';
import { ScreenLoading } from '@/src/components/ScreenLoading';
import { AliveEmpty } from '@/src/components/AliveEmpty';
import { GlassCard } from '@/src/components/GlassCard';
import { IntelligenceInsightsSection } from '@/src/components/IntelligenceInsightsSection';
import { api, type PropertyT } from '@/src/api/client';
import type { IntelligenceInsight } from '@/src/api/intelligence';
import { fetchExecutiveCached } from '@/src/api/executive-cache';
import { kpisFromExecutive } from '@/src/api/executive-map';
import type { Executive } from '@/src/api/executive';
import { colors, spacing, typography } from '@/src/theme';
import { useI18n } from '@/src/i18n';

const fmtCurrency = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1000).toFixed(0)}K`;
  return `${n}`;
};

export default function Insights() {
  const { t } = useI18n();
  const router = useRouter();
  const [exec, setExec] = useState<Executive | null | undefined>(undefined);
  const [props, setProps] = useState<PropertyT[] | null>(null);
  const [insights, setInsights] = useState<IntelligenceInsight[]>([]);

  useEffect(() => {
    fetchExecutiveCached().then(setExec).catch(() => setExec(null));
    api.properties().then(setProps).catch(() => setProps([]));
    api.intelligence().then((r) => setInsights(r.insights)).catch(() => {});
  }, []);

  const loading = exec === undefined || props === null;
  const kpis = exec ? kpisFromExecutive(exec) : null;
  const bars = (props ?? []).slice().sort((a, z) => z.monthly_revenue - a.monthly_revenue);
  const maxRev = Math.max(1, ...bars.map((p) => p.monthly_revenue));

  return (
    <ScreenScaffold testID="insights-screen">
      <StoryScreenHeader question={t('page.q.insights')} hint={t('insights.sub')} showBack testID="insights-header" />

      {loading ? (
        <ScreenLoading message={t('home.loading')} testID="insights-loading" />
      ) : !props?.length ? (
        <AliveEmpty
          title={t('alive.insights.title')}
          body={t('alive.insights.body')}
          actionLabel={t('alive.portfolio.action')}
          onAction={() => router.push('/upload')}
          testID="insights-empty"
        />
      ) : (
        <>
          <Animated.View entering={FadeInDown.duration(550)}>
            <GlassCard padding={24} radiusToken="lg" edge="gold">
              <Text style={styles.summaryLine}>
                {t('common.currency')} {fmtCurrency(kpis?.portfolio_annual_revenue ?? 0)}
                {' · '}
                {t('insights.occupancy')} {kpis?.occupancy ?? 0}%
              </Text>
            </GlassCard>
          </Animated.View>

          <IntelligenceInsightsSection insights={insights.slice(0, 3)} delay={80} prominent />

          {!insights.length ? (
            <AliveEmpty
              title={t('alive.intelligence.title')}
              body={t('alive.intelligence.body')}
              testID="insights-no-discoveries"
            />
          ) : null}

          {bars.length > 0 ? (
            <Animated.View entering={FadeInDown.duration(650).delay(140)} style={{ marginTop: spacing.xl }}>
              <GlassCard padding={24} radiusToken="lg">
                <Text style={styles.sectionTitle}>{t('insights.revenueByProp')}</Text>
                <View style={{ marginTop: spacing.lg, gap: 18 }}>
                  {bars.map((p) => {
                    const w = (p.monthly_revenue / maxRev) * 100;
                    return (
                      <Pressable
                        key={p.id}
                        onPress={() => { Haptics.selectionAsync(); router.push(`/property/${p.id}` as any); }}
                      >
                        <Text style={styles.propName}>{p.name}</Text>
                        <View style={styles.bar}>
                          <View style={[styles.barFill, { width: `${w}%` }]} />
                        </View>
                        <Text style={styles.revText}>{t('common.currency')} {fmtCurrency(p.monthly_revenue)}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </GlassCard>
            </Animated.View>
          ) : null}
        </>
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  summaryLine: {
    color: colors.text,
    fontSize: 17,
    fontWeight: typography.weight.semibold,
    lineHeight: 26,
    textAlign: 'center',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: typography.weight.semibold,
    letterSpacing: typography.letter.tight,
  },
  propName: { color: colors.text, fontSize: 14, fontWeight: typography.weight.medium, marginBottom: 8 },
  bar: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  barFill: { height: 4, borderRadius: 2, backgroundColor: colors.gold },
  revText: { color: colors.textMuted, fontSize: 12, marginTop: 6 },
});
