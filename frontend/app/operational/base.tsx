/**
 * WP-6 — Unified property operations home (entry point after Apply).
 * Calm "today" briefing → open property file without visual clutter.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { ScreenScaffold } from '@/src/components/ScreenScaffold';
import { StoryScreenHeader } from '@/src/components/StoryScreenHeader';
import { GlassCard } from '@/src/components/GlassCard';
import { AliveEmpty } from '@/src/components/AliveEmpty';
import { OpsNavChrome } from '@/src/components/OpsNavChrome';
import { usePropertyOS } from '@/src/hooks/usePropertyOS';
import { useOperational } from '@/src/hooks/useOperational';
import { useNotificationPrefs } from '@/src/hooks/usePreferences';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';
import {
  buildOperationalPropertyViews,
  computePortfolioKpis,
} from '@/src/utils/operational-property-base';
import { buildOpsTodayBrief } from '@/src/utils/operational-today';

function fmtMoney(n: number, ar: boolean) {
  return `${Number(n || 0).toLocaleString()} ${ar ? 'ر.س' : 'SAR'}`;
}

export default function OperationalBaseHome() {
  const { isRTL, lang } = useI18n();
  const ar = lang === 'ar' || !!isRTL;
  const router = useRouter();
  const { countEnabled } = useNotificationPrefs();
  const { state: osState, reload: reloadOS } = usePropertyOS(countEnabled);
  const { tickets, reload: reloadOps } = useOperational();
  const [qualityOpen, setQualityOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void reloadOS();
      void reloadOps();
    }, [reloadOS, reloadOps]),
  );

  const brief = useMemo(() => buildOpsTodayBrief(osState, tickets, ar), [osState, tickets, ar]);
  const props = useMemo(() => buildOperationalPropertyViews(osState, tickets, ar), [osState, tickets, ar]);
  const kpis = useMemo(() => computePortfolioKpis(osState, tickets), [osState, tickets]);

  const openProperty = (id?: string, tab?: string, filter?: string) => {
    Haptics.selectionAsync();
    const pid = id || osState.property?.id || props[0]?.id;
    if (!pid) return;
    const q = [`id=${encodeURIComponent(pid)}`];
    if (tab) q.push(`tab=${tab}`);
    if (filter) q.push(`filter=${filter}`);
    router.push(`/operational/property?${q.join('&')}` as any);
  };

  if (!brief || !osState.property) {
    return (
      <ScreenScaffold testID="ops-base-screen">
        <StoryScreenHeader
          question={ar ? 'تشغيل العقار' : 'Property operations'}
          hint={ar ? 'بعد اعتماد كشف واحد يُبنى ملف العقار هنا' : 'After one Apply, the property file lives here'}
          showBack
        />
        <AliveEmpty
          title={ar ? 'لا ملف عقار بعد' : 'No property file yet'}
          body={ar ? 'ارفع كشف إيجار واعتمده لبناء قاعدة التشغيل.' : 'Upload a rent statement and Apply to build ops.'}
          actionLabel={ar ? 'رفع كشف' : 'Upload'}
          onAction={() => router.push('/upload' as any)}
        />
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold testID="ops-base-screen">
      <StoryScreenHeader
        question={ar ? 'تشغيل العقار' : 'Property operations'}
        hint={ar ? 'ماذا يحتاج انتباهك اليوم؟' : 'What needs attention today?'}
        showBack={false}
        testID="ops-base-header"
      />
      <OpsNavChrome
        crumbs={[ar ? 'المالك' : 'Owner', ar ? 'تشغيل العقار' : 'Ops']}
        propertyName={brief.propertyName}
        resultCount={props.length}
        resultLabel={ar ? 'عقار' : 'properties'}
        rtl={!!isRTL}
        onBack={() => router.push('/owner' as any)}
      />

      {/* Today status — one calm card */}
      <GlassCard padding={20} radiusToken="lg" edge="gold" style={{ marginBottom: spacing.md }} testID="ops-today-card">
        <Text style={[styles.kicker, isRTL && styles.rtl]}>{ar ? 'حالة العقار اليوم' : 'Property status today'}</Text>
        <Text style={[styles.statusLine, isRTL && styles.rtl]}>{brief.statusToday}</Text>
        <Pressable
          onPress={() => { Haptics.selectionAsync(); setQualityOpen(true); }}
          style={[styles.qualityRow, isRTL && styles.rowRtl]}
          testID="ops-today-quality"
        >
          <Text style={styles.qualityPct}>{brief.completenessPct}%</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.qualityLabel, isRTL && styles.rtl]}>{ar ? 'اكتمال البيانات' : 'Data completeness'}</Text>
            <Text style={[styles.qualityStatus, isRTL && styles.rtl]}>{brief.dataStatusLabel}</Text>
          </View>
        </Pressable>
      </GlassCard>

      {/* Focus cards — sparse */}
      <View style={[styles.focusGrid, isRTL && styles.rowRtl]}>
        <FocusCard
          testID="ops-focus-arrears"
          label={ar ? 'المتأخرات' : 'Arrears'}
          value={fmtMoney(brief.arrearsTotal, ar)}
          hint={ar ? `${brief.lateTenants} مستأجر` : `${brief.lateTenants} tenants`}
          hot={brief.arrearsTotal > 0}
          onPress={() => openProperty(undefined, 'payments', 'arrears')}
        />
        <FocusCard
          testID="ops-focus-contracts"
          label={ar ? 'عقود للمتابعة' : 'Contracts follow-up'}
          value={String(brief.contractsFollowUp)}
          onPress={() => openProperty(undefined, 'contracts', 'followup')}
        />
        <FocusCard
          testID="ops-focus-vacant"
          label={ar ? 'وحدات شاغرة' : 'Vacant units'}
          value={String(brief.vacantUnits)}
          onPress={() => openProperty(undefined, 'units', 'vacant')}
        />
        <FocusCard
          testID="ops-focus-tickets"
          label={ar ? 'بلاغات مفتوحة' : 'Open tickets'}
          value={brief.openTickets > 0 ? String(brief.openTickets) : '—'}
          hint={brief.openTickets === 0 ? 'Requires Source Support' : undefined}
          onPress={() => openProperty(undefined, 'maintenance')}
        />
      </View>

      <GlassCard padding={14} radiusToken="md" style={{ marginBottom: spacing.md }} testID="ops-last-import">
        <Text style={[styles.metaLabel, isRTL && styles.rtl]}>{ar ? 'آخر عملية استيراد' : 'Last import'}</Text>
        <Text style={[styles.metaValue, isRTL && styles.rtl]}>
          {brief.lastImportMissing ? 'Requires Source Support' : brief.lastImportLabel}
        </Text>
        <Pressable onPress={() => openProperty(undefined, 'imports')}>
          <Text style={[styles.link, isRTL && styles.rtl]}>{ar ? 'سجل الاستيراد ←' : 'Import history →'}</Text>
        </Pressable>
      </GlassCard>

      {/* Properties — one tap into file */}
      <Text style={[styles.section, isRTL && styles.rtl]}>{ar ? 'العقارات' : 'Properties'}</Text>
      {props.map((p) => (
        <Pressable
          key={p.id}
          testID={`ops-home-property-${p.id}`}
          onPress={() => openProperty(p.id)}
          style={{ marginBottom: spacing.md }}
        >
          <GlassCard padding={18} radiusToken="lg" edge="emerald">
            <Text style={[styles.propName, isRTL && styles.rtl]}>{p.name}</Text>
            <Text style={[styles.propMeta, isRTL && styles.rtl]}>
              {p.unitCount} {ar ? 'وحدة' : 'units'} · {p.occupancyPct}% · {p.dataStatusLabel}
            </Text>
            <Text style={[styles.link, isRTL && styles.rtl]}>
              {ar ? 'فتح ملف العقار ←' : 'Open property file →'}
            </Text>
          </GlassCard>
        </Pressable>
      ))}

      {/* Quick links */}
      <View style={[styles.quick, isRTL && styles.rowRtl]}>
        <Quick label={ar ? 'المستأجرون' : 'Tenants'} onPress={() => router.push('/tenants' as any)} />
        <Quick label={ar ? 'العقود' : 'Contracts'} onPress={() => router.push('/contracts' as any)} />
        <Quick label={ar ? 'المدفوعات' : 'Payments'} onPress={() => router.push('/operational/payments' as any)} />
        <Quick label={ar ? 'التقارير' : 'Reports'} onPress={() => router.push('/reports' as any)} />
      </View>

      <Text style={[styles.foot, isRTL && styles.rtl]}>
        {kpis.units} {ar ? 'وحدة' : 'u'} · {kpis.contracts} {ar ? 'عقد' : 'c'} · {fmtMoney(kpis.collected, ar)} {ar ? 'محصل' : 'collected'}
      </Text>

      <Modal visible={qualityOpen} transparent animationType="fade" onRequestClose={() => setQualityOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setQualityOpen(false)}>
          <View style={styles.sheet}>
            <Text style={styles.propName}>{ar ? 'جودة البيانات' : 'Data quality'}</Text>
            <Text style={styles.propMeta}>{brief.dataStatusLabel} · {brief.completenessPct}%</Text>
            {brief.qualityReasons.map((r) => (
              <Text key={r.code} style={[styles.propMeta, isRTL && styles.rtl, { marginTop: 8 }]}>· {r.label}</Text>
            ))}
          </View>
        </Pressable>
      </Modal>
    </ScreenScaffold>
  );
}

function FocusCard({
  label, value, hint, hot, onPress, testID,
}: {
  label: string; value: string; hint?: string; hot?: boolean; onPress: () => void; testID: string;
}) {
  return (
    <Pressable testID={testID} onPress={onPress} style={styles.focusCard}>
      <Text style={styles.focusLabel}>{label}</Text>
      <Text style={[styles.focusValue, hot && { color: colors.danger }]}>{value}</Text>
      {hint ? <Text style={styles.focusHint}>{hint}</Text> : null}
    </Pressable>
  );
}

function Quick({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.quickBtn}>
      <Text style={styles.quickText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  rowRtl: { flexDirection: 'row-reverse' },
  kicker: { color: colors.gold, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  statusLine: { color: colors.text, fontSize: 17, fontWeight: typography.weight.semibold, lineHeight: 24 },
  qualityRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 },
  qualityPct: { color: colors.gold, fontSize: 22, fontWeight: typography.weight.semibold },
  qualityLabel: { color: colors.textMuted, fontSize: 11 },
  qualityStatus: { color: colors.text, fontSize: 13, marginTop: 2 },
  focusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md },
  focusCard: {
    width: '48%',
    flexGrow: 1,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  focusLabel: { color: colors.textMuted, fontSize: 11 },
  focusValue: { color: colors.text, fontSize: 16, fontWeight: typography.weight.semibold, marginTop: 6 },
  focusHint: { color: colors.textSubtle, fontSize: 10, marginTop: 4 },
  metaLabel: { color: colors.textMuted, fontSize: 11 },
  metaValue: { color: colors.text, fontSize: 14, marginTop: 4 },
  link: { color: colors.gold, fontSize: 12, marginTop: 8 },
  section: { color: colors.textMuted, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', marginBottom: spacing.sm },
  propName: { color: colors.text, fontSize: 16, fontWeight: typography.weight.semibold },
  propMeta: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  quick: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing.md },
  quickBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  quickText: { color: colors.text, fontSize: 12 },
  foot: { color: colors.textSubtle, fontSize: 11, marginTop: spacing.lg },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
  },
});
