/**
 * OwnerPortalDeskPanel — owner replies to portal threads + confirms tenant payments.
 * Lives on Portals management; additive only.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';

import { GlassCard } from '@/src/components/GlassCard';
import { KeyboardAwareTextInput } from '@/src/components/KeyboardAwareTextInput';
import { usePortalDesk } from '@/src/hooks/usePortalDesk';
import { usePropertyOS } from '@/src/hooks/usePropertyOS';
import { useNotificationPrefs } from '@/src/hooks/usePreferences';
import { tenantThreadId, formatMonthLabel } from '@/src/types/portal-desk';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';

export function OwnerPortalDeskPanel() {
  const { t, isRTL, lang } = useI18n();
  const ar = lang === 'ar' || !!isRTL;
  const { countEnabled } = useNotificationPrefs();
  const { state: os, reload } = usePropertyOS(countEnabled);
  const {
    pendingPayments, confirmPayment, rejectPayment,
    postMessage, messages,
  } = usePortalDesk();
  const pending = pendingPayments();
  const [reply, setReply] = useState<Record<string, string>>({});
  const [selectedTenant, setSelectedTenant] = useState(os.tenants[0]?.id || '');

  const tenants = os.tenants;
  const threadId = selectedTenant ? tenantThreadId(selectedTenant) : '';
  const thread = useMemo(
    () => (threadId ? messages.filter((m) => m.threadId === threadId).slice(0, 8) : []),
    [messages, threadId],
  );

  if (!tenants.length && !pending.length) return null;

  return (
    <View style={{ marginBottom: spacing.lg }} testID="owner-portal-desk">
      <Text style={[styles.section, isRTL && styles.rtl]}>
        {t('opsv2.portalDesk.ownerDesk' as any)}
      </Text>
      <Text style={[styles.hint, isRTL && styles.rtl, { marginBottom: spacing.sm }]}>
        {t('opsv2.portalDesk.ownerDeskHint' as any)}
      </Text>

      {pending.map((p) => (
        <GlassCard key={p.id} padding={14} radiusToken="md" edge="gold" style={styles.gap}>
          <Text style={[styles.title, isRTL && styles.rtl]}>
            {p.tenantName} · {p.amount} · {formatMonthLabel(p.monthKey, ar)}
          </Text>
          <Text style={[styles.hint, isRTL && styles.rtl]}>
            {p.billKind} · {p.method}
            {p.note ? ` · ${p.note}` : ''}
          </Text>
          <View style={[styles.row, isRTL && styles.rowRtl]}>
            <Pressable
              style={styles.approve}
              testID={`owner-confirm-pay-${p.id}`}
              onPress={async () => {
                await confirmPayment(p.id, ar);
                await reload();
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }}
            >
              <Text style={styles.approveText}>{t('opsv2.portalDesk.confirmPay' as any)}</Text>
            </Pressable>
            <Pressable style={styles.dismiss} onPress={() => rejectPayment(p.id)}>
              <Text style={styles.dismissText}>{t('op.approvals.dismiss')}</Text>
            </Pressable>
          </View>
        </GlassCard>
      ))}

      {tenants.length ? (
        <GlassCard padding={14} radiusToken="md">
          <Text style={[styles.section, isRTL && styles.rtl]}>
            {t('opsv2.portalDesk.ownerMessages' as any)}
          </Text>
          <View style={[styles.row, isRTL && styles.rowRtl]}>
            {tenants.slice(0, 6).map((tn) => (
              <Pressable
                key={tn.id}
                onPress={() => setSelectedTenant(tn.id)}
                style={[styles.chip, selectedTenant === tn.id && styles.chipOn]}
              >
                <Text style={[styles.chipText, selectedTenant === tn.id && styles.chipTextOn]}>
                  {tn.name}
                </Text>
              </Pressable>
            ))}
          </View>
          {thread.map((m) => (
            <Text key={m.id} style={[styles.hint, isRTL && styles.rtl, { marginTop: 8 }]}>
              {m.fromName}: {m.text}
            </Text>
          ))}
          {selectedTenant ? (
            <>
              <KeyboardAwareTextInput
                value={reply[selectedTenant] || ''}
                onChangeText={(v) => setReply((prev) => ({ ...prev, [selectedTenant]: v }))}
                placeholder={t('opsv2.portalDesk.ownerReplyPh' as any)}
                placeholderTextColor={colors.textSubtle}
                style={[styles.input, isRTL && styles.rtl]}
              />
              <Pressable
                style={styles.approve}
                onPress={async () => {
                  const text = (reply[selectedTenant] || '').trim();
                  if (!text) return;
                  const tn = tenants.find((x) => x.id === selectedTenant);
                  await postMessage({
                    threadId: tenantThreadId(selectedTenant),
                    from: 'owner',
                    fromName: ar ? 'المالك' : 'Owner',
                    text,
                  });
                  setReply((prev) => ({ ...prev, [selectedTenant]: '' }));
                  void tn;
                  Haptics.selectionAsync();
                }}
              >
                <Text style={styles.approveText}>{t('opsv2.portalDesk.send' as any)}</Text>
              </Pressable>
            </>
          ) : null}
        </GlassCard>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    color: colors.textMuted, fontSize: 10.5, letterSpacing: 2,
    textTransform: 'uppercase', marginTop: spacing.lg, marginBottom: spacing.sm,
  },
  title: { color: colors.text, fontWeight: typography.weight.semibold, fontSize: 14 },
  hint: { color: colors.textDim, fontSize: 12, lineHeight: 18 },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  gap: { marginBottom: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  rowRtl: { flexDirection: 'row-reverse' },
  approve: {
    paddingVertical: 10, paddingHorizontal: 14, borderRadius: radius.md,
    backgroundColor: colors.emeraldSoft, borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.emeraldEdge,
  },
  approveText: { color: colors.emerald, fontWeight: typography.weight.semibold, fontSize: 12 },
  dismiss: {
    paddingVertical: 10, paddingHorizontal: 14, borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  dismissText: { color: colors.textMuted, fontSize: 12 },
  chip: {
    paddingVertical: 6, paddingHorizontal: 10, borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  chipOn: { borderColor: colors.goldEdge, backgroundColor: colors.goldSoft },
  chipText: { color: colors.textMuted, fontSize: 12 },
  chipTextOn: { color: colors.gold, fontWeight: typography.weight.semibold },
  input: {
    borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    padding: 10, color: colors.text, marginTop: 8, fontSize: 14,
  },
});
