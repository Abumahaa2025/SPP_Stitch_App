import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams } from 'expo-router';

import { ScreenScaffold } from '@/src/components/ScreenScaffold';
import { StoryScreenHeader } from '@/src/components/StoryScreenHeader';
import { GlassCard } from '@/src/components/GlassCard';
import { AliveEmpty } from '@/src/components/AliveEmpty';
import { BrainVerdict } from '@/src/components/BrainVerdict';
import { GuidedSetup } from '@/src/components/GuidedSetup';
import { api, type PropertyT, type SensorT } from '@/src/api/client';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';

const iconOf: Record<string, keyof typeof Feather.glyphMap> = {
  temperature: 'thermometer',
  humidity: 'droplet',
  leak: 'droplet',
  energy: 'zap',
  occupancy: 'users',
  air_quality: 'wind',
};

type Filter = 'all' | 'attention' | 'nominal';

function utilityTypes(utility?: string | string[]): Set<string> | null {
  const u = Array.isArray(utility) ? utility[0] : utility;
  if (u === 'electricity') return new Set(['energy']);
  if (u === 'water') return new Set(['humidity', 'leak']);
  return null;
}

export default function Sensors() {
  const { t } = useI18n();
  const params = useLocalSearchParams<{ utility?: string }>();
  const utilityFilter = utilityTypes(params.utility);
  const [sensors, setSensors] = useState<SensorT[]>([]);
  const [props, setProps] = useState<PropertyT[]>([]);
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    api.sensors().then(setSensors);
    api.properties().then(setProps);
  }, []);

  const propMap = useMemo(() => {
    const m = new Map<string, PropertyT>();
    props.forEach((p) => m.set(p.id, p));
    return m;
  }, [props]);

  const filtered = useMemo(() => {
    let list = sensors;
    if (utilityFilter) {
      list = list.filter((s) => utilityFilter.has(String(s.kind || '').toLowerCase()));
    }
    if (filter === 'attention') return list.filter((s) => s.status !== 'nominal');
    if (filter === 'nominal') return list.filter((s) => s.status === 'nominal');
    return list;
  }, [sensors, filter, utilityFilter]);

  return (
    <ScreenScaffold testID="sensors-screen">
      <StoryScreenHeader question={t('page.q.sensors')} hint={t('sensors.explain')} showBack testID="sensors-header" />

      <GuidedSetup flowId="virtualSensors" defaultOpen={sensors.length === 0} testID="sensors-guided" />

      <BrainVerdict screen="sensors" />

      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
        style={{ marginBottom: spacing.lg, marginHorizontal: -spacing.lg }}
      >
        {(['all', 'attention', 'nominal'] as Filter[]).map((f) => {
          const active = f === filter;
          const labelKey = f === 'all' ? 'sensors.filter.all' : f === 'attention' ? 'sensors.filter.attention' : 'sensors.filter.nominal';
          return (
            <Pressable
              key={f}
              testID={`sfilter-${f}`}
              onPress={() => { Haptics.selectionAsync(); setFilter(f); }}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{t(labelKey)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.grid}>
        {filtered.length === 0 ? (
          <View style={{ width: '100%' }}>
            <AliveEmpty title={t('alive.sensors.title')} body={t('alive.sensors.body')} />
          </View>
        ) : null}
        {filtered.map((s, i) => {
          const c = s.status === 'nominal' ? colors.emerald : s.status === 'attention' ? colors.gold : colors.danger;
          const iconName = iconOf[s.kind] ?? 'activity';
          const prop = propMap.get(s.property_id);
          return (
            <Animated.View key={s.id} entering={FadeInDown.duration(600).delay(60 * i)} style={styles.gridItem}>
              <GlassCard padding={18} radiusToken="lg">
                <View style={styles.tileTop}>
                  <View style={[styles.iconWrap, { borderColor: c + '55', backgroundColor: c + '18' }]}>
                    <Feather name={iconName} size={14} color={c} />
                  </View>
                  <View style={[styles.statusDot, { backgroundColor: c }]} />
                </View>
                <Text style={styles.label}>{s.label}</Text>
                <View style={styles.valueRow}>
                  <Text style={styles.value}>{s.value}</Text>
                  {s.unit ? <Text style={styles.unit}>{s.unit}</Text> : null}
                </View>
                <Text style={styles.property}>{prop?.name ?? ''}</Text>
              </GlassCard>
            </Animated.View>
          );
        })}
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  chipRow: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  chip: {
    height: 36, borderRadius: radius.pill, paddingHorizontal: 16,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  chipActive: { borderColor: colors.goldEdge, backgroundColor: colors.goldSoft },
  chipText: {
    color: colors.textMuted, fontSize: 12, letterSpacing: 1,
    textTransform: 'uppercase', fontWeight: typography.weight.medium,
  },
  chipTextActive: { color: colors.gold },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  gridItem: { flexGrow: 1, flexBasis: '46%', maxWidth: '48%' },
  tileTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  iconWrap: { width: 32, height: 32, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  label: { color: colors.textMuted, fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', marginTop: 14 },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 4 },
  value: { color: colors.text, fontSize: 24, fontWeight: typography.weight.semibold, letterSpacing: typography.letter.tight, fontVariant: ['tabular-nums'] },
  unit: { color: colors.textMuted, fontSize: 12 },
  property: { color: colors.textSubtle, fontSize: 11, marginTop: 6 },
});
