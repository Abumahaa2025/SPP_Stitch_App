/**
 * WP-4 — Operational payment ledger (months[] → searchable monthly records).
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
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { ScreenScaffold } from '@/src/components/ScreenScaffold';
import { StoryScreenHeader } from '@/src/components/StoryScreenHeader';
import { GlassCard } from '@/src/components/GlassCard';
import { AliveEmpty } from '@/src/components/AliveEmpty';
import { OpsNavChrome } from '@/src/components/OpsNavChrome';
import { OperationalPaymentLedgerCard } from '@/src/components/OperationalPaymentLedgerCard';
import { OperationalTenantCard } from '@/src/components/OperationalTenantCard';
import { OperationalContractCard } from '@/src/components/OperationalContractCard';
import { usePropertyOS } from '@/src/hooks/usePropertyOS';
import { useNotificationPrefs } from '@/src/hooks/usePreferences';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';
import {
  buildOperationalLedgerViews,
  computeLedgerTotals,
  filterLedgerViews,
  sortLedgerViews,
  uniqueLedgerMonths,
  uniqueLedgerTenants,
  type LedgerFilterId,
  type LedgerSortId,
  type OperationalLedgerView,
} from '@/src/utils/operational-payment-ledger';
import { buildOperationalContractViews } from '@/src/utils/operational-contracts';

const FILTERS: { id: LedgerFilterId; ar: string; en: string }[] = [
  { id: 'all', ar: 'الكل', en: 'All' },
  { id: 'paid', ar: 'مدفوع', en: 'Paid' },
  { id: 'partial', ar: 'جزئي', en: 'Partial' },
  { id: 'late', ar: 'متأخر', en: 'Late' },
  { id: 'arrears', ar: 'متأخرات', en: 'Arrears' },
  { id: 'needs_review', ar: 'يحتاج مراجعة', en: 'Needs review' },
];

const SORTS: { id: LedgerSortId; ar: string; en: string }[] = [
  { id: 'newest', ar: 'الأحدث', en: 'Newest' },
  { id: 'remaining', ar: 'المتبقي', en: 'Remaining' },
  { id: 'unit', ar: 'الوحدة', en: 'Unit' },
  { id: 'tenant', ar: 'المستأجر', en: 'Tenant' },
];

function fmtMoney(n: number, ar: boolean) {
  return `${Number(n || 0).toLocaleString()} ${ar ? 'ر.س' : 'SAR'}`;
}

export default function PaymentsScreen() {
  const { t, isRTL, lang } = useI18n();
  const ar = lang === 'ar' || !!isRTL;
  const { countEnabled } = useNotificationPrefs();
  const { state: osState, reload: reloadOS } = usePropertyOS(countEnabled);

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<LedgerFilterId>('all');
  const [sort, setSort] = useState<LedgerSortId>('newest');
  const [monthKey, setMonthKey] = useState<string | undefined>();
  const [tenantId, setTenantId] = useState<string | undefined>();
  const [selected, setSelected] = useState<OperationalLedgerView | null>(null);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showTenantPicker, setShowTenantPicker] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void reloadOS();
    }, [reloadOS]),
  );

  const allViews = useMemo(() => buildOperationalLedgerViews(osState, ar), [osState, ar]);
  const months = useMemo(() => uniqueLedgerMonths(allViews), [allViews]);
  const tenants = useMemo(() => uniqueLedgerTenants(allViews), [allViews]);

  // month/tenant are independent narrowing selectors now — status filter combines
  // with them so "who paid vs who is late in month X" is answerable (Bug-5).
  const effectiveFilter = filter === 'month' || filter === 'tenant' ? 'all' : filter;

  const visible = useMemo(
    () => sortLedgerViews(filterLedgerViews(allViews, query, effectiveFilter, monthKey, tenantId), sort),
    [allViews, query, effectiveFilter, monthKey, tenantId, sort],
  );

  const totals = useMemo(() => computeLedgerTotals(allViews), [allViews]);
  const visibleTotals = useMemo(() => computeLedgerTotals(visible), [visible]);

  const contractViews = useMemo(() => buildOperationalContractViews(osState, ar), [osState, ar]);

  const applyKpiFilter = (kind: 'due' | 'paid' | 'remaining' | 'late') => {
    Haptics.selectionAsync();
    if (kind === 'late' || kind === 'remaining') setFilter('arrears');
    else if (kind === 'paid') setFilter('paid');
    else setFilter('all');
  };

  return (
    <ScreenScaffold testID="payments-screen">
      <StoryScreenHeader question={t('op.payments.title')} hint={t('op.payments.sub')} showBack={false} />
      <OpsNavChrome
        crumbs={[ar ? 'تشغيل العقار' : 'Ops', ar ? 'دفتر المدفوعات' : 'Payment ledger']}
        propertyName={osState.property?.name}
        resultCount={allViews.length}
        resultLabel={ar ? 'سجل شهر' : 'month rows'}
        rtl={!!isRTL}
      />

      {allViews.length === 0 ? (
        <AliveEmpty title={t('op.payments.title')} body={t('op.payments.empty')} />
      ) : (
        <View style={{ marginBottom: spacing.lg }}>
          <Text style={[styles.badge, isRTL && styles.rtl]}>
            {ar ? 'دفتر تشغيلي' : 'Operational ledger'} · {allViews.length} {ar ? 'سجل شهر' : 'month rows'}
          </Text>

          <View style={[styles.kpiRow, isRTL && styles.rowRtl]}>
            <Pressable style={styles.kpi} onPress={() => applyKpiFilter('due')} testID="ledger-kpi-due">
              <Text style={styles.kpiLabel}>{ar ? 'إجمالي المستحق' : 'Total due'}</Text>
              <Text style={styles.kpiVal}>{fmtMoney(totals.totalDue, ar)}</Text>
            </Pressable>
            <Pressable style={styles.kpi} onPress={() => applyKpiFilter('paid')} testID="ledger-kpi-paid">
              <Text style={styles.kpiLabel}>{ar ? 'إجمالي المدفوع' : 'Total paid'}</Text>
              <Text style={[styles.kpiVal, { color: colors.emerald }]}>{fmtMoney(totals.totalPaid, ar)}</Text>
            </Pressable>
            <Pressable style={styles.kpi} onPress={() => applyKpiFilter('remaining')} testID="ledger-kpi-remaining">
              <Text style={styles.kpiLabel}>{ar ? 'إجمالي المتبقي' : 'Total remaining'}</Text>
              <Text style={[styles.kpiVal, { color: colors.danger }]}>{fmtMoney(totals.totalRemaining, ar)}</Text>
            </Pressable>
            <Pressable style={styles.kpi} onPress={() => applyKpiFilter('late')} testID="ledger-kpi-late">
              <Text style={styles.kpiLabel}>{ar ? 'أشهر متأخرة' : 'Late months'}</Text>
              <Text style={[styles.kpiVal, { color: colors.gold }]}>{totals.lateMonthCount}</Text>
            </Pressable>
          </View>

          {filter !== 'all' || monthKey || tenantId ? (
            <Text style={[styles.filterHint, isRTL && styles.rtl]}>
              {ar ? 'عرض مفلتر' : 'Filtered'}: {visibleTotals.rowCount} / {totals.rowCount}
            </Text>
          ) : null}

          <TextInput
            testID="ledger-search"
            value={query}
            onChangeText={setQuery}
            placeholder={ar ? 'بحث: الاسم، الجوال، الوحدة، العقد، الشهر' : 'Search name, phone, unit, contract, month'}
            placeholderTextColor={colors.textSubtle}
            style={[styles.search, isRTL && styles.rtl]}
          />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            {FILTERS.map((f) => (
              <Pressable
                key={f.id}
                testID={`ledger-filter-${f.id}`}
                onPress={() => {
                  Haptics.selectionAsync();
                  setFilter(f.id);
                  // Keep month/tenant narrowing so "who paid / who is late in
                  // month X" works; "All" resets everything.
                  if (f.id === 'all') {
                    setMonthKey(undefined);
                    setTenantId(undefined);
                  }
                }}
                style={[styles.chip, filter === f.id && styles.chipOn]}
              >
                <Text style={[styles.chipText, filter === f.id && styles.chipTextOn]}>{ar ? f.ar : f.en}</Text>
              </Pressable>
            ))}
            <Pressable
              testID="ledger-filter-month"
              onPress={() => { Haptics.selectionAsync(); setShowMonthPicker(true); }}
              style={[styles.chip, !!monthKey && styles.chipOn]}
            >
              <Text style={[styles.chipText, !!monthKey && styles.chipTextOn]}>
                {monthKey ? months.find((m) => m.key === monthKey)?.label || monthKey : ar ? 'شهر' : 'Month'}
              </Text>
            </Pressable>
            <Pressable
              testID="ledger-filter-tenant"
              onPress={() => { Haptics.selectionAsync(); setShowTenantPicker(true); }}
              style={[styles.chip, !!tenantId && styles.chipOn]}
            >
              <Text style={[styles.chipText, !!tenantId && styles.chipTextOn]}>
                {tenantId ? tenants.find((x) => x.id === tenantId)?.name || tenantId : ar ? 'مستأجر' : 'Tenant'}
              </Text>
            </Pressable>
          </ScrollView>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            {SORTS.map((s) => (
              <Pressable
                key={s.id}
                testID={`ledger-sort-${s.id}`}
                onPress={() => { Haptics.selectionAsync(); setSort(s.id); }}
                style={[styles.chip, sort === s.id && styles.chipOnSort]}
              >
                <Text style={[styles.chipText, sort === s.id && styles.chipTextOn]}>
                  {(ar ? 'ترتيب: ' : 'Sort: ') + (ar ? s.ar : s.en)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {visible.map((v, i) => (
            <OperationalPaymentLedgerCard
              key={v.id}
              view={v}
              ar={ar}
              rtl={!!isRTL}
              delay={25 * Math.min(i, 14)}
              testID={`ledger-row-${v.id}`}
              onPress={() => setSelected(v)}
            />
          ))}
        </View>
      )}

      {/* Month picker */}
      <Modal visible={showMonthPicker} transparent animationType="fade" onRequestClose={() => setShowMonthPicker(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowMonthPicker(false)}>
          <View style={styles.pickerSheet}>
            <Text style={styles.pickerTitle}>{ar ? 'اختر الشهر' : 'Select month'}</Text>
            <Pressable
              onPress={() => { setMonthKey(undefined); setShowMonthPicker(false); }}
              style={styles.pickerRow}
            >
              <Text style={styles.pickerRowText}>{ar ? 'كل الأشهر' : 'All months'}</Text>
            </Pressable>
            {months.map((m) => (
              <Pressable
                key={m.key}
                onPress={() => { setMonthKey(m.key); setShowMonthPicker(false); }}
                style={styles.pickerRow}
              >
                <Text style={styles.pickerRowText}>{m.label}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Tenant picker */}
      <Modal visible={showTenantPicker} transparent animationType="fade" onRequestClose={() => setShowTenantPicker(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowTenantPicker(false)}>
          <View style={styles.pickerSheet}>
            <Text style={styles.pickerTitle}>{ar ? 'اختر المستأجر' : 'Select tenant'}</Text>
            <Pressable
              onPress={() => { setTenantId(undefined); setShowTenantPicker(false); }}
              style={styles.pickerRow}
            >
              <Text style={styles.pickerRowText}>{ar ? 'كل المستأجرين' : 'All tenants'}</Text>
            </Pressable>
            {tenants.map((tn) => (
              <Pressable
                key={tn.id}
                onPress={() => { setTenantId(tn.id); setShowTenantPicker(false); }}
                style={styles.pickerRow}
              >
                <Text style={styles.pickerRowText}>{tn.name}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Drill-down */}
      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.detailSheet}>
            <View style={[styles.detailHead, isRTL && styles.rowRtl]}>
              <Text style={[styles.detailTitle, isRTL && styles.rtl]}>{ar ? 'تفاصيل الشهر' : 'Month detail'}</Text>
              <Pressable onPress={() => setSelected(null)} testID="ledger-detail-close">
                <Text style={styles.close}>{ar ? 'إغلاق' : 'Close'}</Text>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
              {selected ? (
                <>
                  <GlassCard padding={14} radiusToken="md" style={{ marginBottom: spacing.sm }}>
                    <Text style={[styles.detailLine, isRTL && styles.rtl]}>
                      {selected.monthLabel}: {fmtMoney(selected.due, ar)} / {fmtMoney(selected.paid, ar)} / {fmtMoney(selected.remaining, ar)}
                    </Text>
                    <Text style={[styles.detailDim, isRTL && styles.rtl]}>{selected.paymentStatusLabel}</Text>
                  </GlassCard>

                  <Text style={[styles.section, isRTL && styles.rtl]}>{ar ? 'بطاقة المستأجر' : 'Tenant'}</Text>
                  {selected.tenant ? (
                    <OperationalTenantCard tenant={selected.tenant} state={osState} testID="ledger-detail-tenant" />
                  ) : (
                    <Text style={styles.muted}>Requires Source Support</Text>
                  )}

                  <Text style={[styles.section, isRTL && styles.rtl]}>{ar ? 'بيانات العقد' : 'Contract'}</Text>
                  {(() => {
                    const cv = contractViews.find((c) => c.tenantId === selected.tenantId);
                    return cv ? (
                      <OperationalContractCard view={cv} ar={ar} rtl={!!isRTL} testID="ledger-detail-contract" />
                    ) : (
                      <Text style={styles.muted}>Requires Source Support</Text>
                    );
                  })()}

                  <Text style={[styles.section, isRTL && styles.rtl]}>{ar ? 'الوحدة' : 'Unit'}</Text>
                  <GlassCard padding={14} radiusToken="md">
                    {selected.unit ? (
                      <>
                        <Text style={styles.detailLine}>{ar ? 'رقم' : 'No.'}: {selected.unit.number}</Text>
                        <Text style={styles.detailLine}>{ar ? 'إيجار' : 'Rent'}: {fmtMoney(selected.unit.rentAmount, ar)}</Text>
                        <Text style={styles.detailLine}>{ar ? 'الحالة' : 'Status'}: {selected.unit.status}</Text>
                      </>
                    ) : (
                      <Text style={styles.muted}>Requires Source Support</Text>
                    )}
                  </GlassCard>

                  <Text style={[styles.section, isRTL && styles.rtl]}>{ar ? 'جميع أشهر المستأجر' : 'All tenant months'}</Text>
                  {allViews
                    .filter((v) => v.tenantId === selected.tenantId)
                    .sort((a, b) => b.monthKey.localeCompare(a.monthKey))
                    .map((v) => (
                      <Text key={v.id} style={[styles.monthLine, isRTL && styles.rtl]}>
                        {v.monthLabel}: {fmtMoney(v.due, ar)} / {fmtMoney(v.paid, ar)} / {fmtMoney(v.remaining, ar)} · {v.paymentStatusLabel}
                      </Text>
                    ))}

                  <Text style={[styles.section, isRTL && styles.rtl]}>{ar ? 'دفعات مسجلة فعلية' : 'Registered payments'}</Text>
                  <GlassCard padding={14} radiusToken="md">
                    {selected.linkedPayments.length > 0 ? (
                      selected.linkedPayments.map((p) => (
                        <Text key={p.id} style={styles.detailLine}>
                          {fmtMoney(p.amount, ar)} · {p.paidAt?.slice(0, 10) || 'Requires Source Support'}
                        </Text>
                      ))
                    ) : (
                      <Text style={styles.muted}>Requires Source Support</Text>
                    )}
                  </GlassCard>
                </>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  badge: {
    color: colors.gold,
    fontSize: 10,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
    fontWeight: typography.weight.semibold,
  },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  rowRtl: { flexDirection: 'row-reverse' },
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.sm },
  kpi: {
    flex: 1,
    minWidth: '45%',
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  kpiLabel: { color: colors.textMuted, fontSize: 10, letterSpacing: 0.8 },
  kpiVal: { color: colors.text, fontSize: 14, fontWeight: typography.weight.semibold, marginTop: 4 },
  filterHint: { color: colors.textMuted, fontSize: 11, marginBottom: spacing.xs },
  search: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    marginBottom: spacing.sm,
  },
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
  chipOnSort: { borderColor: colors.emeraldEdge, backgroundColor: colors.emeraldSoft },
  chipText: { color: colors.textMuted, fontSize: 12 },
  chipTextOn: { color: colors.text, fontWeight: typography.weight.semibold },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  pickerSheet: {
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.md,
    maxHeight: '50%',
  },
  pickerTitle: { color: colors.text, fontSize: 15, fontWeight: typography.weight.semibold, marginBottom: spacing.sm },
  pickerRow: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  pickerRowText: { color: colors.text, fontSize: 14 },
  detailSheet: {
    maxHeight: '90%',
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.md,
  },
  detailHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  detailTitle: { color: colors.text, fontSize: 16, fontWeight: typography.weight.semibold },
  close: { color: colors.gold, fontSize: 14 },
  section: {
    color: colors.gold,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    fontWeight: typography.weight.semibold,
  },
  detailLine: { color: colors.text, fontSize: 13, marginBottom: 4 },
  detailDim: { color: colors.textMuted, fontSize: 12 },
  monthLine: { color: colors.textMuted, fontSize: 12, marginBottom: 6 },
  muted: { color: colors.textMuted, fontSize: 13 },
});
