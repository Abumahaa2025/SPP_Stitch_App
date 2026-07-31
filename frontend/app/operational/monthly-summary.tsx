/**
 * ملخص الأشهر 1–8: إجمالي الإيجارات / المتأخرات / من غادر / من دخل.
 */
import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { ScreenScaffold } from '@/src/components/ScreenScaffold';
import { StoryScreenHeader } from '@/src/components/StoryScreenHeader';
import { GlassCard } from '@/src/components/GlassCard';
import { AliveEmpty } from '@/src/components/AliveEmpty';
import { OpsNavChrome } from '@/src/components/OpsNavChrome';
import { usePropertyOS } from '@/src/hooks/usePropertyOS';
import { useNotificationPrefs } from '@/src/hooks/usePreferences';
import { buildMonthlyPortfolioSummary } from '@/src/utils/monthly-portfolio-summary';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';

function fmtMoney(n: number, ar: boolean) {
  return `${Number(n || 0).toLocaleString()} ${ar ? 'ر.س' : 'SAR'}`;
}

export default function MonthlySummaryScreen() {
  const { isRTL, lang } = useI18n();
  const ar = lang === 'ar' || !!isRTL;
  const router = useRouter();
  const { countEnabled } = useNotificationPrefs();
  const { state, reload } = usePropertyOS(countEnabled);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const summary = useMemo(
    () => buildMonthlyPortfolioSummary(state, state.occupancyMoves || []),
    [state],
  );

  if (!state.paymentLedger?.length) {
    return (
      <ScreenScaffold testID="monthly-summary">
        <StoryScreenHeader
          question={ar ? 'الملخص الشهري المفصّل' : 'Detailed monthly summary'}
          hint={ar ? 'بعد اعتماد كشوف الأشهر 1–8 تظهر الإجماليات هنا' : 'After applying statements months 1–8, totals appear here'}
          showBack
        />
        <AliveEmpty
          title={ar ? 'لا كشوف معتمدة بعد' : 'No statements applied yet'}
          body={ar ? 'ارفع كشوف الإيجار من شهر 1 إلى 8 ثم اعتمدها.' : 'Upload rent statements for months 1–8 then Apply.'}
          actionLabel={ar ? 'رفع الكشوف' : 'Upload'}
          onAction={() => router.push('/upload' as any)}
        />
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold testID="monthly-summary">
      <StoryScreenHeader
        question={ar ? 'الملخص الشهري المفصّل' : 'Detailed monthly summary'}
        hint={ar ? 'إجمالي الإيجارات والمتأخرات ومن غادر ومن دخل' : 'Rents, arrears, exits and replacements'}
        showBack
      />
      <OpsNavChrome
        crumbs={[ar ? 'تشغيل' : 'Ops', ar ? 'ملخص الأشهر' : 'Monthly']}
        propertyName={state.property?.name}
        resultCount={summary.months.length}
        resultLabel={ar ? 'شهر' : 'months'}
        rtl={!!isRTL}
      />

      <GlassCard padding={18} radiusToken="lg" edge="gold" style={{ marginBottom: spacing.md }}>
        <Text style={[styles.section, isRTL && styles.rtl]}>{ar ? 'الإجمالي عبر الفترة' : 'Period totals'}</Text>
        <View style={[styles.kpiRow, isRTL && styles.rowRtl]}>
          <Kpi label={ar ? 'المستحق' : 'Due'} value={fmtMoney(summary.totals.due, ar)} tone="muted" />
          <Kpi label={ar ? 'المحصّل' : 'Collected'} value={fmtMoney(summary.totals.paid, ar)} tone="ok" />
          <Kpi label={ar ? 'المتأخرات' : 'Arrears'} value={fmtMoney(summary.totals.arrears, ar)} tone="danger" />
        </View>
        <View style={[styles.kpiRow, isRTL && styles.rowRtl, { marginTop: 10 }]}>
          <Kpi label={ar ? 'غادر' : 'Left'} value={String(summary.totals.departed)} tone="warn" />
          <Kpi label={ar ? 'دخل بديل' : 'Entered'} value={String(summary.totals.entered)} tone="ok" />
          <Kpi label={ar ? 'أشهر' : 'Months'} value={String(summary.months.length)} tone="muted" />
        </View>
      </GlassCard>

      {summary.months.map((m) => (
        <GlassCard key={m.monthKey} padding={16} radiusToken="md" style={{ marginBottom: spacing.sm }}>
          <Text style={[styles.monthTitle, isRTL && styles.rtl]}>{m.monthLabel}</Text>
          <Text style={[styles.dim, isRTL && styles.rtl]}>
            {ar ? 'مستحق' : 'Due'} {fmtMoney(m.dueTotal, ar)} · {ar ? 'محصّل' : 'Paid'} {fmtMoney(m.paidTotal, ar)} · {ar ? 'متأخر' : 'Arrears'} {fmtMoney(m.arrearsTotal, ar)}
          </Text>
          <Text style={[styles.dim, isRTL && styles.rtl]}>
            {ar ? 'مدفوع' : 'Paid rows'} {m.paidCount} · {ar ? 'متأخر' : 'Late'} {m.lateCount} · {ar ? 'مستأجرون' : 'Tenants'} {m.tenantCount}
          </Text>
          {m.departed.length > 0 ? (
            <Text style={[styles.move, isRTL && styles.rtl]}>
              {ar ? 'غادر:' : 'Left:'} {m.departed.map((d) => `${d.tenant} (${d.unit})`).join(' · ')}
            </Text>
          ) : null}
          {m.entered.length > 0 ? (
            <Text style={[styles.moveOk, isRTL && styles.rtl]}>
              {ar ? 'دخل:' : 'Entered:'} {m.entered.map((d) => `${d.tenant} (${d.unit})`).join(' · ')}
            </Text>
          ) : null}
        </GlassCard>
      ))}

      {(summary.allDeparted.length > 0 || summary.allEntered.length > 0) ? (
        <GlassCard padding={16} radiusToken="md" edge="emerald" style={{ marginTop: spacing.md }}>
          <Text style={[styles.section, isRTL && styles.rtl]}>{ar ? 'حركة الإشغال (الفترة)' : 'Occupancy moves (period)'}</Text>
          {summary.allDeparted.map((d, i) => (
            <Text key={`d-${i}`} style={[styles.move, isRTL && styles.rtl]}>
              ← {d.tenant} · {ar ? 'وحدة' : 'Unit'} {d.unit}
            </Text>
          ))}
          {summary.allEntered.map((d, i) => (
            <Text key={`e-${i}`} style={[styles.moveOk, isRTL && styles.rtl]}>
              → {d.tenant} · {ar ? 'وحدة' : 'Unit'} {d.unit}
            </Text>
          ))}
        </GlassCard>
      ) : null}

      <Pressable
        style={styles.link}
        onPress={() => { Haptics.selectionAsync(); router.push('/tenants' as any); }}
      >
        <Text style={styles.linkText}>{ar ? 'قاعدة المستأجرين الرسمية ←' : 'Official tenant registry →'}</Text>
      </Pressable>
    </ScreenScaffold>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone: 'ok' | 'danger' | 'warn' | 'muted' }) {
  const color =
    tone === 'ok' ? colors.emerald
      : tone === 'danger' ? colors.danger
        : tone === 'warn' ? colors.gold
          : colors.text;
  return (
    <View style={styles.kpi}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={[styles.kpiValue, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { color: colors.textMuted, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  rowRtl: { flexDirection: 'row-reverse' },
  kpiRow: { flexDirection: 'row', gap: 8 },
  kpi: { flex: 1, padding: 10, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  kpiLabel: { color: colors.textMuted, fontSize: 11 },
  kpiValue: { color: colors.text, fontSize: 13, fontWeight: typography.weight.semibold, marginTop: 4 },
  monthTitle: { color: colors.text, fontSize: 15, fontWeight: typography.weight.semibold },
  dim: { color: colors.textDim, fontSize: 12, marginTop: 6 },
  move: { color: colors.danger, fontSize: 12, marginTop: 6 },
  moveOk: { color: colors.emerald, fontSize: 12, marginTop: 4 },
  link: { marginTop: spacing.lg, padding: 12, alignItems: 'center' },
  linkText: { color: colors.gold, fontWeight: typography.weight.semibold },
});
