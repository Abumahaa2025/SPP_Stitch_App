import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { ScreenScaffold } from '@/src/components/ScreenScaffold';
import { StoryScreenHeader } from '@/src/components/StoryScreenHeader';
import { GlassCard } from '@/src/components/GlassCard';
import { SectionTitle } from '@/src/components/SectionTitle';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';
import {
  useBilling, PLAN_PRICES, type PlanKey,
} from '@/src/hooks/useBilling';

const PLANS: { key: PlanKey; accent?: 'gold' | 'emerald' }[] = [
  { key: 'starter' },
  { key: 'executive', accent: 'gold' },
  { key: 'estate', accent: 'emerald' },
];

export default function Billing() {
  const { t, isRTL } = useI18n();
  const billing = useBilling();
  const [compareMode, setCompareMode] = useState(false);

  const planFeatures = (key: PlanKey) => {
    const n = key === 'starter' ? 3 : 4;
    return Array.from({ length: n }, (_, i) => t(`billing.plan.${key}.f${i + 1}` as 'billing.plan.starter.f1'));
  };

  const statusLabel = () => {
    if (billing.status === 'trial') return t('billing.status.trial');
    if (billing.status === 'past_due') return t('billing.status.pastDue');
    if (billing.status === 'cancelled') return t('billing.status.cancelled');
    return t('billing.active');
  };

  const statusColor = billing.status === 'active' || billing.status === 'trial'
    ? colors.emerald
    : billing.status === 'past_due' ? colors.gold : colors.danger;

  const confirmPlanChange = (target: PlanKey) => {
    if (target === billing.plan) return;
    Haptics.selectionAsync();
    const action = billing.isUpgrade(target)
      ? t('billing.upgrade.confirm')
      : t('billing.downgrade.confirm');
    Alert.alert(
      t(`billing.plan.${target}.name` as 'billing.plan.starter.name'),
      action.replace('{plan}', t(`billing.plan.${target}.name` as 'billing.plan.starter.name')),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('billing.changePlan'), onPress: () => billing.changePlan(target) },
      ],
    );
  };

  const paymentStatusColor = (s: string) =>
    s === 'paid' ? colors.emerald : s === 'pending' ? colors.gold : colors.danger;

  return (
    <ScreenScaffold testID="billing-screen">
      <StoryScreenHeader question={t('page.q.billing')} hint={t('billing.sub')} showBack testID="billing-header" />

      {/* Current subscription */}
      <Animated.View entering={FadeInDown.duration(650)}>
        <GlassCard padding={24} radiusToken="lg" edge="gold" bright>
          <Text style={styles.currentEyebrow}>{t('billing.current').toUpperCase()}</Text>
          <View style={styles.currentTitle}>
            <Text style={styles.planName}>
              {t(`billing.plan.${billing.plan}.name` as 'billing.plan.starter.name')}
            </Text>
            <View style={[styles.badge, { borderColor: `${statusColor}44`, backgroundColor: `${statusColor}18` }]}>
              <View style={[styles.badgeDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.badgeText, { color: statusColor }]}>{statusLabel().toUpperCase()}</Text>
            </View>
          </View>
          <Text style={styles.planPrice}>
            AED {billing.price}
            <Text style={styles.planPer}> · {t('billing.perMonth')}</Text>
          </Text>

          {billing.status === 'trial' && billing.trialEndsAt ? (
            <Text style={[styles.meta, isRTL && styles.rtl]}>
              {t('billing.trialEnds').replace('{date}', billing.trialEndsAt)}
            </Text>
          ) : null}

          <Text style={[styles.meta, isRTL && styles.rtl]}>
            {t('billing.renewsOn').replace('{date}', billing.renewsAt)} · {billing.paymentMethod}
          </Text>

          <View style={styles.licenseRow}>
            <Feather name="key" size={12} color={colors.gold} />
            <Text style={[styles.licenseText, isRTL && styles.rtl]}>
              {t('billing.licenses')
                .replace('{used}', String(billing.licensesUsed))
                .replace('{total}', String(billing.licensesTotal))}
            </Text>
          </View>

          <View style={styles.statusGrid}>
            <StatusPill icon="credit-card" label={t('billing.paymentStatus')} value={t(`billing.payment.${billing.status === 'past_due' ? 'failed' : 'current'}`)} ok={billing.status !== 'past_due'} />
            <StatusPill icon="refresh-cw" label={t('billing.renewal')} value={billing.renewsAt} ok={billing.status !== 'cancelled'} />
          </View>
        </GlassCard>
      </Animated.View>

      {/* Plan comparison toggle */}
      <Pressable
        testID="billing-compare-toggle"
        onPress={() => { Haptics.selectionAsync(); setCompareMode((v) => !v); }}
        style={styles.compareToggle}
      >
        <Feather name="columns" size={13} color={colors.gold} />
        <Text style={styles.compareToggleText}>
          {compareMode ? t('billing.hideCompare') : t('billing.showCompare')}
        </Text>
      </Pressable>

      <View style={{ marginTop: spacing.sm }}>
        <SectionTitle eyebrow={t('billing.plans')} count={PLANS.length} testID="billing-plans-title" />
        {PLANS.map((p, i) => {
          const isCurrent = p.key === billing.plan;
          return (
            <Animated.View key={p.key} entering={FadeInDown.duration(600).delay(80 * i)} style={{ marginTop: spacing.sm }}>
              <GlassCard padding={20} radiusToken="lg" edge={isCurrent ? 'gold' : (p.accent ?? 'neutral')}>
                <View style={styles.planTop}>
                  <Text style={styles.planNameSmall}>{t(`billing.plan.${p.key}.name` as 'billing.plan.starter.name')}</Text>
                  {isCurrent ? <Text style={styles.currentLabel}>{t('billing.yourPlan').toUpperCase()}</Text> : null}
                  <View style={{ flex: 1 }} />
                  <Text style={styles.planPriceSmall}>
                    AED {PLAN_PRICES[p.key]}<Text style={styles.planPerSmall}>/mo</Text>
                  </Text>
                </View>
                {compareMode ? (
                  <Text style={[styles.compareBlurb, isRTL && styles.rtl]}>
                    {t(`billing.plan.${p.key}.compare` as 'billing.plan.starter.compare')}
                  </Text>
                ) : (
                  <Text style={[styles.blurb, isRTL && styles.rtl]}>{t(`billing.plan.${p.key}.blurb` as 'billing.plan.starter.blurb')}</Text>
                )}
                <View style={{ marginTop: 12, gap: 6 }}>
                  {planFeatures(p.key).map((f) => (
                    <View key={f} style={styles.featureRow}>
                      <Feather name="check" size={12} color={isCurrent ? colors.gold : colors.emerald} />
                      <Text style={[styles.feature, isRTL && styles.rtl]}>{f}</Text>
                    </View>
                  ))}
                </View>
                {!isCurrent ? (
                  <Pressable
                    testID={`billing-select-${p.key}`}
                    onPress={() => confirmPlanChange(p.key)}
                    style={[styles.planBtn, billing.isUpgrade(p.key) ? styles.planBtnUp : styles.planBtnDown]}
                  >
                    <Text style={styles.planBtnText}>
                      {billing.isUpgrade(p.key) ? t('billing.upgrade') : t('billing.downgrade')}
                    </Text>
                  </Pressable>
                ) : null}
              </GlassCard>
            </Animated.View>
          );
        })}
      </View>

      {/* Invoice history */}
      <View style={{ marginTop: spacing.xl }}>
        <SectionTitle
          eyebrow={t('billing.invoices')}
          count={billing.invoices.length}
          testID="billing-invoices-title"
        />
        <GlassCard padding={0} radiusToken="lg" style={{ marginTop: spacing.sm }}>
          {billing.invoices.length === 0 ? (
            <View style={styles.emptyInv}>
              <Text style={[styles.emptyInvText, isRTL && styles.rtl]}>{t('billing.noInvoices')}</Text>
            </View>
          ) : billing.invoices.map((inv, i) => (
            <View key={inv.id}>
              <Pressable
                testID={`invoice-${inv.id}`}
                onPress={() => Haptics.selectionAsync()}
                style={styles.invRow}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.invDate}>{inv.date}</Text>
                  <Text style={[styles.invStatus, { color: paymentStatusColor(inv.status) }]}>
                    {t(`billing.invoice.${inv.status}` as 'billing.invoice.paid')}
                  </Text>
                </View>
                <Text style={styles.invAmount}>AED {inv.amount}</Text>
                <Feather name="download" size={13} color={colors.textMuted} style={{ marginLeft: 12 }} />
              </Pressable>
              {i < billing.invoices.length - 1 ? <View style={styles.invDivider} /> : null}
            </View>
          ))}
        </GlassCard>
      </View>

      {billing.status !== 'cancelled' ? (
        <Pressable
          testID="billing-cancel"
          onPress={() => {
            Alert.alert(t('billing.cancel.title'), t('billing.cancel.body'), [
              { text: t('common.cancel'), style: 'cancel' },
              { text: t('billing.cancel.confirm'), style: 'destructive', onPress: billing.cancelSubscription },
            ]);
          }}
          style={styles.cancelBtn}
        >
          <Text style={styles.cancelText}>{t('billing.cancel.link')}</Text>
        </Pressable>
      ) : null}
    </ScreenScaffold>
  );
}

function StatusPill({ icon, label, value, ok }: { icon: keyof typeof Feather.glyphMap; label: string; value: string; ok: boolean }) {
  return (
    <View style={styles.statusPill}>
      <Feather name={icon} size={11} color={ok ? colors.emerald : colors.gold} />
      <View style={{ flex: 1 }}>
        <Text style={styles.statusPillLabel}>{label}</Text>
        <Text style={styles.statusPillValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  currentEyebrow: { color: colors.gold, fontSize: 10.5, letterSpacing: 2, fontWeight: typography.weight.medium },
  currentTitle: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' },
  planName: { color: colors.text, fontSize: 26, fontWeight: typography.weight.semibold, letterSpacing: -0.6 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth },
  badgeDot: { width: 5, height: 5, borderRadius: 3 },
  badgeText: { fontSize: 9.5, letterSpacing: 1.2, fontWeight: typography.weight.medium },
  planPrice: { color: colors.text, fontSize: 22, fontWeight: typography.weight.semibold, letterSpacing: -0.5, marginTop: 8, fontVariant: ['tabular-nums'] },
  planPer: { color: colors.textMuted, fontSize: 13, letterSpacing: 0 },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: 6 },
  licenseRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  licenseText: { color: colors.textDim, fontSize: 12 },
  statusGrid: { flexDirection: 'row', gap: 10, marginTop: 16 },
  statusPill: {
    flex: 1, flexDirection: 'row', gap: 8, padding: 12, borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: 'rgba(255,255,255,0.02)',
  },
  statusPillLabel: { color: colors.textMuted, fontSize: 9.5, letterSpacing: 0.8 },
  statusPillValue: { color: colors.text, fontSize: 11.5, marginTop: 2, fontWeight: typography.weight.medium },
  compareToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.lg },
  compareToggleText: { color: colors.gold, fontSize: 12.5, fontWeight: typography.weight.medium },
  section: { color: colors.textMuted, fontSize: 10.5, letterSpacing: 2, fontWeight: typography.weight.medium },
  planTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  planNameSmall: { color: colors.text, fontSize: 15, fontWeight: typography.weight.semibold, letterSpacing: -0.2 },
  currentLabel: { color: colors.gold, fontSize: 9.5, letterSpacing: 1.4, fontWeight: typography.weight.medium },
  planPriceSmall: { color: colors.text, fontSize: 15, fontWeight: typography.weight.semibold, fontVariant: ['tabular-nums'] },
  planPerSmall: { color: colors.textMuted, fontSize: 11 },
  blurb: { color: colors.textMuted, fontSize: 12.5, marginTop: 4 },
  compareBlurb: { color: colors.textDim, fontSize: 12, marginTop: 6, lineHeight: 18 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  feature: { color: colors.textDim, fontSize: 13, flex: 1 },
  planBtn: { marginTop: 14, paddingVertical: 10, borderRadius: radius.md, alignItems: 'center' },
  planBtnUp: { backgroundColor: colors.goldSoft, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.goldEdge },
  planBtnDown: { backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  planBtnText: { color: colors.text, fontSize: 13, fontWeight: typography.weight.semibold },
  invRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  invDate: { color: colors.text, fontSize: 14, letterSpacing: -0.1 },
  invStatus: { fontSize: 11, marginTop: 2, letterSpacing: 0.4 },
  invAmount: { color: colors.text, fontSize: 14, fontWeight: typography.weight.semibold, letterSpacing: -0.1, fontVariant: ['tabular-nums'] },
  invDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginHorizontal: 20 },
  emptyInv: { padding: 24, alignItems: 'center' },
  emptyInvText: { color: colors.textMuted, fontSize: 13 },
  cancelBtn: { alignItems: 'center', marginTop: spacing.xl, marginBottom: spacing.md, paddingVertical: 12 },
  cancelText: { color: colors.textSubtle, fontSize: 12 },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
});
