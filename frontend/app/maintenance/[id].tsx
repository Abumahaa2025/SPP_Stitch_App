import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { ScreenScaffold } from '@/src/components/ScreenScaffold';
import { StoryScreenHeader } from '@/src/components/StoryScreenHeader';
import { GlassCard } from '@/src/components/GlassCard';
import { MaintenanceTimeline } from '@/src/components/maintenance/MaintenanceTimeline';
import { KeyboardAwareTextInput } from '@/src/components/KeyboardAwareTextInput';
import { useOperational } from '@/src/hooks/useOperational';
import { usePropertyOS } from '@/src/hooks/usePropertyOS';
import { useNotificationPrefs } from '@/src/hooks/usePreferences';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';

export default function MaintenanceDetailScreen() {
  const { t, isRTL, lang } = useI18n();
  const ar = lang === 'ar' || !!isRTL;
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { countEnabled } = useNotificationPrefs();
  const { state } = usePropertyOS(countEnabled);
  const { tickets, proposeCost, decideCost } = useOperational();
  const [costDraft, setCostDraft] = useState('');
  const [costNote, setCostNote] = useState('');

  const ticket = tickets.find((tk) => tk.id === id);
  const unit = ticket ? state.units.find((u) => u.id === ticket.unitId) : undefined;

  if (!ticket) {
    return (
      <ScreenScaffold>
        <StoryScreenHeader question={t('maint.detail' as any)} showBack />
        <Text style={styles.dim}>{t('alive.maintenance.body')}</Text>
      </ScreenScaffold>
    );
  }

  const costStatus = ticket.costStatus ?? 'none';
  const currency = ticket.costCurrency || (ar ? 'ر.س' : 'SAR');

  const submitCost = async () => {
    const amount = Number(String(costDraft).replace(/,/g, ''));
    if (!Number.isFinite(amount) || amount <= 0) return;
    await proposeCost(ticket.id, amount, costNote.trim() || undefined);
    setCostDraft('');
    setCostNote('');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  return (
    <ScreenScaffold testID="maintenance-detail">
      <StoryScreenHeader question={ticket.title} hint={unit?.number} showBack />

      <MaintenanceTimeline ticket={ticket} />

      {/* Stitch: تقييم التكلفة المالية */}
      <GlassCard padding={16} radiusToken="md" style={styles.gap} edge="gold">
        <Text style={[styles.section, isRTL && styles.rtl]}>{t('maint.cost.title' as any)}</Text>
        <Text style={[styles.dim, isRTL && styles.rtl, { marginTop: 6 }]}>
          {t('maint.cost.hint' as any)}
        </Text>

        {ticket.estimatedCost != null ? (
          <View style={{ marginTop: 12, gap: 8 }}>
            <Text style={[styles.costAmount, isRTL && styles.rtl]}>
              {Number(ticket.estimatedCost).toLocaleString()} {currency}
            </Text>
            {ticket.costNote ? (
              <Text style={[styles.body, isRTL && styles.rtl]}>{ticket.costNote}</Text>
            ) : null}
            <Text style={[styles.dim, isRTL && styles.rtl]}>
              {t(`maint.cost.status.${costStatus}` as any)}
            </Text>
            {costStatus === 'proposed' ? (
              <View style={[styles.row, isRTL && styles.rowRtl]}>
                <Pressable
                  testID="maint-cost-approve"
                  style={[styles.btn, styles.btnOk]}
                  onPress={async () => {
                    await decideCost(ticket.id, 'approved');
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  }}
                >
                  <Text style={styles.btnTextOk}>{t('maint.cost.approve' as any)}</Text>
                </Pressable>
                <Pressable
                  testID="maint-cost-reject"
                  style={[styles.btn, styles.btnDanger]}
                  onPress={async () => {
                    await decideCost(ticket.id, 'rejected');
                    Haptics.selectionAsync();
                  }}
                >
                  <Text style={styles.btnTextDanger}>{t('maint.cost.reject' as any)}</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : (
          <View style={{ marginTop: 12, gap: 10 }}>
            <KeyboardAwareTextInput
              testID="maint-cost-amount"
              value={costDraft}
              onChangeText={setCostDraft}
              keyboardType="numeric"
              placeholder={t('maint.cost.amount' as any)}
              placeholderTextColor={colors.textSubtle}
              style={[styles.input, isRTL && styles.rtl]}
            />
            <KeyboardAwareTextInput
              testID="maint-cost-note"
              value={costNote}
              onChangeText={setCostNote}
              placeholder={t('maint.cost.note' as any)}
              placeholderTextColor={colors.textSubtle}
              style={[styles.input, isRTL && styles.rtl]}
            />
            <Pressable testID="maint-cost-propose" style={styles.btnPrimary} onPress={submitCost}>
              <Text style={styles.btnPrimaryText}>{t('maint.cost.propose' as any)}</Text>
            </Pressable>
          </View>
        )}
      </GlassCard>

      {(ticket.beforeMedia?.length || ticket.afterMedia?.length) ? (
        <GlassCard padding={16} radiusToken="md" style={styles.gap}>
          <Text style={[styles.section, isRTL && styles.rtl]}>{t('maint.compare' as any)}</Text>
          <Text style={styles.dim}>
            {t('maint.before' as any)}: {ticket.beforeMedia?.length ?? 0} · {t('maint.after' as any)}: {ticket.afterMedia?.length ?? 0}
          </Text>
        </GlassCard>
      ) : null}

      {ticket.rating ? (
        <GlassCard padding={16} radiusToken="md" style={styles.gap}>
          <Text style={styles.dim}>{'⭐'.repeat(ticket.rating)}</Text>
          {ticket.tenantComment ? <Text style={styles.body}>{ticket.tenantComment}</Text> : null}
        </GlassCard>
      ) : null}

      {unit ? (
        <Pressable
          style={styles.archiveBtn}
          onPress={() => router.push(`/maintenance/archive?unitId=${unit.id}` as any)}
        >
          <Text style={styles.archiveText}>{t('maint.archive' as any)} →</Text>
        </Pressable>
      ) : null}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  dim: { color: colors.textDim, marginTop: spacing.lg },
  gap: { marginTop: spacing.md },
  section: { color: colors.textMuted, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase' },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  body: { color: colors.text, marginTop: 6 },
  costAmount: { color: colors.gold, fontSize: 22, fontWeight: typography.weight.semibold },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  row: { flexDirection: 'row', gap: 10, marginTop: 8 },
  rowRtl: { flexDirection: 'row-reverse' },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  btnOk: { backgroundColor: colors.emeraldSoft, borderColor: colors.emeraldEdge },
  btnDanger: { backgroundColor: 'rgba(233,107,107,0.12)', borderColor: 'rgba(233,107,107,0.35)' },
  btnTextOk: { color: colors.emerald, fontWeight: typography.weight.semibold },
  btnTextDanger: { color: colors.danger, fontWeight: typography.weight.semibold },
  btnPrimary: {
    backgroundColor: colors.emerald,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnPrimaryText: { color: colors.bg, fontWeight: typography.weight.semibold },
  archiveBtn: { marginTop: spacing.lg, padding: 12 },
  archiveText: { color: colors.gold, fontWeight: typography.weight.semibold },
});
