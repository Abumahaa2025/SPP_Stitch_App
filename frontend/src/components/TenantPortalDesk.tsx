/**
 * TenantPortalDesk — limited tenant app surface inside the portal link.
 * Contact admin · messages · photo/video · payment submit (cash/platform/نقدا)
 * with owner confirmation notices. Additive GlassCard UI — no identity change.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';

import { GlassCard } from '@/src/components/GlassCard';
import { KeyboardAwareTextInput } from '@/src/components/KeyboardAwareTextInput';
import { usePortalDesk } from '@/src/hooks/usePortalDesk';
import {
  currentMonthKey,
  formatMonthLabel,
  tenantThreadId,
  type PortalBillKind,
  type PortalMediaItem,
  type PortalPayMethod,
} from '@/src/types/portal-desk';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';

type Props = {
  tenantId: string;
  tenantName: string;
  unitId?: string;
  guestMode?: boolean;
};

const METHODS: PortalPayMethod[] = ['cash', 'platform', 'cash_hand'];
const BILLS: PortalBillKind[] = ['rent', 'electricity', 'water'];

export function TenantPortalDesk({ tenantId, tenantName, unitId, guestMode }: Props) {
  const { t, isRTL, lang } = useI18n();
  const ar = lang === 'ar' || !!isRTL;
  const {
    postMessage, submitPayment, threadMessages, audienceNotices, tenantPayments,
  } = usePortalDesk();

  const threadId = tenantThreadId(tenantId);
  const messages = threadMessages(threadId);
  const notices = audienceNotices('tenant', tenantId);
  const myPays = tenantPayments(tenantId);

  const [msg, setMsg] = useState('');
  const [media, setMedia] = useState<PortalMediaItem[]>([]);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PortalPayMethod>('cash');
  const [billKind, setBillKind] = useState<PortalBillKind>('rent');
  const [monthKey, setMonthKey] = useState(currentMonthKey());
  const [payNote, setPayNote] = useState('');

  const monthOptions = useMemo(() => {
    const now = new Date();
    return [0, 1, 2].map((offset) => {
      const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      return currentMonthKey(d);
    });
  }, []);

  const pickMedia = async (kind: 'photo' | 'video') => {
    const res = await DocumentPicker.getDocumentAsync({
      type: kind === 'photo' ? ['image/*'] : ['video/*'],
      copyToCacheDirectory: true,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    setMedia((prev) => [
      ...prev,
      { uri: asset.uri, kind, name: asset.name },
    ].slice(0, 6));
    Haptics.selectionAsync();
  };

  const sendAdmin = async () => {
    if (!msg.trim() && !media.length) return;
    await postMessage({
      threadId,
      from: 'tenant',
      fromName: tenantName,
      text: msg.trim() || (ar ? 'مرفق وسائط' : 'Media attachment'),
      media: media.length ? media : undefined,
    });
    setMsg('');
    setMedia([]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const sendPayment = async () => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return;
    await submitPayment({
      tenantId,
      tenantName,
      unitId,
      amount: n,
      method,
      billKind,
      monthKey,
      note: payNote,
    });
    setAmount('');
    setPayNote('');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const methodLabel = (m: PortalPayMethod) => {
    if (m === 'cash') return ar ? 'كاش' : 'Cash';
    if (m === 'platform') return ar ? 'منصة' : 'Platform';
    return ar ? 'نقداً' : 'Cash in hand';
  };

  const billLabel = (b: PortalBillKind) => {
    if (b === 'rent') return ar ? 'إيجار' : 'Rent';
    if (b === 'electricity') return ar ? 'كهرباء' : 'Electricity';
    return ar ? 'مياه' : 'Water';
  };

  return (
    <View style={styles.wrap} testID="tenant-portal-desk">
      <GlassCard padding={14} radiusToken="md" edge="emerald" style={styles.gap}>
        <Text style={[styles.section, isRTL && styles.rtl]}>
          {t('opsv2.portalDesk.limitedTitle' as any)}
        </Text>
        <Text style={[styles.hint, isRTL && styles.rtl]}>
          {t('opsv2.portalDesk.limitedBody' as any)}
        </Text>
      </GlassCard>

      {notices.length ? (
        <GlassCard padding={14} radiusToken="md" edge="gold" style={styles.gap}>
          <Text style={[styles.section, isRTL && styles.rtl]}>
            {t('opsv2.tenant.notifications' as any)}
          </Text>
          {notices.slice(0, 8).map((n) => (
            <View key={n.id} style={{ marginTop: 8 }}>
              <Text style={[styles.body, isRTL && styles.rtl]}>{n.title}</Text>
              <Text style={[styles.hint, isRTL && styles.rtl]}>{n.body}</Text>
            </View>
          ))}
        </GlassCard>
      ) : null}

      <GlassCard padding={14} radiusToken="md" style={styles.gap}>
        <Text style={[styles.section, isRTL && styles.rtl]}>
          {t('opsv2.portalDesk.contactAdmin' as any)}
        </Text>
        <Text style={[styles.hint, isRTL && styles.rtl]}>
          {t('opsv2.portalDesk.contactHint' as any)}
        </Text>
        <KeyboardAwareTextInput
          value={msg}
          onChangeText={setMsg}
          placeholder={t('opsv2.portalDesk.messagePh' as any)}
          placeholderTextColor={colors.textSubtle}
          style={[styles.input, isRTL && styles.rtl]}
          multiline
        />
        <View style={[styles.row, isRTL && styles.rowRtl]}>
          <Pressable style={styles.chip} onPress={() => pickMedia('photo')} testID="tenant-pick-photo">
            <Feather name="camera" size={14} color={colors.gold} />
            <Text style={styles.chipText}>{t('opsv2.portalDesk.photo' as any)}</Text>
          </Pressable>
          <Pressable style={styles.chip} onPress={() => pickMedia('video')} testID="tenant-pick-video">
            <Feather name="video" size={14} color={colors.gold} />
            <Text style={styles.chipText}>{t('opsv2.portalDesk.video' as any)}</Text>
          </Pressable>
          <Pressable style={styles.primary} onPress={sendAdmin} testID="tenant-send-admin">
            <Text style={styles.primaryText}>{t('opsv2.portalDesk.send' as any)}</Text>
          </Pressable>
        </View>
        {media.length ? (
          <Text style={[styles.hint, isRTL && styles.rtl]}>
            {media.map((m) => m.name || m.kind).join(' · ')}
          </Text>
        ) : null}
        {messages.slice(0, 6).map((m) => (
          <View key={m.id} style={styles.bubble}>
            <Text style={[styles.meta, isRTL && styles.rtl]}>
              {m.fromName} · {m.from === 'owner' ? (ar ? 'المالك' : 'Owner') : (ar ? 'أنت' : 'You')}
            </Text>
            <Text style={[styles.body, isRTL && styles.rtl]}>{m.text}</Text>
            {m.media?.length ? (
              <Text style={[styles.hint, isRTL && styles.rtl]}>
                📎 {m.media.map((x) => x.kind).join(', ')}
              </Text>
            ) : null}
          </View>
        ))}
      </GlassCard>

      {!guestMode ? (
        <GlassCard padding={14} radiusToken="md" edge="gold" style={styles.gap}>
          <Text style={[styles.section, isRTL && styles.rtl]}>
            {t('opsv2.portalDesk.payTitle' as any)}
          </Text>
          <Text style={[styles.hint, isRTL && styles.rtl]}>
            {t('opsv2.portalDesk.payHint' as any)}
          </Text>

          <Text style={[styles.sub, isRTL && styles.rtl]}>{t('opsv2.portalDesk.billKind' as any)}</Text>
          <View style={[styles.row, isRTL && styles.rowRtl]}>
            {BILLS.map((b) => (
              <Pressable
                key={b}
                onPress={() => setBillKind(b)}
                style={[styles.chip, billKind === b && styles.chipOn]}
              >
                <Text style={[styles.chipText, billKind === b && styles.chipTextOn]}>{billLabel(b)}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.sub, isRTL && styles.rtl]}>{t('opsv2.portalDesk.month' as any)}</Text>
          <View style={[styles.row, isRTL && styles.rowRtl]}>
            {monthOptions.map((mk) => (
              <Pressable
                key={mk}
                onPress={() => setMonthKey(mk)}
                style={[styles.chip, monthKey === mk && styles.chipOn]}
              >
                <Text style={[styles.chipText, monthKey === mk && styles.chipTextOn]}>
                  {formatMonthLabel(mk, ar)}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.sub, isRTL && styles.rtl]}>{t('opsv2.portalDesk.payMethod' as any)}</Text>
          <View style={[styles.row, isRTL && styles.rowRtl]}>
            {METHODS.map((m) => (
              <Pressable
                key={m}
                onPress={() => setMethod(m)}
                style={[styles.chip, method === m && styles.chipOn]}
                testID={`tenant-pay-${m}`}
              >
                <Text style={[styles.chipText, method === m && styles.chipTextOn]}>{methodLabel(m)}</Text>
              </Pressable>
            ))}
          </View>

          <KeyboardAwareTextInput
            value={amount}
            onChangeText={setAmount}
            placeholder={t('opsv2.portalDesk.amountPh' as any)}
            placeholderTextColor={colors.textSubtle}
            keyboardType="decimal-pad"
            style={[styles.input, isRTL && styles.rtl]}
          />
          <KeyboardAwareTextInput
            value={payNote}
            onChangeText={setPayNote}
            placeholder={t('opsv2.portalDesk.payNotePh' as any)}
            placeholderTextColor={colors.textSubtle}
            style={[styles.input, isRTL && styles.rtl]}
          />
          <Pressable style={styles.primaryWide} onPress={sendPayment} testID="tenant-submit-payment">
            <Text style={styles.primaryText}>{t('opsv2.portalDesk.submitPay' as any)}</Text>
          </Pressable>

          {myPays.slice(0, 5).map((p) => (
            <Text key={p.id} style={[styles.hint, isRTL && styles.rtl, { marginTop: 8 }]}>
              {billLabel(p.billKind)} · {formatMonthLabel(p.monthKey, ar)} · {p.amount} · {methodLabel(p.method)}
              {' · '}
              {p.status === 'confirmed'
                ? (ar ? 'مؤكد' : 'confirmed')
                : p.status === 'rejected'
                  ? (ar ? 'مرفوض' : 'rejected')
                  : (ar ? 'بانتظار المالك' : 'awaiting owner')}
            </Text>
          ))}
        </GlassCard>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.md, gap: spacing.sm },
  gap: { marginBottom: spacing.sm },
  section: {
    color: colors.textMuted, fontSize: 11, letterSpacing: 0.8,
    textTransform: 'uppercase', fontWeight: typography.weight.semibold,
  },
  sub: { color: colors.textMuted, fontSize: 12, marginTop: 10, marginBottom: 6 },
  body: { color: colors.text, fontSize: 14, marginTop: 2 },
  hint: { color: colors.textDim, fontSize: 12.5, lineHeight: 18, marginTop: 6 },
  meta: { color: colors.emerald, fontSize: 11, marginBottom: 2 },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, alignItems: 'center' },
  rowRtl: { flexDirection: 'row-reverse' },
  input: {
    borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    padding: 10, color: colors.text, marginTop: 8, fontSize: 14,
  },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 8, paddingHorizontal: 10, borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  chipOn: { borderColor: colors.goldEdge, backgroundColor: colors.goldSoft },
  chipText: { color: colors.textMuted, fontSize: 12 },
  chipTextOn: { color: colors.gold, fontWeight: typography.weight.semibold },
  primary: {
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.md, backgroundColor: colors.emerald,
  },
  primaryWide: {
    marginTop: 10, paddingVertical: 12, borderRadius: radius.md, backgroundColor: colors.emerald, alignItems: 'center',
  },
  primaryText: { color: colors.bg, fontWeight: typography.weight.semibold, fontSize: 13 },
  bubble: {
    marginTop: 10, paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
  },
});
