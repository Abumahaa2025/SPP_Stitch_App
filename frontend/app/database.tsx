/**
 * Database center — professional spreadsheet of property / units / tenants / months.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, TextInput, Modal, Alert,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';

import { ScreenScaffold } from '@/src/components/ScreenScaffold';
import { StoryScreenHeader } from '@/src/components/StoryScreenHeader';
import { GlassCard } from '@/src/components/GlassCard';
import { AliveEmpty } from '@/src/components/AliveEmpty';
import { buildTenantOperationalView } from '@/src/components/OperationalTenantCard';
import { usePropertyOS } from '@/src/hooks/usePropertyOS';
import { useNotificationPrefs } from '@/src/hooks/usePreferences';
import {
  loadCanonicalTenants,
  syncCanonicalFromPropertyOS,
} from '@/src/utils/canonical-tenant-store';
import { buildPropertyExcelCsv, sharePropertyExcel } from '@/src/utils/property-excel-export';
import type { CanonicalTenant } from '@/src/types/canonical-tenant';
import type { PaymentLedgerEntry } from '@/src/types/property-os';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';

function fmtMoney(n: number, ar: boolean) {
  return `${Number(n || 0).toLocaleString()} ${ar ? 'ر.س' : 'SAR'}`;
}

export default function DatabaseCenterScreen() {
  const { isRTL, lang } = useI18n();
  const ar = lang === 'ar' || !!isRTL;
  const router = useRouter();
  const { countEnabled } = useNotificationPrefs();
  const { state: os, reload } = usePropertyOS(countEnabled);
  const [tenants, setTenants] = useState<CanonicalTenant[]>([]);
  const [query, setQuery] = useState('');
  const [detail, setDetail] = useState<CanonicalTenant | null>(null);

  const refresh = useCallback(async () => {
    await reload();
    const raw = await import('@/src/utils/storage').then((m) => m.storage.getItem<string>('spp.propertyOS', ''));
    let s = await loadCanonicalTenants();
    if (raw) {
      try {
        const osState = JSON.parse(raw);
        if (osState?.tenants?.length) {
          s = await syncCanonicalFromPropertyOS(osState, { lang: ar ? 'ar' : 'en' });
        }
      } catch { /* ignore */ }
    }
    setTenants(s.tenants.filter((t) => t.status === 'active'));
  }, [reload, ar]);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = tenants.length
      ? tenants
      : os.tenants.map((t) => {
          const unit = os.units.find((u) => u.id === t.unitId);
          const contract = os.contracts.find((c) => c.tenantId === t.id);
          return {
            id: t.id,
            osTenantId: t.id,
            unitId: t.unitId,
            unitNumber: unit?.number || '—',
            name: t.name,
            phone: t.phone,
            rentAmount: Number(contract?.rentAmount ?? unit?.rentAmount ?? 0),
            contractNumber: contract?.number || '',
            status: 'active' as const,
            official: true,
            source: 'import' as const,
            notes: '',
            updatedAt: '',
          } satisfies CanonicalTenant;
        });
    if (!q) return list;
    return list.filter((t) =>
      [t.name, t.phone, t.unitNumber, t.contractNumber].join(' ').toLowerCase().includes(q));
  }, [tenants, os, query]);

  const monthsFor = (t: CanonicalTenant): PaymentLedgerEntry[] => {
    const id = t.osTenantId;
    if (!id) return [];
    return (os.paymentLedger || [])
      .filter((l) => l.tenantId === id)
      .sort((a, b) => String(a.monthKey).localeCompare(String(b.monthKey)))
      .slice(-8);
  };

  const exportExcel = async () => {
    try {
      const csv = await buildPropertyExcelCsv(os, ar);
      await sharePropertyExcel(csv, os.property?.name || 'spp-database');
    } catch (e: any) {
      Alert.alert(ar ? 'تعذر التصدير' : 'Export failed', String(e?.message || e));
    }
  };

  if (!os.property) {
    return (
      <ScreenScaffold testID="database-center">
        <StoryScreenHeader
          question={ar ? 'مركز البيانات' : 'Database center'}
          hint={ar ? 'جدول احترافي لكل بيانات العقار' : 'Professional table of all property data'}
          showBack
        />
        <AliveEmpty
          title={ar ? 'لا بيانات عقار بعد' : 'No property data yet'}
          body={ar ? 'أضف عقاراً أو استورد كشفاً لبناء الجدول.' : 'Add a property or import a statement to build the table.'}
          actionLabel={ar ? 'إضافة عقار' : 'Add property'}
          onAction={() => router.push('/owner' as any)}
        />
      </ScreenScaffold>
    );
  }

  const detailOs = detail?.osTenantId
    ? os.tenants.find((x) => x.id === detail.osTenantId)
    : undefined;
  const detailView = detailOs ? buildTenantOperationalView(detailOs, os, ar) : null;
  const detailMonths = detail ? monthsFor(detail) : [];

  return (
    <ScreenScaffold testID="database-center">
      <StoryScreenHeader
        question={ar ? 'مركز البيانات' : 'Database center'}
        hint={ar ? `${os.property.name} — جدول احترافي · اضغط الصف للتفاصيل` : `${os.property.name} — tap a row for details`}
        showBack
      />

      <GlassCard padding={14} radiusToken="md" edge="gold" style={{ marginBottom: spacing.md }}>
        <Text style={[styles.propTitle, isRTL && styles.rtl]}>{os.property.name}</Text>
        <Text style={[styles.propMeta, isRTL && styles.rtl]}>
          {ar ? 'وحدات' : 'Units'} {os.units.length}
          {' · '}
          {ar ? 'مستأجرون' : 'Tenants'} {rows.length}
          {' · '}
          {ar ? 'دفتر أشهر' : 'Ledger'} {(os.paymentLedger || []).length}
        </Text>
        <View style={[styles.topActions, isRTL && styles.rowRtl]}>
          <Pressable style={styles.exportBtn} onPress={exportExcel}>
            <Feather name="download" size={14} color={colors.bg} />
            <Text style={styles.exportText}>{ar ? 'حفظ إكسل' : 'Save Excel'}</Text>
          </Pressable>
          <Pressable style={styles.linkBtn} onPress={() => router.push('/tenants/official' as any)}>
            <Text style={styles.linkText}>{ar ? 'سجل رسمي ←' : 'Official registry →'}</Text>
          </Pressable>
        </View>
      </GlassCard>

      <TextInput
        value={query}
        onChangeText={(v) => {
          setQuery(v);
          const q = v.trim().toLowerCase();
          if (q.length >= 2) {
            const hit = rows.find((t) =>
              [t.name, t.phone, t.unitNumber].join(' ').toLowerCase().includes(q));
            // Don't auto-open while typing every key — only exact-ish single match after pause handled by tap
          }
        }}
        onSubmitEditing={() => {
          const q = query.trim().toLowerCase();
          if (!q) return;
          const hit = rows.find((t) => t.name.toLowerCase().includes(q)
            || t.phone.includes(q)
            || (t.unitNumber || '').toLowerCase().includes(q));
          if (hit) {
            Haptics.selectionAsync();
            setDetail(hit);
          }
        }}
        placeholder={ar ? 'بحث مستأجر / وحدة / جوال — Enter لفتح صفحة مصغرة' : 'Search tenant / unit / phone — Enter for mini page'}
        placeholderTextColor={colors.textSubtle}
        style={[styles.search, isRTL && styles.rtl]}
        returnKeyType="search"
        testID="database-search"
      />

      <GlassCard padding={0} radiusToken="md" edge="emerald" style={{ marginBottom: spacing.lg }}>
        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View style={styles.sheet}>
            <View style={[styles.head, isRTL && styles.rowRtl]}>
              <Text style={[styles.th, styles.cName]}>{ar ? 'المستأجر' : 'Tenant'}</Text>
              <Text style={[styles.th, styles.cUnit]}>{ar ? 'وحدة' : 'Unit'}</Text>
              <Text style={[styles.th, styles.cRent]}>{ar ? 'إيجار' : 'Rent'}</Text>
              <Text style={[styles.th, styles.cPhone]}>{ar ? 'جوال' : 'Phone'}</Text>
              <Text style={[styles.th, styles.cContract]}>{ar ? 'عقد' : 'Contract'}</Text>
              <Text style={[styles.th, styles.cArrears]}>{ar ? 'متأخرات' : 'Arrears'}</Text>
            </View>
            {rows.length === 0 ? (
              <Text style={[styles.empty, isRTL && styles.rtl]}>
                {ar ? 'لا صفوف بعد — استورد كشفاً أو أضف مستأجرين.' : 'No rows yet — import a statement or add tenants.'}
              </Text>
            ) : (
              rows.map((t) => {
                const months = monthsFor(t);
                const arrears = months.reduce((s, m) => s + (Number(m.remaining) || 0), 0);
                return (
                  <Pressable
                    key={t.id}
                    style={[styles.row, isRTL && styles.rowRtl]}
                    onPress={() => { Haptics.selectionAsync(); setDetail(t); }}
                    testID={`database-row-${t.id}`}
                  >
                    <Text style={[styles.tdStrong, styles.cName]} numberOfLines={2}>{t.name}</Text>
                    <Text style={[styles.td, styles.cUnit]}>{t.unitNumber}</Text>
                    <Text style={[styles.td, styles.cRent]}>{fmtMoney(t.rentAmount, ar)}</Text>
                    <Text style={[styles.td, styles.cPhone]} numberOfLines={1}>{t.phone || '—'}</Text>
                    <Text style={[styles.td, styles.cContract]} numberOfLines={1}>{t.contractNumber || '—'}</Text>
                    <Text style={[styles.td, styles.cArrears, arrears > 0 && styles.hot]}>
                      {fmtMoney(arrears, ar)}
                    </Text>
                  </Pressable>
                );
              })
            )}
          </View>
        </ScrollView>
      </GlassCard>

      <Modal visible={!!detail} animationType="slide" onRequestClose={() => setDetail(null)}>
        <View style={styles.miniPage} testID="database-mini-detail">
          <View style={[styles.miniTop, isRTL && styles.rowRtl]}>
            <Pressable onPress={() => setDetail(null)} style={styles.miniBack}>
              <Feather name={isRTL ? 'chevron-right' : 'chevron-left'} size={22} color={colors.gold} />
              <Text style={styles.miniBackText}>{ar ? 'رجوع' : 'Back'}</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            <Text style={[styles.miniTitle, isRTL && styles.rtl]}>{detail?.name}</Text>
            <GlassCard padding={0} radiusToken="md" edge="gold" style={{ marginTop: 12 }}>
              <MiniRow ar={ar} label={ar ? 'الوحدة' : 'Unit'} value={detail?.unitNumber || '—'} />
              <MiniRow ar={ar} label={ar ? 'الجوال' : 'Phone'} value={detail?.phone || '—'} />
              <MiniRow ar={ar} label={ar ? 'الإيجار' : 'Rent'} value={fmtMoney(detail?.rentAmount || 0, ar)} />
              <MiniRow ar={ar} label={ar ? 'العقد' : 'Contract'} value={detail?.contractNumber || detailView?.contractNumber || '—'} />
              <MiniRow ar={ar} label={ar ? 'العقار' : 'Property'} value={os.property.name} />
              {detailView ? (
                <>
                  <MiniRow ar={ar} label={ar ? 'مدفوع' : 'Paid months'} value={String(detailView.paidMonths)} />
                  <MiniRow ar={ar} label={ar ? 'متأخر' : 'Late months'} value={String(detailView.lateMonths)} />
                  <MiniRow ar={ar} label={ar ? 'متأخرات' : 'Arrears'} value={fmtMoney(detailView.arrearsTotal, ar)} />
                  <MiniRow ar={ar} label={ar ? 'التزام' : 'Compliance'} value={detailView.complianceLabel} />
                </>
              ) : null}
            </GlassCard>
            <Text style={[styles.monthsTitle, isRTL && styles.rtl]}>
              {ar ? 'الأشهر (حتى 8)' : 'Months (up to 8)'}
            </Text>
            {detailMonths.length === 0 ? (
              <Text style={[styles.empty, isRTL && styles.rtl]}>{ar ? 'لا أشهر في الدفتر' : 'No ledger months'}</Text>
            ) : detailMonths.map((m) => (
              <GlassCard key={m.id} padding={12} radiusToken="md" style={{ marginBottom: 8 }}>
                <Text style={[styles.tdStrong, isRTL && styles.rtl]}>{m.monthLabel || m.monthKey}</Text>
                <Text style={[styles.td, isRTL && styles.rtl]}>
                  {ar ? 'مستحق' : 'Due'} {fmtMoney(m.due, ar)}
                  {' · '}
                  {ar ? 'مدفوع' : 'Paid'} {fmtMoney(m.paid, ar)}
                  {' · '}
                  {ar ? 'متبقي' : 'Left'} {fmtMoney(m.remaining, ar)}
                </Text>
              </GlassCard>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </ScreenScaffold>
  );
}

function MiniRow({ ar, label, value }: { ar: boolean; label: string; value: string }) {
  return (
    <View style={[styles.miniRow, ar && styles.rowRtl]}>
      <Text style={[styles.miniLabel, ar && styles.rtl]}>{label}</Text>
      <Text style={[styles.miniValue, ar && styles.rtl]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  propTitle: { color: colors.text, fontSize: 18, fontWeight: typography.weight.semibold },
  propMeta: { color: colors.textDim, fontSize: 12, marginTop: 6 },
  topActions: { flexDirection: 'row', gap: 10, marginTop: 12, alignItems: 'center' },
  rowRtl: { flexDirection: 'row-reverse' },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  exportBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.emerald, paddingHorizontal: 12, paddingVertical: 10, borderRadius: radius.md,
  },
  exportText: { color: colors.bg, fontWeight: typography.weight.semibold, fontSize: 12 },
  linkBtn: { paddingVertical: 8 },
  linkText: { color: colors.gold, fontWeight: typography.weight.semibold, fontSize: 12 },
  search: {
    marginBottom: spacing.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: 12, paddingVertical: 10, color: colors.text,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  sheet: { minWidth: 720 },
  head: {
    flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 8,
    backgroundColor: 'rgba(212,175,55,0.10)', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  th: { color: colors.gold, fontSize: 11, fontWeight: typography.weight.semibold, paddingHorizontal: 4 },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  td: { color: colors.textDim, fontSize: 12, paddingHorizontal: 4 },
  tdStrong: { color: colors.text, fontSize: 13, fontWeight: typography.weight.semibold, paddingHorizontal: 4 },
  cName: { width: 150 },
  cUnit: { width: 64 },
  cRent: { width: 100 },
  cPhone: { width: 110 },
  cContract: { width: 100 },
  cArrears: { width: 100 },
  hot: { color: colors.warning },
  empty: { color: colors.textDim, fontSize: 13, padding: 16 },
  miniPage: { flex: 1, backgroundColor: colors.bg },
  miniTop: { flexDirection: 'row', paddingTop: 52, paddingHorizontal: 16, paddingBottom: 8 },
  miniBack: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  miniBackText: { color: colors.gold, fontWeight: typography.weight.semibold, fontSize: 15 },
  miniTitle: { color: colors.text, fontSize: 22, fontWeight: typography.weight.semibold },
  miniRow: {
    flexDirection: 'row', justifyContent: 'space-between', gap: 12,
    paddingVertical: 10, paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider,
  },
  miniLabel: { color: colors.textMuted, fontSize: 12, flex: 1 },
  miniValue: { color: colors.text, fontSize: 13, fontWeight: typography.weight.semibold, flex: 1.2 },
  monthsTitle: {
    color: colors.textMuted, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase',
    marginTop: 16, marginBottom: 8,
  },
});
