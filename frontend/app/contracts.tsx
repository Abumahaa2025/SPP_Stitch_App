/**
 * WP-3 — Professional contracts registry from PropertyOS (Apply) only.
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
import { SetupProgressBar } from '@/src/components/SetupProgressBar';
import { GuidedSetup } from '@/src/components/GuidedSetup';
import { OperationalContractCard } from '@/src/components/OperationalContractCard';
import { OperationalTenantCard } from '@/src/components/OperationalTenantCard';
import { usePropertyOS } from '@/src/hooks/usePropertyOS';
import { useNotificationPrefs } from '@/src/hooks/usePreferences';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';
import { AgentPermissionGate } from '@/src/components/AgentPermissionGate';
import {
  buildOperationalContractViews,
  filterContractViews,
  sortContractViews,
  type ContractFilterId,
  type ContractSortId,
  type OperationalContractView,
} from '@/src/utils/operational-contracts';
import { useRouter } from 'expo-router';

const FILTERS: { id: ContractFilterId; ar: string; en: string }[] = [
  { id: 'all', ar: 'الكل', en: 'All' },
  { id: 'arrears', ar: 'متأخرات', en: 'Arrears' },
  { id: 'incomplete', ar: 'بيانات ناقصة', en: 'Incomplete' },
  { id: 'has_legal_date', ar: 'تاريخ متوفر', en: 'Has legal date' },
  { id: 'needs_review', ar: 'يحتاج مراجعة', en: 'Needs review' },
];

const SORTS: { id: ContractSortId; ar: string; en: string }[] = [
  { id: 'arrears', ar: 'المتأخرات', en: 'Arrears' },
  { id: 'unit', ar: 'الوحدة', en: 'Unit' },
  { id: 'tenant', ar: 'المستأجر', en: 'Tenant' },
  { id: 'end_date', ar: 'تاريخ النهاية', en: 'End date' },
];

function fmtMoney(n: number, ar: boolean) {
  const s = Number(n || 0).toLocaleString();
  return ar ? `${s} ر.س` : `${s} SAR`;
}

export default function Contracts() {
  const { t, isRTL, lang } = useI18n();
  const ar = lang === 'ar' || !!isRTL;
  const router = useRouter();
  const { countEnabled } = useNotificationPrefs();
  const { state: osState, reload: reloadOS } = usePropertyOS(countEnabled);

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ContractFilterId>('all');
  const [sort, setSort] = useState<ContractSortId>('unit');
  const [selected, setSelected] = useState<OperationalContractView | null>(null);

  useFocusEffect(
    useCallback(() => {
      void reloadOS();
    }, [reloadOS]),
  );

  const allViews = useMemo(() => buildOperationalContractViews(osState, ar), [osState, ar]);
  const visible = useMemo(
    () => sortContractViews(filterContractViews(allViews, query, filter), sort),
    [allViews, query, filter, sort],
  );

  return (
    <AgentPermissionGate perm="contracts">
      <ScreenScaffold testID="contracts-screen">
        <StoryScreenHeader question={t('page.q.contracts')} hint={t('contracts.sub')} showBack testID="contracts-header" />
        <SetupProgressBar compact testID="contracts-setup-progress" />
        <GuidedSetup flowId="tenant" defaultOpen={allViews.length === 0} testID="contracts-guided" />

        {allViews.length > 0 ? (
          <View style={{ marginBottom: spacing.lg }}>
            <Text style={[styles.localBadge, isRTL && styles.rtl]}>
              {t('result.localData' as any)} · {allViews.length} {ar ? 'عقد' : 'contracts'}
            </Text>

            <TextInput
              testID="contracts-search"
              value={query}
              onChangeText={setQuery}
              placeholder={ar ? 'بحث: الاسم، الجوال، الوحدة، رقم العقد' : 'Search: name, phone, unit, contract no.'}
              placeholderTextColor={colors.textSubtle}
              style={[styles.search, isRTL && styles.rtl]}
            />

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              {FILTERS.map((f) => {
                const on = filter === f.id;
                return (
                  <Pressable
                    key={f.id}
                    testID={`contracts-filter-${f.id}`}
                    onPress={() => { Haptics.selectionAsync(); setFilter(f.id); }}
                    style={[styles.chip, on && styles.chipOn]}
                  >
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{ar ? f.ar : f.en}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              {SORTS.map((s) => {
                const on = sort === s.id;
                return (
                  <Pressable
                    key={s.id}
                    testID={`contracts-sort-${s.id}`}
                    onPress={() => { Haptics.selectionAsync(); setSort(s.id); }}
                    style={[styles.chip, on && styles.chipOnSort]}
                  >
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>
                      {(ar ? 'ترتيب: ' : 'Sort: ') + (ar ? s.ar : s.en)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {visible.map((v, i) => (
              <OperationalContractCard
                key={v.id}
                view={v}
                ar={ar}
                rtl={!!isRTL}
                delay={30 * Math.min(i, 12)}
                testID={`os-contract-${v.id}`}
                onPress={() => setSelected(v)}
              />
            ))}
            {visible.length === 0 ? (
              <Text style={[styles.emptyFilter, isRTL && styles.rtl]}>
                {ar ? 'لا نتائج لهذا البحث/الفلتر' : 'No results for this search/filter'}
              </Text>
            ) : null}
          </View>
        ) : (
          <AliveEmpty
            title={t('alive.contracts.title')}
            body={t('alive.contracts.body')}
            nextHint={t('pos.progress.nextLine' as any).replace('{next}', t('pos.phase.contracts' as any))}
            actionLabel={t('pos.progress.continue')}
            onAction={() => router.push('/setup/property-os?phase=contracts' as any)}
          />
        )}

        <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalSheet}>
              <View style={[styles.modalHead, isRTL && styles.rowRtl]}>
                <Text style={[styles.modalTitle, isRTL && styles.rtl]}>
                  {ar ? 'تفاصيل العقد' : 'Contract detail'}
                </Text>
                <Pressable onPress={() => setSelected(null)} testID="contracts-detail-close">
                  <Text style={styles.close}>{ar ? 'إغلاق' : 'Close'}</Text>
                </Pressable>
              </View>
              <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
                {selected ? (
                  <>
                    <Text style={[styles.section, isRTL && styles.rtl]}>{ar ? 'بطاقة المستأجر' : 'Tenant card'}</Text>
                    {selected.tenant ? (
                      <OperationalTenantCard
                        tenant={selected.tenant}
                        state={osState}
                        testID={`contract-detail-tenant-${selected.tenantId}`}
                      />
                    ) : (
                      <Text style={styles.muted}>Requires Source Support</Text>
                    )}

                    <Text style={[styles.section, isRTL && styles.rtl]}>{ar ? 'دفتر الأشهر' : 'Month ledger'}</Text>
                    <GlassCard padding={14} radiusToken="md">
                      {selected.ledger.length === 0 ? (
                        <Text style={[styles.muted, isRTL && styles.rtl]}>Requires Source Support</Text>
                      ) : (
                        selected.ledger.map((L) => (
                          <View key={L.id} style={[styles.ledgerRow, isRTL && styles.rowRtl]}>
                            <Text style={[styles.ledgerLabel, isRTL && styles.rtl]}>{L.monthLabel || L.monthKey}</Text>
                            <Text style={styles.ledgerVal}>
                              {fmtMoney(L.due, ar)} / {fmtMoney(L.paid, ar)} / {fmtMoney(L.remaining, ar)} · {L.statusLabel || L.status}
                            </Text>
                          </View>
                        ))
                      )}
                    </GlassCard>

                    <Text style={[styles.section, isRTL && styles.rtl]}>{ar ? 'بيانات الوحدة' : 'Unit data'}</Text>
                    <GlassCard padding={14} radiusToken="md">
                      {selected.unit ? (
                        <>
                          <Text style={[styles.unitLine, isRTL && styles.rtl]}>
                            {ar ? 'رقم الوحدة' : 'Unit'}: {selected.unit.number}
                          </Text>
                          <Text style={[styles.unitLine, isRTL && styles.rtl]}>
                            {ar ? 'الحالة' : 'Status'}: {selected.unit.status}
                          </Text>
                          <Text style={[styles.unitLine, isRTL && styles.rtl]}>
                            {ar ? 'الإيجار' : 'Rent'}: {fmtMoney(selected.unit.rentAmount, ar)}
                          </Text>
                          <Text style={[styles.unitLine, isRTL && styles.rtl]}>
                            {ar ? 'النوع' : 'Type'}: {selected.unit.type}
                          </Text>
                        </>
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
    </AgentPermissionGate>
  );
}

const styles = StyleSheet.create({
  localBadge: {
    color: colors.gold,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
    fontWeight: typography.weight.semibold,
  },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  rowRtl: { flexDirection: 'row-reverse' },
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
  emptyFilter: { color: colors.textMuted, fontSize: 13, marginTop: spacing.md },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalSheet: {
    maxHeight: '88%',
    backgroundColor: colors.bgElevated || '#141820',
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.md,
  },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  modalTitle: { color: colors.text, fontSize: 16, fontWeight: typography.weight.semibold },
  close: { color: colors.gold, fontSize: 14 },
  section: {
    color: colors.gold,
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    fontWeight: typography.weight.semibold,
  },
  muted: { color: colors.textMuted, fontSize: 13 },
  ledgerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  ledgerLabel: { color: colors.text, fontSize: 13, flex: 1 },
  ledgerVal: { color: colors.textMuted, fontSize: 11, flexShrink: 1, textAlign: 'left' },
  unitLine: { color: colors.text, fontSize: 13, marginBottom: 6 },
});
