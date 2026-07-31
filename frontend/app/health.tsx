import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { ScreenScaffold } from '@/src/components/ScreenScaffold';
import { StoryScreenHeader } from '@/src/components/StoryScreenHeader';
import { ScreenLoading } from '@/src/components/ScreenLoading';
import { AliveEmpty } from '@/src/components/AliveEmpty';
import { GlassCard } from '@/src/components/GlassCard';
import { api, type PropertyT } from '@/src/api/client';
import { fetchExecutiveCached } from '@/src/api/executive-cache';
import { kpisFromExecutive } from '@/src/api/executive-map';
import type { Executive } from '@/src/api/executive';
import { colors, spacing, typography } from '@/src/theme';
import { useI18n } from '@/src/i18n';

export default function Health() {
  const { t } = useI18n();
  const router = useRouter();
  const [exec, setExec] = useState<Executive | null | undefined>(undefined);
  const [props, setProps] = useState<PropertyT[] | null>(null);

  useEffect(() => {
    fetchExecutiveCached().then(setExec).catch(() => setExec(null));
    api.properties().then(setProps).catch(() => setProps([]));
  }, []);

  const loading = exec === undefined || props === null;
  const kpis = exec ? kpisFromExecutive(exec) : null;
  const avgHealth = kpis?.avg_health ?? 0;
  const sorted = (props ?? []).slice().sort((a, z) => z.health_score - a.health_score);

  const caption = !exec || !props?.length
    ? t('alive.health.empty')
    : avgHealth >= 85 ? t('health.excellent')
      : avgHealth >= 70 ? t('health.stable')
        : t('health.attention');

  return (
    <ScreenScaffold testID="health-screen">
      <StoryScreenHeader question={t('page.q.health')} hint={t('health.sub')} showBack testID="health-header" />

      {loading ? (
        <ScreenLoading message={t('alive.health.title')} testID="health-loading" />
      ) : !props?.length ? (
        <AliveEmpty
          title={t('alive.health.empty')}
          body={t('alive.health.body')}
          actionLabel={t('alive.portfolio.action')}
          onAction={() => router.push('/upload')}
          testID="health-empty"
        />
      ) : (
        <>
          <Animated.View entering={FadeInDown.duration(650)}>
            <GlassCard padding={28} radiusToken="lg" edge="emerald" testID="health-answer-card">
              <Text style={styles.answerText}>{caption}</Text>
              <Text style={styles.answerMeta}>
                {t('home.health.properties').replace('{count}', String(props.length))}
                {' · '}
                {t('insights.occupancy')} {kpis?.occupancy ?? 0}%
              </Text>
            </GlassCard>
          </Animated.View>

          <View style={{ marginTop: spacing['2xl'], gap: spacing.md }}>
            {sorted.map((p, i) => (
              <Animated.View key={p.id} entering={FadeInDown.duration(600).delay(80 * i)}>
                <Pressable
                  testID={`health-row-${p.id}`}
                  onPress={() => { Haptics.selectionAsync(); router.push(`/property/${p.id}` as any); }}
                >
                  <GlassCard padding={20} radiusToken="lg">
                    <View style={styles.row}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.name}>{p.name}</Text>
                        <Text style={styles.city}>{p.city}</Text>
                      </View>
                      <View style={styles.scoreWrap}>
                        <Text style={[styles.score, { color: p.health_score >= 85 ? colors.emerald : p.health_score >= 70 ? colors.gold : colors.danger }]}>
                          {p.health_score}
                        </Text>
                        <Feather name="chevron-right" size={14} color={colors.textMuted} />
                      </View>
                    </View>
                    <View style={styles.bar}>
                      <View style={[styles.barFill, { width: `${p.health_score}%`, backgroundColor: p.health_score >= 85 ? colors.emerald : p.health_score >= 70 ? colors.gold : colors.danger }]} />
                    </View>
                  </GlassCard>
                </Pressable>
              </Animated.View>
            ))}
          </View>
        </>
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  answerText: {
    color: colors.text,
    fontSize: 22,
    fontWeight: typography.weight.semibold,
    lineHeight: 32,
    letterSpacing: typography.letter.tight,
  },
  answerMeta: {
    color: colors.textDim,
    fontSize: 14,
    lineHeight: 22,
    marginTop: spacing.md,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  name: { color: colors.text, fontSize: 16, fontWeight: typography.weight.semibold, letterSpacing: typography.letter.tight },
  city: { color: colors.textMuted, fontSize: 13, marginTop: 3 },
  scoreWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  score: { fontSize: 24, fontWeight: typography.weight.semibold, fontVariant: ['tabular-nums'] },
  bar: { height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.04)', marginTop: 16, overflow: 'hidden' },
  barFill: { height: 3, borderRadius: 2 },
});
