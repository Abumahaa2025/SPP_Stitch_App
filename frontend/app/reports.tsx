import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';

import { ScreenScaffold } from '@/src/components/ScreenScaffold';
import { StoryScreenHeader } from '@/src/components/StoryScreenHeader';
import { GlassCard } from '@/src/components/GlassCard';
import { AliveEmpty } from '@/src/components/AliveEmpty';
import { BrainVerdict } from '@/src/components/BrainVerdict';
import { api, type ReportT } from '@/src/api/client';
import { storage } from '@/src/utils/storage';
import { colors, spacing, typography } from '@/src/theme';
import { useI18n } from '@/src/i18n';

const kindIcon: Record<string, keyof typeof Feather.glyphMap> = {
  monthly: 'calendar',
  financial: 'trending-up',
  compliance: 'shield',
  tenant: 'users',
};

export default function Reports() {
  const { t } = useI18n();
  const [items, setItems] = useState<ReportT[]>([]);
  const [imported, setImported] = useState<ReportT[]>([]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        try {
          const raw = await storage.getItem<string>('spp.importedReports', '[]');
          const local = JSON.parse(raw || '[]') as ReportT[];
          if (alive) setImported(Array.isArray(local) ? local : []);
        } catch {
          if (alive) setImported([]);
        }
        try {
          const remote = await api.reports();
          if (alive) setItems(remote);
        } catch {
          if (alive) setItems([]);
        }
      })();
      return () => {
        alive = false;
      };
    }, []),
  );

  const merged = [...imported, ...items.filter((r) => !imported.some((i) => i.id === r.id))];

  return (
    <ScreenScaffold testID="reports-screen">
      <StoryScreenHeader question={t('page.q.reports')} hint={t('reports.sub')} showBack testID="reports-header" />

      <BrainVerdict screen="reports" />

      {merged.length === 0 ? (
        <AliveEmpty title={t('alive.reports.title')} body={t('alive.reports.body')} />
      ) : merged.map((r, i) => (
        <Animated.View key={r.id} entering={FadeInDown.duration(600).delay(60 * i)}>
          <Pressable
            testID={`report-${r.id}`}
            onPress={() => Haptics.selectionAsync()}
            style={{ marginBottom: spacing.md }}
          >
            <GlassCard padding={22} radiusToken="lg" edge={r.accent}>
              <View style={styles.top}>
                <View style={[
                  styles.iconChip,
                  r.accent === 'gold'
                    ? { borderColor: colors.goldEdge, backgroundColor: colors.goldSoft }
                    : { borderColor: colors.emeraldEdge, backgroundColor: colors.emeraldSoft },
                ]}>
                  <Feather
                    name={kindIcon[r.kind] ?? 'file'}
                    size={15}
                    color={r.accent === 'gold' ? colors.gold : colors.emerald}
                  />
                </View>
                <Text style={styles.kind}>{r.kind.toUpperCase()}</Text>
                <View style={{ flex: 1 }} />
                <Text style={styles.pages}>{r.pages} {t('reports.pages')}</Text>
              </View>
              <Text style={styles.title}>{r.title}</Text>
              <Text style={styles.sub}>{r.subtitle}</Text>
              <View style={styles.hair} />
              <View style={styles.highlightRow}>
                <View style={[styles.dot, { backgroundColor: r.accent === 'gold' ? colors.gold : colors.emerald }]} />
                <Text style={[styles.highlight, { color: r.accent === 'gold' ? colors.gold : colors.emerald }]}>
                  {r.highlight}
                </Text>
              </View>
              <Text style={styles.date}>{new Date(r.created_at).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</Text>
            </GlassCard>
          </Pressable>
        </Animated.View>
      ))}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconChip: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center', justifyContent: 'center',
  },
  kind: { color: colors.textMuted, fontSize: 10, letterSpacing: 1.8, fontWeight: typography.weight.medium },
  pages: { color: colors.textSubtle, fontSize: 11 },
  title: { color: colors.text, fontSize: 18, fontWeight: typography.weight.semibold, letterSpacing: -0.3, marginTop: 16, lineHeight: 24 },
  sub: { color: colors.textMuted, fontSize: 13, marginTop: 6 },
  hair: { height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginTop: spacing.md },
  highlightRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: spacing.md },
  dot: { width: 5, height: 5, borderRadius: 3 },
  highlight: { fontSize: 13, letterSpacing: 0.1, flex: 1 },
  date: { color: colors.textSubtle, fontSize: 11, marginTop: 10 },
});
