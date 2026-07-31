import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter, useFocusEffect } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ScreenScaffold } from '@/src/components/ScreenScaffold';
import { StoryScreenHeader } from '@/src/components/StoryScreenHeader';
import { ScreenLoading } from '@/src/components/ScreenLoading';
import { AliveEmpty } from '@/src/components/AliveEmpty';
import { KpiStrip } from '@/src/components/KpiStrip';
import { GlassCard } from '@/src/components/GlassCard';
import { GuidedSetup } from '@/src/components/GuidedSetup';
import { SetupProgressBar } from '@/src/components/SetupProgressBar';
import { api, type PropertyT } from '@/src/api/client';
import { usePropertyOS } from '@/src/hooks/usePropertyOS';
import { useNotificationPrefs } from '@/src/hooks/usePreferences';
import { LocalPropertyCard } from '@/src/components/LocalSetupCards';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';

type Filter = 'all' | 'attention' | 'stable';

export default function Portfolio() {
  const { t } = useI18n();
  const router = useRouter();
  const { countEnabled } = useNotificationPrefs();
  const { state: osState, reload: reloadOS } = usePropertyOS(countEnabled);
  const [props, setProps] = useState<PropertyT[] | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  useFocusEffect(
    useCallback(() => {
      void reloadOS();
      api.properties().then(setProps).catch(() => setProps([]));
    }, [reloadOS]),
  );

  const list = props ?? [];
  const filtered = useMemo(() => {
    let items = list;
    if (filter === 'attention') items = list.filter((p) => p.health_score < 80);
    else if (filter === 'stable') items = list.filter((p) => p.health_score >= 80);
    return items.slice().sort((a, b) => a.health_score - b.health_score);
  }, [list, filter]);

  const chips: { key: Filter; label: string }[] = [
    { key: 'all', label: t('portfolio.filter.all') },
    { key: 'attention', label: t('portfolio.filter.attention') },
    { key: 'stable', label: t('portfolio.filter.stable') },
  ];

  const totalUnits = list.reduce((s, p) => s + p.units, 0);
  const avgOcc = list.length ? Math.round(list.reduce((s, p) => s + p.occupancy, 0) / list.length * 100) : 0;
  const loading = props === null;
  const hasLocal = Boolean(osState.property);
  const hasApi = list.length > 0;

  return (
    <ScreenScaffold testID="portfolio-screen">
      <StoryScreenHeader question={t('page.q.portfolio')} hint={t('portfolio.sub')} showBack testID="portfolio-header" />

      <SetupProgressBar testID="portfolio-setup-progress" />

      <GuidedSetup flowId="property" defaultOpen={!hasLocal && !hasApi} testID="portfolio-guided" />

      {loading ? (
        <ScreenLoading message={t('home.loading')} testID="portfolio-loading" />
      ) : !hasLocal && !hasApi ? (
        <AliveEmpty
          title={t('alive.portfolio.title')}
          body={t('alive.portfolio.body')}
          nextHint={t('pos.progress.nextLine' as any).replace('{next}', t('pos.phase.property' as any))}
          actionLabel={t('pos.portfolio.cta')}
          onAction={() => router.push('/setup/property-os' as any)}
          testID="portfolio-empty"
        />
      ) : (
        <>
          {hasLocal && osState.property ? (
            <View style={{ marginBottom: spacing.lg }}>
              <Pressable
                onPress={() => { Haptics.selectionAsync(); router.push('/operational/base?tab=properties' as any); }}
                testID="portfolio-ops-entry"
              >
                <LocalPropertyCard property={osState.property} units={osState.units} />
                <Text style={{ color: colors.gold, fontSize: 12, marginTop: 8 }}>
                  {t('op.owner.title')} →
                </Text>
              </Pressable>
            </View>
          ) : null}

          {hasApi ? (
            <>
              <KpiStrip
                items={[
                  { key: 'units', label: t('portfolio.kpi.units'), value: String(totalUnits) },
                  { key: 'occ', label: t('portfolio.kpi.occupancy'), value: `${avgOcc}%` },
                  { key: 'count', label: t('portfolio.kpi.units'), value: String(list.length) },
                ]}
                testID="portfolio-kpi"
              />

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}
                style={{ marginBottom: spacing.lg, marginHorizontal: -spacing.lg }}
              >
                {chips.map((c) => {
                  const active = c.key === filter;
                  return (
                    <Pressable
                      key={c.key}
                      testID={`filter-${c.key}`}
                      onPress={() => { Haptics.selectionAsync(); setFilter(c.key); }}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.label}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {filtered.length === 0 ? (
                <AliveEmpty
                  title={t('portfolio.filter.attention')}
                  body={t('alive.portfolio.body')}
                  testID="portfolio-filter-empty"
                />
              ) : (
                filtered.map((p, i) => (
                  <Animated.View key={p.id} entering={FadeInDown.duration(600).delay(60 * i)}>
                    <Pressable
                      testID={`prop-${p.id}`}
                      onPress={() => { Haptics.selectionAsync(); router.push(`/property/${p.id}` as any); }}
                    >
                      <GlassCard padding={0} radiusToken="lg" style={{ marginBottom: spacing.md }}>
                        <View style={styles.card}>
                          <Image source={{ uri: p.hero_image }} style={styles.image} contentFit="cover" transition={340} />
                          <View style={styles.imageOverlay} />
                          <View style={styles.imageGradient}>
                            <View style={styles.gradTop} />
                            <View style={styles.gradBottom} />
                          </View>
                          <View style={styles.imageContent}>
                            <Text style={styles.name}>{p.name}</Text>
                            <Text style={styles.city}>{p.city}</Text>
                            <View style={styles.metaRow}>
                              <Text style={styles.meta}>{p.units} {t('portfolio.kpi.units')}</Text>
                              <Text style={[styles.health, { color: p.health_score >= 85 ? colors.emerald : p.health_score >= 70 ? colors.gold : colors.danger }]}>
                                {p.health_score}
                              </Text>
                            </View>
                          </View>
                        </View>
                      </GlassCard>
                    </Pressable>
                  </Animated.View>
                ))
              )}
            </>
          ) : null}
        </>
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  chipRow: { gap: 8, paddingHorizontal: spacing.lg },
  chip: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  chipActive: { borderColor: colors.goldEdge, backgroundColor: colors.goldSoft },
  chipText: { color: colors.textDim, fontSize: 13, fontWeight: typography.weight.medium },
  chipTextActive: { color: colors.gold },
  card: { height: 220, borderRadius: radius.lg, overflow: 'hidden' },
  image: { ...StyleSheet.absoluteFillObject },
  imageOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.15)' },
  imageGradient: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between' },
  gradTop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.1)' },
  gradBottom: { height: '55%', backgroundColor: 'rgba(0,0,0,0.55)' },
  imageContent: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 20 },
  name: { color: colors.text, fontSize: 20, fontWeight: typography.weight.semibold, letterSpacing: typography.letter.tight },
  city: { color: colors.textDim, fontSize: 13, marginTop: 4 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  meta: { color: colors.textMuted, fontSize: 12 },
  health: { fontSize: 22, fontWeight: typography.weight.semibold, fontVariant: ['tabular-nums'] },
});
