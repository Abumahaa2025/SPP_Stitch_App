import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { ScreenScaffold } from '@/src/components/ScreenScaffold';
import { StoryScreenHeader } from '@/src/components/StoryScreenHeader';
import { GlassCard } from '@/src/components/GlassCard';
import { AliveEmpty } from '@/src/components/AliveEmpty';
import { ActingAsBadge } from '@/src/components/ActingAsBadge';
import { MaintenanceJourney } from '@/src/components/maintenance/MaintenanceJourney';
import { MaintenanceTimeline } from '@/src/components/maintenance/MaintenanceTimeline';
import { KeyboardAwareTextInput } from '@/src/components/KeyboardAwareTextInput';
import { usePropertyOS } from '@/src/hooks/usePropertyOS';
import { useOperational } from '@/src/hooks/useOperational';
import { useTechnicians } from '@/src/hooks/useTechnicians';
import { usePortalAccess } from '@/src/hooks/usePortalAccess';
import { useNotificationPrefs } from '@/src/hooks/usePreferences';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';
import { formatDate } from '@/src/utils/locale';

export default function TenantPortalScreen() {
  const { t, isRTL } = useI18n();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; t?: string }>();
  const { countEnabled } = useNotificationPrefs();
  const { state } = usePropertyOS(countEnabled);
  const { tickets, openTicket, tenantApprove, tenantReprocess } = useOperational();
  const { technicians, create } = useTechnicians();
  const { logLogin } = usePortalAccess();
  const [showJourney, setShowJourney] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  const tenant = state.tenants.find((x) => x.id === params.id && x.portalToken === params.t);
  const unit = tenant ? state.units.find((u) => u.id === tenant.unitId) : undefined;
  const contract = tenant ? state.contracts.find((c) => c.tenantId === tenant.id) : undefined;
  const payments = state.payments?.filter((p) => p.tenantId === tenant?.id) ?? [];
  const myTickets = tenant
    ? tickets.filter((tk) => tk.tenantId === tenant.id || tk.unitId === tenant.unitId)
    : [];
  const awaitingTicket = myTickets.find((tk) => tk.status === 'awaiting_tenant');

  useEffect(() => {
    if (tenant) void logLogin(tenant.id, 'tenant', tenant.name);
  }, [tenant?.id]);

  if (!tenant) {
    return (
      <ScreenScaffold testID="tenant-portal">
        <StoryScreenHeader question={t('op.tenant.title')} hint={t('op.tenant.invalid')} showBack />
        <AliveEmpty title={t('op.tenant.title')} body={t('op.tenant.invalid')} />
      </ScreenScaffold>
    );
  }

  const paymentOk = payments.length > 0;

  return (
    <ScreenScaffold testID="tenant-portal">
      <StoryScreenHeader
        question={`${t('opsv2.tenant.welcome' as any)}، ${tenant.name}`}
        hint={t('op.tenant.sub')}
        showBack
      />

      <ActingAsBadge
        role="tenant"
        displayName={tenant.name}
        scope={`${t('op.tenant.unit')} ${unit?.number ?? '—'} · ${state.property?.name ?? ''}`}
      />

      <GlassCard padding={18} radiusToken="md" edge="gold">
        <Text style={[styles.section, isRTL && styles.rtl]}>{t('op.tenant.unit')}</Text>
        <Text style={[styles.body, isRTL && styles.rtl]}>
          {unit?.number ?? '—'} · {state.property?.name ?? ''}
        </Text>
      </GlassCard>

      {contract ? (
        <GlassCard padding={18} radiusToken="md" style={styles.gap}>
          <Text style={[styles.section, isRTL && styles.rtl]}>{t('op.tenant.contract')}</Text>
          <Text style={[styles.body, isRTL && styles.rtl]}>#{contract.number}</Text>
          <Text style={[styles.dim, isRTL && styles.rtl]}>
            {formatDate(contract.startDate)} — {formatDate(contract.endDate)}
          </Text>
        </GlassCard>
      ) : null}

      <GlassCard padding={18} radiusToken="md" edge="emerald" style={styles.gap}>
        <Text style={[styles.section, isRTL && styles.rtl]}>{t('opsv2.tenant.payments' as any)}</Text>
        <Text style={[styles.body, isRTL && styles.rtl]}>
          {paymentOk ? t('opsv2.tenant.paid' as any) : t('opsv2.tenant.due' as any)}
        </Text>
      </GlassCard>

      {myTickets[0]?.tenantNotifications?.length ? (
        <GlassCard padding={16} radiusToken="md" style={styles.gap}>
          <Text style={[styles.section, isRTL && styles.rtl]}>{t('opsv2.tenant.notifications' as any)}</Text>
          {myTickets[0].tenantNotifications!.slice(0, 5).map((n, i) => (
            <Text key={i} style={[styles.dim, isRTL && styles.rtl]}>
              · {t(n.messageKey as any)}
            </Text>
          ))}
        </GlassCard>
      ) : null}

      {awaitingTicket ? (
        <GlassCard padding={16} radiusToken="md" edge="gold" style={styles.gap}>
          <Text style={[styles.section, isRTL && styles.rtl]}>{t('maint.rating' as any)}</Text>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => setRating(n)}>
                <Text style={styles.star}>{n <= rating ? '⭐' : '☆'}</Text>
              </Pressable>
            ))}
          </View>
          <KeyboardAwareTextInput
            value={comment}
            onChangeText={setComment}
            placeholder={t('maint.comment' as any)}
            placeholderTextColor={colors.textSubtle}
            style={[styles.input, isRTL && styles.rtl]}
            multiline
          />
          <View style={styles.row}>
            <Pressable
              style={styles.approveBtn}
              onPress={async () => {
                await tenantApprove(awaitingTicket.id, rating, comment.trim());
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }}
            >
              <Text style={styles.approveText}>{t('maint.approve' as any)}</Text>
            </Pressable>
            <Pressable
              style={styles.reprocessBtn}
              onPress={() => tenantReprocess(awaitingTicket.id, comment.trim())}
            >
              <Text style={styles.reprocessText}>{t('maint.reprocessBtn' as any)}</Text>
            </Pressable>
          </View>
        </GlassCard>
      ) : null}

      {!showJourney ? (
        <Pressable style={styles.requestBtn} onPress={() => setShowJourney(true)}>
          <Text style={styles.requestBtnText}>{t('op.tenant.requestMaintenance')}</Text>
        </Pressable>
      ) : (
        <View style={styles.gap}>
          <MaintenanceJourney
            unitId={tenant.unitId}
            unitLabel={`${t('op.tenant.unit')} ${unit?.number ?? ''}`}
            tenantId={tenant.id}
            technicianList={technicians}
            onCreateTechnician={create}
            onSubmit={async (data) => {
              await openTicket(tenant.unitId, data.title, tenant.id, data.description, unit?.number, {
                category: data.category,
                priority: data.priority,
                technicianId: data.technicianId,
                technicianName: data.technicianName,
                media: data.media,
              });
              setShowJourney(false);
            }}
            onCancel={() => setShowJourney(false)}
          />
        </View>
      )}

      {myTickets.length ? (
        <View style={styles.gap}>
          <Text style={[styles.section, isRTL && styles.rtl]}>{t('opsv2.tenant.track' as any)}</Text>
          {myTickets.map((tk) => (
            <GlassCard key={tk.id} padding={14} radiusToken="md" style={{ marginBottom: spacing.sm }}>
              <Text style={[styles.body, isRTL && styles.rtl]}>{tk.title}</Text>
              <MaintenanceTimeline ticket={tk} showEta={false} />
            </GlassCard>
          ))}
        </View>
      ) : null}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  gap: { marginTop: spacing.md },
  section: {
    color: colors.textMuted, fontSize: 11, letterSpacing: 0.8,
    textTransform: 'uppercase', fontWeight: typography.weight.semibold,
  },
  body: { color: colors.text, fontSize: typography.body, marginTop: 6 },
  dim: { color: colors.textDim, fontSize: typography.small, marginTop: 4 },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  requestBtn: {
    marginTop: spacing.md, padding: 14, borderRadius: radius.md,
    backgroundColor: colors.emerald, alignItems: 'center',
  },
  requestBtnText: { color: colors.bg, fontWeight: typography.weight.semibold },
  stars: { flexDirection: 'row', gap: 8, marginVertical: 8 },
  star: { fontSize: 24 },
  input: {
    borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    padding: 10, color: colors.text, minHeight: 60, textAlignVertical: 'top',
  },
  row: { flexDirection: 'row', gap: 8, marginTop: 10 },
  approveBtn: { flex: 1, padding: 12, borderRadius: radius.md, backgroundColor: colors.emerald, alignItems: 'center' },
  approveText: { color: colors.bg, fontWeight: typography.weight.semibold },
  reprocessBtn: {
    flex: 1, padding: 12, borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.goldEdge, alignItems: 'center',
  },
  reprocessText: { color: colors.gold, fontWeight: typography.weight.semibold },
});
