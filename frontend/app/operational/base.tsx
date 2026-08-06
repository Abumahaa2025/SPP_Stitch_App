/**
 * مركز البيانات والعمليات — unified hub.
 * Tabs: overview · tenants · official registry
 */
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ScreenScaffold } from '@/src/components/ScreenScaffold';
import { StoryScreenHeader } from '@/src/components/StoryScreenHeader';
import { GlassCard } from '@/src/components/GlassCard';
import { AliveEmpty } from '@/src/components/AliveEmpty';
import { OpsNavChrome } from '@/src/components/OpsNavChrome';
import { PortalShareCard } from '@/src/components/PortalShareCard';
import { TenantOfficialRegistry } from '@/src/components/TenantOfficialRegistry';
import { AgentPermissionGate } from '@/src/components/AgentPermissionGate';
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

type HubTab = 'overview' | 'tenants' | 'registry';

function parseTab(raw?: string | string[]): HubTab {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === 'tenants' || v === 'registry') return v;
  return 'overview';
}

export default function OperationalBaseHome() {
  const { isRTL, lang } = useI18n();
  const ar = lang === 'ar' || !!isRTL;
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const tab = parseTab(params.tab);
  const { countEnabled } = useNotificationPrefs();
  const { state: osState, reload: reloadOS } = usePropertyOS(countEnabled);
  const { tickets, reload: reloadOps } = useOperational();
  const [qualityOpen, setQualityOpen] = useState(false);
  const [showPortals, setShowPortals] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void reloadOS();
      void reloadOps();
    }, [reloadOS, reloadOps]),
  );

  const brief = useMemo(() => buildOpsTodayBrief(osState, tickets, ar), [osState, tickets, ar]);
  const props = useMemo(() => buildOperationalPropertyViews(osState, tickets, ar), [osState, tickets, ar]);
  const kpis = useMemo(() => computePortfolioKpis(osState, tickets), [osState, tickets]);

  const setTab = (next: HubTab) => {
    Haptics.selectionAsync();
    const q = next === 'overview' ? '' : `?tab=${next}`;
    router.replace(`/operational/base${q}` as any);
  };

  const openProperty = (id?: string, propTab?: string, filter?: string) => {
    Haptics.selectionAsync();
    const pid = id || osState.property?.id || props[0]?.id;
    if (!pid) return;
    const q = [`id=${encodeURIComponent(pid)}`];
    if (propTab) q.push(`tab=${propTab}`);
    if (filter) q.push(`filter=${filter}`);
    router.push(`/operational/property?${q.join('&')}` as any);
  };

  if (!brief || !osState.property) {
    return (
      <ScreenScaffold testID="ops-base-screen">
        <StoryScreenHeader
          question={ar ? 'مركز البيانات والعمليات' : 'Data & operations'}
          hint={ar ? 'بعد اعتماد كشف واحد يُبنى ملف العقار هنا' : 'After one Apply, the property file lives here'}
          showBack
        />
        <AliveEmpty
          title={ar ? 'لا ملف عقار بعد' : 'No property file yet'}
          body={ar ? 'أدخل البيانات العقارية مرة واحدة لبناء قاعدة التشغيل، أو ارفع كشفاً واعتمده.' : 'Enter property data once to build ops, or upload and Apply a statement.'}
          actionLabel={ar ? 'إدخال البيانات العقارية' : 'Enter property data'}
          onAction={() => router.push('/setup/property-os?phase=property' as any)}
        />
      </ScreenScaffold>
    );
  }

  const tabs: { key: HubTab; label: string; icon: keyof typeof Feather.glyphMap }[] = [
    { key: 'overview', label: ar ? 'نظرة عامة' : 'Overview', icon: 'layers' },
    { key: 'tenants', label: ar ? 'المستأجرون' : 'Tenants', icon: 'users' },
    { key: 'registry', label: ar ? 'القاعدة الرسمية' : 'Official registry', icon: 'book' },
  ];

  return (
    <ScreenScaffold testID="ops-base-screen">
      <StoryScreenHeader
        question={ar ? 'مركز البيانات والعمليات' : 'Data & operations'}
        hint={ar ? 'المستأجرون · القاعدة الرسمية · تشغيل العقار' : 'Tenants · official registry · property ops'}
        showBack={false}
        testID="ops-base-header"
      />
      <OpsNavChrome
        crumbs={[ar ? 'المالك' : 'Owner', ar ? 'مركز البيانات والعمليات' : 'Data & ops']}
        propertyName={brief.propertyName}
        resultCount={props.length}
        resultLabel={ar ? 'عقار' : 'properties'}
        rtl={!!isRTL}
        onBack={() => router.push('/owner' as any)}
      />

      <View style={[styles.tabRow, isRTL && styles.rowRtl]} testID="ops-base-tabs">
        {tabs.map((t) => {
          const on = tab === t.key;
          return (
            <Pressable
              key={t.key}
              testID={`ops-base-tab-${t.key}`}
              onPress={() => setTab(t.key)}
              style={[styles.tabBtn, on && styles.tabBtnOn]}
            >
              <Feather name={t.icon} size={13} color={on ? colors.bg : colors.gold} />
              <Text style={[styles.tabText, on && styles.tabTextOn]} numberOfLines={1}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {tab === 'registry' ? (
        <TenantOfficialRegistry embedded variant="database" testID="ops-base-registry" />
      ) : null}

      {tab === 'tenants' ? (
        <AgentPermissionGate perm="tenants">
          <View testID="ops-base-tenants">
            <GlassCard padding={14} radiusToken="md" edge="emerald" style={{ marginBottom: spacing.md }}>
              <Text style={[styles.hubTitle, isRTL && styles.rtl]}>
                {ar ? 'المستأجرون' : 'Tenants'}
              </Text>
              <Text style={[styles.hubHint, isRTL && styles.rtl]}>
                {ar
                  ? 'ملفات المستأجرين وروابط البوابة — الجدول الرسمي في تبويب القاعدة الرسمية'
                  : 'Tenant profiles and portal links — official table is under Official registry'}
              </Text>
              <Pressable
                style={[styles.inlineLink, isRTL && styles.rowRtl]}
                onPress={() => setTab('registry')}
                testID="ops-tenants-to-registry"
              >
                <Feather name="book" size={14} color={colors.gold} />
                <Text style={styles.inlineLinkText}>
                  {ar ? 'فتح قاعدة المستأجرين الرسمية ←' : 'Open official tenant registry →'}
                </Text>
              </Pressable>
            </GlassCard>

            {!osState.tenants.length ? (
              <AliveEmpty
                title={ar ? 'لا مستأجرين بعد' : 'No tenants yet'}
                body={ar ? 'أضف مستأجرين من الإعداد أو القاعدة الرسمية.' : 'Add tenants from setup or the official registry.'}
                actionLabel={ar ? 'القاعدة الرسمية' : 'Official registry'}
                onAction={() => setTab('registry')}
              />
            ) : (
              <>
                <Pressable
                  onPress={() => { Haptics.selectionAsync(); setShowPortals((v) => !v); }}
                  style={styles.portalToggle}
                  testID="ops-tenants-portal-toggle"
                >
                  <Text style={[styles.portalToggleText, isRTL && styles.rtl]}>
                    {showPortals
                      ? (ar ? 'إخفاء روابط البوابة' : 'Hide portal links')
                      : (ar ? 'عرض روابط البوابة' : 'Show portal links')}
                  </Text>
                </Pressable>
                {osState.tenants.map((tn, i) => {
                  const unit = osState.units.find((u) => u.id === tn.unitId);
                  return (
                    <Animated.View
                      key={tn.id}
                      entering={FadeInDown.duration(400).delay(i * 40)}
                      style={{ marginBottom: spacing.md }}
                    >
                      <GlassCard padding={16} radiusToken="md">
                        <Text style={[styles.propName, isRTL && styles.rtl]}>{tn.name}</Text>
                        <Text style={[styles.propMeta, isRTL && styles.rtl]}>
                          {ar ? 'وحدة' : 'Unit'} {unit?.number || '—'}
                          {tn.phone ? ` · ${tn.phone}` : ''}
                        </Text>
                      </GlassCard>
                      {showPortals ? (
                        <PortalShareCard tenant={tn} unitNumber={unit?.number} testID={`ops-tenant-portal-${tn.id}`} />
                      ) : null}
                    </Animated.View>
                  );
                })}
              </>
            )}
          </View>
        </AgentPermissionGate>
      ) : null}

      {tab === 'overview' ? (
        <>
          {/* Tenant data hub cards */}
          <Text style={[styles.section, isRTL && styles.rtl]}>
            {ar ? 'المستأجرون والبيانات' : 'Tenants & data'}
          </Text>
          <View style={[styles.hubGrid, isRTL && styles.rowRtl]}>
            <Pressable
              testID="ops-hub-tenants"
              onPress={() => setTab('tenants')}
              style={styles.hubCard}
            >
              <Feather name="users" size={18} color={colors.gold} />
              <Text style={[styles.hubCardTitle, isRTL && styles.rtl]}>
                {ar ? 'المستأجرون' : 'Tenants'}
              </Text>
              <Text style={[styles.hubCardMeta, isRTL && styles.rtl]}>
                {osState.tenants.length} {ar ? 'ملف' : 'profiles'}
              </Text>
            </Pressable>
            <Pressable
              testID="ops-hub-registry"
              onPress={() => setTab('registry')}
              style={styles.hubCard}
            >
              <Feather name="book" size={18} color={colors.emerald} />
              <Text style={[styles.hubCardTitle, isRTL && styles.rtl]}>
                {ar ? 'قاعدة المستأجرين الرسمية' : 'Official tenant registry'}
              </Text>
              <Text style={[styles.hubCardMeta, isRTL && styles.rtl]}>
                {ar ? 'جدول إكسل · بحث · تعديل رسمي' : 'Excel table · search · official edits'}
              </Text>
            </Pressable>
          </View>

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

          <View style={[styles.quick, isRTL && styles.rowRtl]}>
            <Quick label={ar ? 'ملخص الأشهر' : 'Monthly'} onPress={() => router.push('/operational/monthly-summary' as any)} />
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
        </>
      ) : null}
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
  tabRow: { flexDirection: 'row', gap: 8, marginBottom: spacing.md },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  tabBtnOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  tabText: { color: colors.gold, fontSize: 11, fontWeight: typography.weight.semibold },
  tabTextOn: { color: colors.bg },
  hubGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md },
  hubCard: {
    width: '48%',
    flexGrow: 1,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
    gap: 6,
  },
  hubCardTitle: { color: colors.text, fontSize: 13, fontWeight: typography.weight.semibold },
  hubCardMeta: { color: colors.textMuted, fontSize: 11, lineHeight: 16 },
  hubTitle: { color: colors.text, fontSize: 16, fontWeight: typography.weight.semibold },
  hubHint: { color: colors.textDim, fontSize: 12, marginTop: 6, lineHeight: 18 },
  inlineLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  inlineLinkText: { color: colors.gold, fontSize: 12, fontWeight: typography.weight.semibold },
  portalToggle: { paddingVertical: 10, alignItems: 'center', marginBottom: 4 },
  portalToggleText: { color: colors.gold, fontSize: 12, fontWeight: typography.weight.medium },
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
