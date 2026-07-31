/**
 * Stitch: ملف المستأجر / Tenant Detail Profile
 * Tabs: Overview · Contracts · Payments · Maintenance + Contact + Extension Offer
 * Uses existing SPP design tokens — no Stitch visual identity.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Linking, Share, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';

import { ScreenScaffold } from '@/src/components/ScreenScaffold';
import { StoryScreenHeader } from '@/src/components/StoryScreenHeader';
import { GlassCard } from '@/src/components/GlassCard';
import { AliveEmpty } from '@/src/components/AliveEmpty';
import {
  buildTenantOperationalView,
} from '@/src/components/OperationalTenantCard';
import { usePropertyOS } from '@/src/hooks/usePropertyOS';
import { useOperational } from '@/src/hooks/useOperational';
import { useNotificationPrefs } from '@/src/hooks/usePreferences';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';

type TabId = 'overview' | 'contracts' | 'payments' | 'maintenance';

const TABS: { id: TabId; ar: string; en: string }[] = [
  { id: 'overview', ar: 'نظرة عامة', en: 'Overview' },
  { id: 'contracts', ar: 'العقود', en: 'Contracts' },
  { id: 'payments', ar: 'المدفوعات', en: 'Payments' },
  { id: 'maintenance', ar: 'الصيانة', en: 'Maintenance' },
];

function fmtMoney(n: number, ar: boolean) {
  return `${Number(n || 0).toLocaleString()} ${ar ? 'ر.س' : 'SAR'}`;
}

export default function TenantDetailScreen() {
  const { t, isRTL, lang } = useI18n();
  const ar = lang === 'ar' || !!isRTL;
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { countEnabled } = useNotificationPrefs();
  const { state } = usePropertyOS(countEnabled);
  const { ticketsForUnit, openTickets } = useOperational();
  const [tab, setTab] = useState<TabId>('overview');

  const tenant = state.tenants.find((x) => x.id === id);
  const view = useMemo(
    () => (tenant ? buildTenantOperationalView(tenant, state, ar) : null),
    [tenant, state, ar],
  );
  const unit = tenant ? state.units.find((u) => u.id === tenant.unitId) : undefined;
  const contract = tenant ? state.contracts.find((c) => c.tenantId === tenant.id) : undefined;
  const ledger = tenant
    ? (state.paymentLedger || []).filter((l) => l.tenantId === tenant.id)
    : [];
  const unitTickets = unit ? ticketsForUnit(unit.id) : [];

  if (!tenant || !view) {
    return (
      <ScreenScaffold testID="tenant-detail">
        <StoryScreenHeader question={t('tenant.detail.title' as any)} showBack />
        <AliveEmpty
          title={t('alive.tenants.title')}
          body={t('alive.tenants.body')}
          actionLabel={t('pos.progress.continue')}
          onAction={() => router.push('/tenants' as any)}
        />
      </ScreenScaffold>
    );
  }

  const contactTenant = async () => {
    Haptics.selectionAsync();
    const phone = (view.phone || '').replace(/\s+/g, '');
    if (!phone) {
      Alert.alert(t('tenant.detail.noPhone' as any));
      return;
    }
    const url = phone.startsWith('+') || phone.startsWith('00')
      ? `https://wa.me/${phone.replace(/^\+/, '').replace(/^00/, '')}`
      : `tel:${phone}`;
    Linking.openURL(url).catch(() => Linking.openURL(`tel:${phone}`));
  };

  const extensionOffer = async () => {
    Haptics.selectionAsync();
    const rent = fmtMoney(view.rent, ar);
    const end = view.contractEnd || '—';
    const msg = ar
      ? `عرض تمديد عقد — ${view.name}\nالوحدة ${view.unitNumber}\nالإيجار الحالي: ${rent}\nنهاية العقد: ${end}\nنقترح تمديداً بنفس الشروط مع مراجعة الإيجار.`
      : `Lease extension offer — ${view.name}\nUnit ${view.unitNumber}\nCurrent rent: ${rent}\nContract end: ${end}\nWe propose an extension under current terms with a rent review.`;
    try {
      await Share.share({ message: msg });
    } catch {
      Alert.alert(t('tenant.detail.offerReady' as any), msg);
    }
  };

  return (
    <ScreenScaffold testID="tenant-detail">
      <StoryScreenHeader
        question={view.name}
        hint={`${view.propertyName} · ${ar ? 'وحدة' : 'Unit'} ${view.unitNumber}`}
        showBack
      />

      <View style={[styles.actions, isRTL && styles.rowRtl]}>
        <Pressable testID="tenant-contact" style={styles.actionBtn} onPress={contactTenant}>
          <Feather name="message-circle" size={14} color={colors.gold} />
          <Text style={styles.actionText}>{t('tenant.detail.contact' as any)}</Text>
        </Pressable>
        <Pressable
          testID="tenant-new-maint"
          style={styles.actionBtn}
          onPress={() => {
            Haptics.selectionAsync();
            router.push(`/maintenance/create${unit ? `?unitId=${unit.id}` : ''}` as any);
          }}
        >
          <Feather name="plus-circle" size={14} color={colors.emerald} />
          <Text style={styles.actionText}>{t('tenant.detail.newRequest' as any)}</Text>
        </Pressable>
        <Pressable testID="tenant-extension" style={styles.actionBtn} onPress={extensionOffer}>
          <Feather name="file-text" size={14} color={colors.gold} />
          <Text style={styles.actionText}>{t('tenant.detail.extension' as any)}</Text>
        </Pressable>
      </View>

      <View style={[styles.tabs, isRTL && styles.rowRtl]}>
        {TABS.map((tb) => (
          <Pressable
            key={tb.id}
            testID={`tenant-tab-${tb.id}`}
            onPress={() => { Haptics.selectionAsync(); setTab(tb.id); }}
            style={[styles.tab, tab === tb.id && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === tb.id && styles.tabTextActive]}>
              {ar ? tb.ar : tb.en}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'overview' ? (
        <GlassCard padding={18} radiusToken="lg" edge="gold">
          <Row ar={ar} label={ar ? 'الجوال' : 'Phone'} value={view.phone || '—'} />
          <Row ar={ar} label={ar ? 'الوحدة' : 'Unit'} value={view.unitNumber} />
          <Row ar={ar} label={ar ? 'العقار' : 'Property'} value={view.propertyName} />
          <Row ar={ar} label={ar ? 'قيمة الإيجار' : 'Rent'} value={fmtMoney(view.rent, ar)} />
          <Row ar={ar} label={ar ? 'الالتزام' : 'Compliance'} value={view.complianceLabel} />
          <Row ar={ar} label={ar ? 'المتأخرات' : 'Arrears'} value={fmtMoney(view.arrearsTotal, ar)} />
          <Row ar={ar} label={ar ? 'البلاغات المفتوحة' : 'Open tickets'} value={String(openTickets.filter((x) => x.tenantId === tenant.id).length)} />
        </GlassCard>
      ) : null}

      {tab === 'contracts' ? (
        <GlassCard padding={18} radiusToken="lg">
          {contract ? (
            <>
              <Row ar={ar} label={ar ? 'رقم العقد' : 'Contract no.'} value={view.contractNumber || contract.id} />
              <Row ar={ar} label={ar ? 'البداية' : 'Start'} value={view.contractStart || contract.startDate || '—'} />
              <Row ar={ar} label={ar ? 'النهاية' : 'End'} value={view.contractEnd || contract.endDate || '—'} />
              <Row ar={ar} label={ar ? 'الإيجار' : 'Rent'} value={fmtMoney(view.rent, ar)} />
            </>
          ) : (
            <Text style={[styles.dim, isRTL && styles.rtl]}>{t('tenant.detail.noContract' as any)}</Text>
          )}
        </GlassCard>
      ) : null}

      {tab === 'payments' ? (
        <View style={{ gap: 10 }}>
          {ledger.length === 0 ? (
            <GlassCard padding={18} radiusToken="lg">
              <Text style={[styles.dim, isRTL && styles.rtl]}>{t('tenant.detail.noPayments' as any)}</Text>
            </GlassCard>
          ) : (
            ledger.slice(0, 24).map((row) => (
              <GlassCard key={row.id} padding={14} radiusToken="md">
                <View style={[styles.payRow, isRTL && styles.rowRtl]}>
                  <Text style={[styles.payMonth, isRTL && styles.rtl]}>{row.monthLabel || row.monthKey || row.id}</Text>
                  <Text style={styles.payAmt}>{fmtMoney(Number(row.paid || 0), ar)}</Text>
                </View>
                <Text style={[styles.dim, isRTL && styles.rtl]}>
                  {row.status} · {ar ? 'متبقي' : 'Remaining'} {fmtMoney(Number(row.remaining || 0), ar)}
                </Text>
              </GlassCard>
            ))
          )}
        </View>
      ) : null}

      {tab === 'maintenance' ? (
        <View style={{ gap: 10 }}>
          {unitTickets.length === 0 ? (
            <GlassCard padding={18} radiusToken="lg">
              <Text style={[styles.dim, isRTL && styles.rtl]}>{t('tenant.detail.noMaint' as any)}</Text>
            </GlassCard>
          ) : (
            unitTickets.map((tk) => (
              <Pressable
                key={tk.id}
                onPress={() => { Haptics.selectionAsync(); router.push(`/maintenance/${tk.id}` as any); }}
              >
                <GlassCard padding={14} radiusToken="md">
                  <Text style={[styles.payMonth, isRTL && styles.rtl]}>{tk.title}</Text>
                  <Text style={[styles.dim, isRTL && styles.rtl]}>{tk.status}</Text>
                </GlassCard>
              </Pressable>
            ))
          )}
        </View>
      ) : null}
    </ScreenScaffold>
  );
}

function Row({ ar, label, value }: { ar: boolean; label: string; value: string }) {
  return (
    <View style={[styles.kv, ar && styles.rowRtl]}>
      <Text style={[styles.kvLabel, ar && styles.rtl]}>{label}</Text>
      <Text style={[styles.kvValue, ar && styles.rtl]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md },
  rowRtl: { flexDirection: 'row-reverse' },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  actionText: { color: colors.text, fontSize: 12, fontWeight: typography.weight.medium },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  tabActive: { borderColor: colors.goldEdge, backgroundColor: colors.goldSoft },
  tabText: { color: colors.textDim, fontSize: 12 },
  tabTextActive: { color: colors.gold, fontWeight: typography.weight.semibold },
  kv: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  kvLabel: { color: colors.textMuted, fontSize: 12, flex: 1 },
  kvValue: { color: colors.text, fontSize: 13, fontWeight: typography.weight.semibold, flexShrink: 1 },
  dim: { color: colors.textDim, fontSize: 13 },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  payRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  payMonth: { color: colors.text, fontSize: 14, fontWeight: typography.weight.semibold },
  payAmt: { color: colors.emerald, fontSize: 13, fontWeight: typography.weight.semibold },
});
