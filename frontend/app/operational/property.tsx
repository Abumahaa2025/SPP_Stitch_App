/**
 * WP-6 — Property operations dashboard: summary + linked tabs.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Modal,
  ScrollView,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { ScreenScaffold } from '@/src/components/ScreenScaffold';
import { StoryScreenHeader } from '@/src/components/StoryScreenHeader';
import { GlassCard } from '@/src/components/GlassCard';
import { AliveEmpty } from '@/src/components/AliveEmpty';
import { OpsNavChrome } from '@/src/components/OpsNavChrome';
import { OperationalTenantCard } from '@/src/components/OperationalTenantCard';
import { OperationalContractCard } from '@/src/components/OperationalContractCard';
import { OperationalPaymentLedgerCard } from '@/src/components/OperationalPaymentLedgerCard';
import { usePropertyOS } from '@/src/hooks/usePropertyOS';
import { useOperational } from '@/src/hooks/useOperational';
import { useNotificationPrefs } from '@/src/hooks/usePreferences';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';
import { storage } from '@/src/utils/storage';
import type { ImportBatch } from '@/src/types/property-os';
import {
  buildOperationalPropertyViews,
  buildOperationalUnitViews,
  type OperationalUnitView,
} from '@/src/utils/operational-property-base';
import { buildOperationalContractViews } from '@/src/utils/operational-contracts';
import { buildOperationalLedgerViews } from '@/src/utils/operational-payment-ledger';
import { buildOpsTodayBrief, dataQualityReasons } from '@/src/utils/operational-today';

type PropTab = 'units' | 'tenants' | 'contracts' | 'payments' | 'maintenance' | 'imports';

function fmtMoney(n: number, ar: boolean) {
  return `${Number(n || 0).toLocaleString()} ${ar ? 'ر.س' : 'SAR'}`;
}

const TABS: { id: PropTab; ar: string; en: string }[] = [
  { id: 'units', ar: 'الوحدات', en: 'Units' },
  { id: 'tenants', ar: 'المستأجرون', en: 'Tenants' },
  { id: 'contracts', ar: 'العقود', en: 'Contracts' },
  { id: 'payments', ar: 'المدفوعات', en: 'Payments' },
  { id: 'maintenance', ar: 'الصيانة', en: 'Maintenance' },
  { id: 'imports', ar: 'الاستيراد', en: 'Imports' },
];

export default function OperationalPropertyScreen() {
  const { t, isRTL, lang } = useI18n();
  const ar = lang === 'ar' || !!isRTL;
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; tab?: string; filter?: string }>();
  const { countEnabled } = useNotificationPrefs();
  const { state: osState, reload: reloadOS } = usePropertyOS(countEnabled);
  const { tickets, reload: reloadOps } = useOperational();

  const initialTab = (TABS.some((x) => x.id === params.tab) ? String(params.tab) : 'units') as PropTab;
  const [tab, setTab] = useState<PropTab>(initialTab);
  const [query, setQuery] = useState('');
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<OperationalUnitView | null>(null);
  const [qualityOpen, setQualityOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void reloadOS();
      void reloadOps();
      storage.getItem<string>('spp.importBatches', '[]').then((raw) => {
        try {
          setBatches(JSON.parse(raw || '[]') as ImportBatch[]);
        } catch {
          setBatches([]);
        }
      });
      if (params.tab && TABS.some((x) => x.id === params.tab)) setTab(String(params.tab) as PropTab);
    }, [reloadOS, reloadOps, params.tab]),
  );

  const propViews = useMemo(() => buildOperationalPropertyViews(osState, tickets, ar), [osState, tickets, ar]);
  const prop = propViews.find((p) => p.id === params.id) || propViews[0];
  const brief = useMemo(() => buildOpsTodayBrief(osState, tickets, ar), [osState, tickets, ar]);
  const reasons = useMemo(() => dataQualityReasons(osState, prop, ar), [osState, prop, ar]);

  const units = useMemo(() => {
    let list = buildOperationalUnitViews(osState, tickets, ar);
    if (params.filter === 'vacant') list = list.filter((u) => u.unitStatus === 'vacant');
    if (params.filter === 'arrears') list = list.filter((u) => u.arrears > 0);
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((u) => [u.number, u.tenantName, u.phone, u.contractNumber].join(' ').toLowerCase().includes(q));
    return list;
  }, [osState, tickets, ar, query, params.filter]);

  const contracts = useMemo(() => {
    let list = buildOperationalContractViews(osState, ar);
    if (params.filter === 'expired' || params.filter === 'followup') {
      list = list.filter((c) => c.lifecycleStatus === 'expired' || c.lifecycleStatus === 'expiring_soon');
    }
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((c) => [c.tenantName, c.contractNumber, c.unitNumber].join(' ').toLowerCase().includes(q));
    return list;
  }, [osState, ar, query, params.filter]);

  const ledger = useMemo(() => {
    let list = buildOperationalLedgerViews(osState, ar);
    if (params.filter === 'arrears' || params.filter === 'late') {
      list = list.filter((l) => l.paymentStatus === 'late' || l.paymentStatus === 'partial');
    }
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((l) => [l.tenantName, l.unitNumber, l.monthLabel].join(' ').toLowerCase().includes(q));
    return list;
  }, [osState, ar, query, params.filter]);

  const tenants = useMemo(() => {
    let list = osState.tenants;
    if (params.filter === 'arrears' || params.filter === 'late') {
      const lateIds = new Set(ledger.filter((l) => l.remaining > 0).map((l) => l.tenantId));
      list = list.filter((t) => lateIds.has(t.id));
    }
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((t) => [t.name, t.phone].join(' ').toLowerCase().includes(q));
    return list;
  }, [osState.tenants, ledger, query, params.filter]);

  const openTickets = useMemo(
    () => tickets.filter((tk) => tk.status !== 'closed' && (!prop || osState.units.some((u) => u.id === tk.unitId && u.propertyId === prop.id))),
    [tickets, osState.units, prop],
  );

  const resultCount =
    tab === 'units' ? units.length
      : tab === 'tenants' ? tenants.length
        : tab === 'contracts' ? contracts.length
          : tab === 'payments' ? ledger.length
            : tab === 'maintenance' ? openTickets.length
              : batches.length;

  if (!osState.property || !prop) {
    return (
      <ScreenScaffold testID="ops-property-screen">
        <AliveEmpty
          title={ar ? 'لا عقار بعد' : 'No property yet'}
          body={ar ? 'ارفع كشفًا واعتمده أولًا.' : 'Upload and Apply first.'}
          actionLabel={ar ? 'رفع' : 'Upload'}
          onAction={() => router.push('/upload' as any)}
        />
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold testID="ops-property-screen">
      <StoryScreenHeader
        question={prop.name}
        hint={ar ? 'ملف العقار التشغيلي' : 'Operational property file'}
        showBack={false}
        testID="ops-property-header"
      />
      <OpsNavChrome
        crumbs={[ar ? 'تشغيل العقار' : 'Ops', prop.name, TABS.find((x) => x.id === tab)?.[ar ? 'ar' : 'en'] || '']}
        propertyName={prop.name}
        resultCount={resultCount}
        resultLabel={ar ? 'نتيجة' : 'results'}
        rtl={!!isRTL}
        onBack={() => router.push('/operational/base' as any)}
      />

      {/* Summary strip */}
      <GlassCard padding={16} radiusToken="lg" edge="gold" style={{ marginBottom: spacing.md }} testID="ops-property-summary">
        <View style={[styles.summaryGrid, isRTL && styles.rowRtl]}>
          <SummaryCell label={ar ? 'الإشغال' : 'Occupancy'} value={`${prop.occupancyPct}%`} />
          <SummaryCell label={ar ? 'الإيرادات' : 'Rent'} value={fmtMoney(prop.totalRent, ar)} />
          <SummaryCell label={ar ? 'المتبقي' : 'Remaining'} value={fmtMoney(prop.totalRemaining, ar)} hot={prop.totalRemaining > 0} />
          <SummaryCell label={ar ? 'المتأخرات' : 'Arrears'} value={String(prop.lateTenantCount)} hot={prop.lateTenantCount > 0} />
          <SummaryCell label={ar ? 'العقود' : 'Contracts'} value={String(prop.contractCount)} />
          <SummaryCell label={ar ? 'الصيانة' : 'Maint.'} value={prop.ticketCount > 0 ? String(prop.ticketCount) : '—'} />
          <SummaryCell
            label={ar ? 'آخر استيراد' : 'Last import'}
            value={prop.lastUpdatedMissing ? '—' : prop.lastUpdated.slice(0, 10)}
          />
          <Pressable onPress={() => { Haptics.selectionAsync(); setQualityOpen(true); }} testID="ops-quality-btn">
            <SummaryCell label={ar ? 'جودة البيانات' : 'Data quality'} value={prop.dataStatusLabel} hot={prop.dataStatus !== 'confirmed'} />
          </Pressable>
        </View>
      </GlassCard>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
        {TABS.map((tb) => (
          <Pressable
            key={tb.id}
            testID={`ops-prop-tab-${tb.id}`}
            onPress={() => { Haptics.selectionAsync(); setTab(tb.id); }}
            style={[styles.chip, tab === tb.id && styles.chipOn]}
          >
            <Text style={[styles.chipText, tab === tb.id && styles.chipTextOn]}>{ar ? tb.ar : tb.en}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {tab !== 'imports' && tab !== 'maintenance' ? (
        <TextInput
          testID="ops-prop-search"
          value={query}
          onChangeText={setQuery}
          placeholder={ar ? 'بحث…' : 'Search…'}
          placeholderTextColor={colors.textSubtle}
          style={[styles.search, isRTL && styles.rtl]}
        />
      ) : null}

      {tab === 'units' ? (
        <View>
          {units.map((u) => (
            <Pressable key={u.id} testID={`ops-prop-unit-${u.id}`} onPress={() => setSelectedUnit(u)} style={{ marginBottom: spacing.sm }}>
              <GlassCard padding={14} radiusToken="md" edge={u.arrears > 0 ? 'gold' : 'neutral'}>
                <Text style={[styles.rowTitle, isRTL && styles.rtl]}>{ar ? 'وحدة' : 'Unit'} {u.number} · {u.tenantName}</Text>
                <Text style={[styles.rowSub, isRTL && styles.rtl]}>
                  {u.unitStatusLabel} · {fmtMoney(u.arrears, ar)} {ar ? 'متأخر' : 'arrears'}
                </Text>
              </GlassCard>
            </Pressable>
          ))}
        </View>
      ) : null}

      {tab === 'tenants' ? (
        <View>
          {tenants.map((tn) => (
            <View key={tn.id} style={{ marginBottom: spacing.sm }}>
              <OperationalTenantCard tenant={tn} state={osState} testID={`ops-prop-tenant-${tn.id}`} />
            </View>
          ))}
        </View>
      ) : null}

      {tab === 'contracts' ? (
        <View>
          {contracts.map((c) => (
            <OperationalContractCard key={c.id} view={c} ar={ar} rtl={!!isRTL} testID={`ops-prop-contract-${c.id}`} />
          ))}
        </View>
      ) : null}

      {tab === 'payments' ? (
        <View>
          {ledger.map((v) => (
            <OperationalPaymentLedgerCard key={v.id} view={v} ar={ar} rtl={!!isRTL} testID={`ops-prop-ledger-${v.id}`} />
          ))}
          <Pressable onPress={() => router.push('/operational/payments' as any)}>
            <Text style={[styles.link, isRTL && styles.rtl]}>{ar ? 'دفتر المدفوعات الكامل ←' : 'Full payment ledger →'}</Text>
          </Pressable>
        </View>
      ) : null}

      {tab === 'maintenance' ? (
        <GlassCard padding={14} radiusToken="md">
          {openTickets.length === 0 ? (
            <Text style={styles.muted}>Requires Source Support</Text>
          ) : (
            openTickets.map((tk) => (
              <Pressable key={tk.id} onPress={() => router.push(`/maintenance/${tk.id}` as any)}>
                <Text style={[styles.rowSub, isRTL && styles.rtl, { marginBottom: 8 }]}>
                  {tk.title} · {tk.status}
                </Text>
              </Pressable>
            ))
          )}
          <Pressable onPress={() => router.push('/maintenance' as any)}>
            <Text style={styles.link}>{ar ? 'شاشة الصيانة ←' : 'Maintenance →'}</Text>
          </Pressable>
        </GlassCard>
      ) : null}

      {tab === 'imports' ? (
        <View>
          {batches.length === 0 ? (
            <Text style={styles.muted}>Requires Source Support</Text>
          ) : (
            batches.map((b) => (
              <GlassCard key={b.id} padding={12} radiusToken="md" style={{ marginBottom: spacing.sm }}>
                <Text style={[styles.rowTitle, isRTL && styles.rtl]}>{b.id}</Text>
                <Text style={[styles.rowSub, isRTL && styles.rtl]}>
                  {(b.appliedAt || '').slice(0, 19).replace('T', ' ')} · U{b.counts?.units} T{b.counts?.tenants} C{b.counts?.contracts}
                </Text>
              </GlassCard>
            ))
          )}
        </View>
      ) : null}

      {/* Quality reasons */}
      <Modal visible={qualityOpen} transparent animationType="fade" onRequestClose={() => setQualityOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setQualityOpen(false)}>
          <View style={styles.qualitySheet}>
            <Text style={styles.rowTitle}>{ar ? 'أسباب جودة البيانات' : 'Data quality reasons'}</Text>
            <Text style={[styles.rowSub, { marginBottom: 10 }]}>{prop.dataStatusLabel} · {brief?.completenessPct ?? 0}%</Text>
            {reasons.map((r) => (
              <Text key={r.code} style={[styles.rowSub, isRTL && styles.rtl]}>· {r.label}</Text>
            ))}
            <Pressable onPress={() => setQualityOpen(false)} style={{ marginTop: 14 }}>
              <Text style={styles.link}>{ar ? 'إغلاق' : 'Close'}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Unit drill-down */}
      <Modal visible={!!selectedUnit} animationType="slide" transparent onRequestClose={() => setSelectedUnit(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.detailSheet}>
            <View style={[styles.detailHead, isRTL && styles.rowRtl]}>
              <Text style={styles.rowTitle}>{ar ? 'وحدة' : 'Unit'} {selectedUnit?.number}</Text>
              <Pressable onPress={() => setSelectedUnit(null)}><Text style={styles.link}>{ar ? 'إغلاق' : 'Close'}</Text></Pressable>
            </View>
            <ScrollView>
              {selectedUnit?.tenant ? (
                <OperationalTenantCard tenant={selectedUnit.tenant} state={osState} />
              ) : (
                <Text style={styles.muted}>Requires Source Support</Text>
              )}
              {selectedUnit ? (
                <>
                  <Text style={styles.section}>{ar ? 'دفتر الأشهر' : 'Ledger'}</Text>
                  {selectedUnit.ledger.map((L) => (
                    <Text key={L.id} style={styles.rowSub}>
                      {L.monthLabel}: {fmtMoney(L.due, ar)} / {fmtMoney(L.paid, ar)} / {fmtMoney(L.remaining, ar)}
                    </Text>
                  ))}
                  <Text style={styles.section}>{ar ? 'الصيانة' : 'Maintenance'}</Text>
                  {selectedUnit.tickets.length === 0 ? (
                    <Text style={styles.muted}>Requires Source Support</Text>
                  ) : (
                    selectedUnit.tickets.map((tk) => (
                      <Text key={tk.id} style={styles.rowSub}>{tk.title} · {tk.status}</Text>
                    ))
                  )}
                </>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenScaffold>
  );
}

function SummaryCell({ label, value, hot }: { label: string; value: string; hot?: boolean }) {
  return (
    <View style={styles.summaryCell}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, hot && { color: colors.danger }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  rowRtl: { flexDirection: 'row-reverse' },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  summaryCell: {
    width: '23%',
    flexGrow: 1,
    minWidth: 70,
    paddingVertical: 6,
  },
  summaryLabel: { color: colors.textMuted, fontSize: 9 },
  summaryValue: { color: colors.text, fontSize: 13, fontWeight: typography.weight.semibold, marginTop: 2 },
  chipScroll: { marginBottom: spacing.sm },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginRight: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  chipOn: { borderColor: colors.goldEdge, backgroundColor: colors.goldSoft },
  chipText: { color: colors.textMuted, fontSize: 12 },
  chipTextOn: { color: colors.text, fontWeight: typography.weight.semibold },
  search: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: spacing.sm,
  },
  rowTitle: { color: colors.text, fontSize: 14, fontWeight: typography.weight.semibold },
  rowSub: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
  link: { color: colors.gold, fontSize: 13, marginTop: 10 },
  muted: { color: colors.textMuted, fontSize: 13 },
  section: { color: colors.gold, fontSize: 11, marginTop: 14, marginBottom: 6, letterSpacing: 1, textTransform: 'uppercase' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  qualitySheet: {
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
  },
  detailSheet: {
    maxHeight: '90%',
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.md,
  },
  detailHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
});
