/**
 * WP-4 — Monthly payment ledger row card.
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { GlassCard } from '@/src/components/GlassCard';
import type { OperationalLedgerView } from '@/src/utils/operational-payment-ledger';
import { colors, spacing, typography, radius } from '@/src/theme';

type Props = {
  view: OperationalLedgerView;
  ar: boolean;
  rtl?: boolean;
  delay?: number;
  onPress?: () => void;
  testID?: string;
};

function fmtMoney(n: number, ar: boolean) {
  return `${Number(n || 0).toLocaleString()} ${ar ? 'ر.س' : 'SAR'}`;
}

function Row({ label, value, rtl, tone, missing }: {
  label: string; value: string; rtl?: boolean; tone?: 'ok' | 'warn' | 'danger' | 'muted'; missing?: boolean;
}) {
  const color =
    tone === 'ok' ? colors.emerald : tone === 'warn' ? colors.gold : tone === 'danger' ? colors.danger
      : missing ? colors.textMuted : colors.text;
  return (
    <View style={[styles.row, rtl && styles.rowRtl]}>
      <Text style={[styles.label, rtl && styles.rtl]}>{label}</Text>
      <Text style={[styles.value, rtl && styles.rtl, { color }]}>{value}</Text>
    </View>
  );
}

export function OperationalPaymentLedgerCard({ view, ar, rtl, delay = 0, onPress, testID }: Props) {
  const payTone =
    view.paymentStatus === 'paid' ? 'ok'
      : view.paymentStatus === 'late' ? 'danger'
        : view.paymentStatus === 'partial' || view.paymentStatus === 'needs_review' ? 'warn' : 'muted';

  return (
    <Animated.View entering={FadeInDown.duration(420).delay(delay)} testID={testID}>
      <Pressable onPress={() => { Haptics.selectionAsync(); onPress?.(); }}>
        <GlassCard
          padding={16}
          radiusToken="lg"
          edge={view.paymentStatus === 'late' ? 'gold' : view.paymentStatus === 'paid' ? 'emerald' : 'neutral'}
          style={{ marginBottom: spacing.sm }}
        >
          <View style={[styles.head, rtl && styles.rowRtl]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.month, rtl && styles.rtl]}>{view.monthLabel}</Text>
              <Text style={[styles.sub, rtl && styles.rtl]}>
                {view.tenantName} · {ar ? 'وحدة' : 'Unit'} {view.unitNumber}
              </Text>
            </View>
            <View style={[styles.badge, payTone === 'ok' && styles.badgeOk, payTone === 'warn' && styles.badgeWarn, payTone === 'danger' && styles.badgeDanger]}>
              <Text style={styles.badgeText}>{view.paymentStatusLabel}</Text>
            </View>
          </View>

          <View style={styles.hair} />

          <Row label={ar ? 'المستحق' : 'Due'} value={fmtMoney(view.due, ar)} rtl={rtl} />
          <Row label={ar ? 'المدفوع' : 'Paid'} value={fmtMoney(view.paid, ar)} rtl={rtl} tone="ok" />
          <Row
            label={ar ? 'المتبقي' : 'Remaining'}
            value={fmtMoney(view.remaining, ar)}
            rtl={rtl}
            tone={view.remaining > 0 ? 'danger' : 'ok'}
          />
          <Row
            label={ar ? 'رقم العقد' : 'Contract'}
            value={view.contractNumberMissing ? 'Requires Source Support' : view.contractNumber}
            rtl={rtl}
            missing={view.contractNumberMissing}
          />
          <Row label={ar ? 'المصدر' : 'Source'} value={view.sourceLabel} rtl={rtl} />
          {view.qualityNote ? (
            <Row label={ar ? 'ملاحظة' : 'Note'} value={view.qualityNote} rtl={rtl} tone="warn" />
          ) : null}
        </GlassCard>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  rowRtl: { flexDirection: 'row-reverse' },
  month: { color: colors.text, fontSize: 15, fontWeight: typography.weight.semibold },
  sub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  badgeOk: { backgroundColor: colors.emeraldSoft, borderColor: colors.emeraldEdge },
  badgeWarn: { backgroundColor: colors.goldSoft, borderColor: colors.goldEdge },
  badgeDanger: { backgroundColor: 'rgba(233,107,107,0.12)', borderColor: 'rgba(233,107,107,0.35)' },
  badgeText: { color: colors.text, fontSize: 10, fontWeight: typography.weight.medium },
  hair: { height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginVertical: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingVertical: 5 },
  label: { color: colors.textMuted, fontSize: 12, flex: 1 },
  value: { color: colors.text, fontSize: 12, fontWeight: typography.weight.semibold, flexShrink: 1 },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
});
