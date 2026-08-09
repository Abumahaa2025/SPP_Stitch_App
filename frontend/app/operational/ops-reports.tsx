/**
 * Completed tenant operations reports — separate table/page from raw tenants data.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ScreenScaffold } from '@/src/components/ScreenScaffold';
import { StoryScreenHeader } from '@/src/components/StoryScreenHeader';
import { GlassCard } from '@/src/components/GlassCard';
import { AliveEmpty } from '@/src/components/AliveEmpty';
import { useTenantOps } from '@/src/hooks/useTenantOps';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';
import { formatDate } from '@/src/utils/locale';
import type { TenantOpsKind } from '@/src/types/tenant-ops-journey';

const FILTERS: { id: 'all' | TenantOpsKind; ar: string; en: string }[] = [
  { id: 'all', ar: 'الكل', en: 'All' },
  { id: 'payment', ar: 'سداد', en: 'Payment' },
  { id: 'maintenance', ar: 'صيانة', en: 'Maintenance' },
  { id: 'move', ar: 'تنقل', en: 'Move' },
  { id: 'vacate', ar: 'إخلاء', en: 'Vacate' },
  { id: 'entry', ar: 'دخول', en: 'Entry' },
];

export default function OpsReportsScreen() {
  const { isRTL, lang } = useI18n();
  const ar = lang === 'ar' || !!isRTL;
  const { state } = useTenantOps();
  const [filter, setFilter] = useState<'all' | TenantOpsKind>('all');

  const rows = useMemo(() => {
    const list = state.reports;
    if (filter === 'all') return list;
    return list.filter((r) => r.kind === filter);
  }, [state.reports, filter]);

  return (
    <ScreenScaffold testID="ops-reports">
      <StoryScreenHeader
        question={ar ? 'مركز تقارير العمليات' : 'Operations reports center'}
        hint={ar
          ? 'جدول مستقل عن بيانات المستأجرين الخام — يحفظ السداد والصيانة والتنقلات'
          : 'Separate from raw tenant tables — stores payment, maintenance, and move events'}
        showBack
      />

      <View style={[styles.filters, isRTL && styles.rowRtl]}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.id}
            onPress={() => setFilter(f.id)}
            style={[styles.chip, filter === f.id && styles.chipOn]}
          >
            <Text style={[styles.chipText, filter === f.id && styles.chipTextOn]}>
              {ar ? f.ar : f.en}
            </Text>
          </Pressable>
        ))}
      </View>

      {!rows.length ? (
        <AliveEmpty
          title={ar ? 'لا تقارير بعد' : 'No reports yet'}
          body={ar
            ? 'بعد اكتمال مسار السداد أو الصيانة يظهر التقرير هنا ويُحفظ في ملاحظات المستأجر.'
            : 'After a payment or maintenance path completes, the report appears here and is saved to tenant notes.'}
        />
      ) : null}

      {rows.map((r, i) => (
        <Animated.View key={r.id} entering={FadeInDown.duration(350).delay(i * 30)}>
          <GlassCard padding={14} radiusToken="md" edge="emerald" style={styles.gap}>
            <Text style={[styles.kind, isRTL && styles.rtl]}>{r.kind}</Text>
            <Text style={[styles.title, isRTL && styles.rtl]}>
              {ar ? r.summaryAr : r.summaryEn}
            </Text>
            <Text style={[styles.meta, isRTL && styles.rtl]}>
              {r.tenantName}
              {r.unitNumber ? ` · ${r.unitNumber}` : ''}
              {r.techName ? ` · ${r.techName}` : ''}
              {r.costTotal != null ? ` · ${r.costTotal}` : ''}
            </Text>
            <Text style={[styles.time, isRTL && styles.rtl]}>{formatDate(r.createdAt)}</Text>
          </GlassCard>
        </Animated.View>
      ))}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md },
  rowRtl: { flexDirection: 'row-reverse' },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  chipOn: { borderColor: colors.emerald, backgroundColor: 'rgba(16,185,129,0.15)' },
  chipText: { color: colors.textDim, fontSize: 12 },
  chipTextOn: { color: colors.emerald, fontWeight: typography.weight.semibold },
  gap: { marginBottom: spacing.sm },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  kind: { color: colors.gold, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase' },
  title: { color: colors.text, fontSize: 14, marginTop: 4, lineHeight: 20 },
  meta: { color: colors.textDim, fontSize: 12, marginTop: 6 },
  time: { color: colors.textSubtle, fontSize: 11, marginTop: 4 },
});
