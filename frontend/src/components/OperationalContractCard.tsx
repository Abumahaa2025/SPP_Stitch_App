/**
 * WP-3 — Professional operational contract card (PropertyOS only).
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { GlassCard } from '@/src/components/GlassCard';
import type { OperationalContractView } from '@/src/utils/operational-contracts';
import { colors, spacing, typography, radius } from '@/src/theme';

type Props = {
  view: OperationalContractView;
  ar: boolean;
  rtl?: boolean;
  delay?: number;
  onPress?: () => void;
  testID?: string;
};

function fmtMoney(n: number, ar: boolean) {
  const s = Number(n || 0).toLocaleString();
  return ar ? `${s} ر.س` : `${s} SAR`;
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
  rtl?: boolean;
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

export function OperationalContractCard({ view, ar, rtl, delay = 0, onPress, testID }: Props) {
  const lifeTone =
    view.lifecycleStatus === 'expired' || view.lifecycleStatus === 'needs_official_source'
      ? 'danger'
      : view.lifecycleStatus === 'expiring_soon' || view.lifecycleStatus === 'appearance_in_statements'
        ? 'warn'
        : view.lifecycleStatus === 'active'
          ? 'ok'
          : 'muted';

  const payTone =
    view.paymentStatus === 'paid' ? 'ok' : view.paymentStatus === 'late' ? 'danger' : view.paymentStatus === 'partial' ? 'warn' : 'muted';

  const dataTone =
    view.dataStatus === 'confirmed'
      ? 'ok'
      : view.dataStatus === 'needs_review'
        ? 'warn'
        : view.dataStatus === 'conflicting'
          ? 'danger'
          : 'muted';

  const edge =
    view.arrearsTotal > 0 || view.lifecycleStatus === 'expired'
      ? 'gold'
      : view.lifecycleStatus === 'active'
        ? 'emerald'
        : 'neutral';

  return (
    <Animated.View entering={FadeInDown.duration(450).delay(delay)} testID={testID}>
      <Pressable
        onPress={() => {
          Haptics.selectionAsync();
          onPress?.();
        }}
      >
        <GlassCard padding={18} radiusToken="lg" edge={edge as any} style={{ marginBottom: spacing.md }}>
          <View style={[styles.head, rtl && styles.rowRtl]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.number, rtl && styles.rtl]}>
                {view.contractNumberMissing ? 'Requires Source Support' : view.contractNumber}
              </Text>
              <Text style={[styles.sub, rtl && styles.rtl]}>
                {view.tenantName} · {ar ? 'وحدة' : 'Unit'} {view.unitNumber}
              </Text>
            </View>
            <View style={[styles.badge, lifeTone === 'ok' && styles.badgeOk, lifeTone === 'warn' && styles.badgeWarn, lifeTone === 'danger' && styles.badgeDanger]}>
              <Text style={styles.badgeText}>{view.lifecycleLabel}</Text>
            </View>
          </View>

          <View style={styles.hair} />

          <Row label={ar ? 'المستأجر' : 'Tenant'} value={view.tenantName} rtl={rtl} />
          <Row
            label={ar ? 'الجوال' : 'Phone'}
            value={view.phoneMissing ? 'Requires Source Support' : view.phone}
            missing={view.phoneMissing}
            rtl={rtl}
          />
          <Row label={ar ? 'العقار' : 'Property'} value={view.propertyName} rtl={rtl} />
          <Row label={ar ? 'الوحدة' : 'Unit'} value={view.unitNumber} rtl={rtl} />
          <Row label={ar ? 'قيمة الإيجار' : 'Rent'} value={fmtMoney(view.rent, ar)} rtl={rtl} />
          <Row
            label={
              view.legalStart
                ? ar
                  ? 'بداية (قانونية)'
                  : 'Start (legal)'
                : ar
                  ? 'بداية / فترة الكشوف'
                  : 'Start / statement period'
            }
            value={view.startDisplay}
            missing={view.startDisplay === 'Requires Source Support'}
            rtl={rtl}
          />
          <Row
            label={
              view.legalEnd
                ? ar
                  ? 'نهاية (قانونية)'
                  : 'End (legal)'
                : ar
                  ? 'نهاية / فترة الكشوف'
                  : 'End / statement period'
            }
            value={view.endDisplay}
            missing={view.endDisplay === 'Requires Source Support'}
            rtl={rtl}
          />
          <Row label={ar ? 'الأشهر المدفوعة' : 'Paid months'} value={String(view.paidMonths)} rtl={rtl} tone="ok" />
          <Row
            label={ar ? 'الأشهر المتأخرة' : 'Late months'}
            value={String(view.lateMonths)}
            rtl={rtl}
            tone={view.lateMonths > 0 ? 'danger' : 'ok'}
          />
          <Row
            label={ar ? 'إجمالي المتأخرات' : 'Total arrears'}
            value={fmtMoney(view.arrearsTotal, ar)}
            rtl={rtl}
            tone={view.arrearsTotal > 0 ? 'danger' : 'ok'}
          />
          <Row label={ar ? 'حالة السداد' : 'Payment'} value={view.paymentStatusLabel} rtl={rtl} tone={payTone} />
          <Row label={ar ? 'حالة البيانات' : 'Data status'} value={view.dataStatusLabel} rtl={rtl} tone={dataTone} />
        </GlassCard>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  rowRtl: { flexDirection: 'row-reverse' },
  number: { color: colors.text, fontSize: 16, fontWeight: typography.weight.semibold },
  sub: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    maxWidth: 160,
  },
  badgeOk: { backgroundColor: colors.emeraldSoft, borderColor: colors.emeraldEdge },
  badgeWarn: { backgroundColor: colors.goldSoft, borderColor: colors.goldEdge },
  badgeDanger: { backgroundColor: 'rgba(233,107,107,0.12)', borderColor: 'rgba(233,107,107,0.35)' },
  badgeText: { color: colors.text, fontSize: 10, fontWeight: typography.weight.medium },
  hair: { height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginVertical: 12 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  label: { color: colors.textMuted, fontSize: 12, flex: 1 },
  value: { color: colors.text, fontSize: 13, fontWeight: typography.weight.semibold, flexShrink: 1 },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
});
