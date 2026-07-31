/**
 * WP-2 — Professional operational tenant card.
 * All figures from PropertyOS (Apply materialisation) — no demo / no invented values.
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { GlassCard } from '@/src/components/GlassCard';
import type {
  ContractRecord,
  PaymentLedgerEntry,
  PropertyOSState,
  TenantRecord,
  UnitRecord,
} from '@/src/types/property-os';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';

type Props = {
  tenant: TenantRecord;
  state: PropertyOSState;
  delay?: number;
  testID?: string;
};

function fmtMoney(n: number, ar: boolean) {
  const s = Number(n || 0).toLocaleString();
  return ar ? `${s} ر.س` : `${s} SAR`;
}

function fieldOrSource(value: string | undefined | null, ar: boolean): { text: string; missing: boolean } {
  const v = (value || '').trim();
  if (!v) return { text: ar ? 'Requires Source Support' : 'Requires Source Support', missing: true };
  return { text: v, missing: false };
}

export type TenantOperationalView = {
  name: string;
  phone: string;
  unitNumber: string;
  propertyName: string;
  contractNumber: string;
  rent: number;
  paidMonths: number;
  lateMonths: number;
  arrearsTotal: number;
  lastPaymentLabel: string;
  lastPaymentAmount: number | null;
  ticketsLabel: string;
  compliance: 'compliant' | 'late' | 'partial' | 'unknown';
  complianceLabel: string;
  contractStart: string;
  contractEnd: string;
  ledgerRows: PaymentLedgerEntry[];
};

export function buildTenantOperationalView(
  tenant: TenantRecord,
  state: PropertyOSState,
  ar: boolean,
): TenantOperationalView {
  const unit: UnitRecord | undefined = state.units.find((u) => u.id === tenant.unitId);
  const contract: ContractRecord | undefined = state.contracts.find((c) => c.tenantId === tenant.id);
  const ledger = (state.paymentLedger || []).filter((l) => l.tenantId === tenant.id);
  const payments = (state.payments || []).filter((p) => p.tenantId === tenant.id);

  const paidMonths = ledger.filter((l) => l.status === 'paid' || (l.paid > 0 && l.remaining <= 0)).length;
  const lateMonths = ledger.filter(
    (l) =>
      l.remaining > 0 ||
      l.status === 'unpaid' ||
      l.status === 'unpaid_confirmed' ||
      l.status === 'partial',
  ).length;
  const arrearsTotal = ledger.reduce((s, l) => s + (Number(l.remaining) || 0), 0);

  // Last payment: prefer real PaymentRecord by paidAt; else last ledger month with paid > 0.
  const sortedPays = [...payments].sort((a, b) => String(b.paidAt).localeCompare(String(a.paidAt)));
  let lastPaymentLabel = '';
  let lastPaymentAmount: number | null = null;
  if (sortedPays[0]) {
    lastPaymentAmount = sortedPays[0].amount;
    lastPaymentLabel = (sortedPays[0].paidAt || '').slice(0, 10);
  } else {
    const paidLedger = [...ledger].filter((l) => l.paid > 0).sort((a, b) => {
      const ka = `${a.year || 0}-${String(a.month || 0).padStart(2, '0')}`;
      const kb = `${b.year || 0}-${String(b.month || 0).padStart(2, '0')}`;
      return kb.localeCompare(ka);
    });
    if (paidLedger[0]) {
      lastPaymentAmount = paidLedger[0].paid;
      lastPaymentLabel = paidLedger[0].monthLabel || paidLedger[0].monthKey;
    }
  }

  let compliance: TenantOperationalView['compliance'] = 'unknown';
  if (ledger.length === 0) compliance = 'unknown';
  else if (arrearsTotal <= 0 && lateMonths === 0) compliance = 'compliant';
  else if (lateMonths > 0 && paidMonths > 0) compliance = 'partial';
  else if (arrearsTotal > 0 || lateMonths > 0) compliance = 'late';

  const complianceLabel =
    compliance === 'compliant'
      ? ar
        ? 'ملتزم'
        : 'Compliant'
      : compliance === 'late'
        ? ar
          ? 'متأخر'
          : 'Late'
        : compliance === 'partial'
          ? ar
            ? 'سداد جزئي / متأخرات'
            : 'Partial / arrears'
          : ar
            ? 'غير محدد من الدفتر'
            : 'Unknown from ledger';

  return {
    name: tenant.name || '—',
    phone: (tenant.phone || '').trim(),
    unitNumber: unit?.number || '—',
    propertyName: state.property?.name || '—',
    contractNumber: (contract?.number || '').trim(),
    rent: Number(contract?.rentAmount ?? unit?.rentAmount ?? 0),
    paidMonths,
    lateMonths,
    arrearsTotal,
    lastPaymentLabel,
    lastPaymentAmount,
    // Detailed maintenance tickets are not in OS yet (WP-1 aggregate only).
    ticketsLabel: ar ? 'Requires Source Support' : 'Requires Source Support',
    compliance,
    complianceLabel,
    contractStart: (contract?.startDate || '').trim(),
    contractEnd: (contract?.endDate || '').trim(),
    ledgerRows: ledger,
  };
}

function Row({
  label,
  value,
  missing,
  rtl,
  tone,
}: {
  label: string;
  value: string;
  missing?: boolean;
  rtl: boolean;
  tone?: 'ok' | 'warn' | 'danger' | 'muted';
}) {
  const color =
    tone === 'ok'
      ? colors.emerald
      : tone === 'warn'
        ? colors.gold
        : tone === 'danger'
          ? colors.danger
          : missing
            ? colors.textMuted
            : colors.text;
  return (
    <View style={[styles.row, rtl && styles.rowRtl]}>
      <Text style={[styles.label, rtl && styles.rtl]}>{label}</Text>
      <Text style={[styles.value, rtl && styles.rtl, { color }]}>{value}</Text>
    </View>
  );
}

export function OperationalTenantCard({ tenant, state, delay = 0, testID }: Props) {
  const { isRTL, lang } = useI18n();
  const router = useRouter();
  const ar = lang === 'ar' || isRTL;
  const view = useMemo(() => buildTenantOperationalView(tenant, state, ar), [tenant, state, ar]);

  const phone = fieldOrSource(view.phone, ar);
  const contractNo = fieldOrSource(view.contractNumber, ar);
  const lastPay =
    view.lastPaymentAmount != null && view.lastPaymentLabel
      ? `${fmtMoney(view.lastPaymentAmount, ar)} · ${view.lastPaymentLabel}`
      : ar
        ? 'Requires Source Support'
        : 'Requires Source Support';
  const lastPayMissing = view.lastPaymentAmount == null;

  const complianceTone: 'ok' | 'warn' | 'danger' | 'muted' =
    view.compliance === 'compliant' ? 'ok' : view.compliance === 'late' ? 'danger' : view.compliance === 'partial' ? 'warn' : 'muted';

  return (
    <Animated.View entering={FadeInDown.duration(450).delay(delay)} testID={testID}>
      <Pressable
        onPress={() => {
          Haptics.selectionAsync();
          router.push(`/tenants/${tenant.id}` as any);
        }}
      >
      <GlassCard padding={18} radiusToken="lg" edge="gold">
        <View style={[styles.head, isRTL && styles.rowRtl]}>
          <View style={[styles.avatar, { borderColor: colors.goldEdge }]}>
            <Text style={styles.initial}>{(view.name.trim()[0] || '—').toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, isRTL && styles.rtl]}>{view.name}</Text>
            <Text style={[styles.sub, isRTL && styles.rtl]}>
              {view.propertyName} · {ar ? 'وحدة' : 'Unit'} {view.unitNumber}
            </Text>
          </View>
          <View style={[styles.badge, complianceTone === 'ok' && styles.badgeOk, complianceTone === 'danger' && styles.badgeDanger, complianceTone === 'warn' && styles.badgeWarn]}>
            <Text style={styles.badgeText}>{view.complianceLabel}</Text>
          </View>
        </View>

        <View style={styles.hair} />

        <Row label={ar ? 'الجوال' : 'Phone'} value={phone.text} missing={phone.missing} rtl={!!isRTL} />
        <Row label={ar ? 'الوحدة' : 'Unit'} value={view.unitNumber} rtl={!!isRTL} />
        <Row label={ar ? 'العقار' : 'Property'} value={view.propertyName} rtl={!!isRTL} />
        <Row label={ar ? 'رقم العقد' : 'Contract no.'} value={contractNo.text} missing={contractNo.missing} rtl={!!isRTL} />
        <Row label={ar ? 'قيمة الإيجار' : 'Rent'} value={fmtMoney(view.rent, ar)} rtl={!!isRTL} />
        <Row label={ar ? 'الأشهر المدفوعة' : 'Paid months'} value={String(view.paidMonths)} rtl={!!isRTL} tone="ok" />
        <Row label={ar ? 'الأشهر المتأخرة' : 'Late months'} value={String(view.lateMonths)} rtl={!!isRTL} tone={view.lateMonths > 0 ? 'danger' : 'ok'} />
        <Row
          label={ar ? 'إجمالي المتأخرات' : 'Total arrears'}
          value={fmtMoney(view.arrearsTotal, ar)}
          rtl={!!isRTL}
          tone={view.arrearsTotal > 0 ? 'danger' : 'ok'}
        />
        <Row label={ar ? 'آخر دفعة' : 'Last payment'} value={lastPay} missing={lastPayMissing} rtl={!!isRTL} />
        <Row label={ar ? 'البلاغات' : 'Tickets'} value={view.ticketsLabel} missing rtl={!!isRTL} />
        <Row label={ar ? 'حالة الالتزام' : 'Compliance'} value={view.complianceLabel} rtl={!!isRTL} tone={complianceTone} />
      </GlassCard>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowRtl: { flexDirection: 'row-reverse' },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.goldSoft,
  },
  initial: { color: colors.gold, fontSize: 16, fontWeight: typography.weight.semibold },
  name: { color: colors.text, fontSize: 16, fontWeight: typography.weight.semibold },
  sub: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  badgeOk: { backgroundColor: colors.emeraldSoft, borderColor: colors.emeraldEdge },
  badgeWarn: { backgroundColor: colors.goldSoft, borderColor: colors.goldEdge },
  badgeDanger: { backgroundColor: 'rgba(233,107,107,0.12)', borderColor: 'rgba(233,107,107,0.35)' },
  badgeText: { color: colors.text, fontSize: 11, fontWeight: typography.weight.medium },
  hair: { height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginVertical: 12 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  label: { color: colors.textMuted, fontSize: 12, flex: 1 },
  value: { color: colors.text, fontSize: 13, fontWeight: typography.weight.semibold, flexShrink: 1, textAlign: 'left' },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
});
