import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Linking, Platform } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';

import { ScreenScaffold } from '@/src/components/ScreenScaffold';
import { StoryScreenHeader } from '@/src/components/StoryScreenHeader';
import { GlassCard } from '@/src/components/GlassCard';
import { AliveEmpty } from '@/src/components/AliveEmpty';
import { ActingAsBadge } from '@/src/components/ActingAsBadge';
import { PortalInstallHint } from '@/src/components/PortalInstallHint';
import { TenantPortalDesk } from '@/src/components/TenantPortalDesk';
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

function digitsPhone(raw?: string) {
  return String(raw || '').replace(/\D/g, '');
}

function openWhatsApp(phone: string, message: string) {
  const p = digitsPhone(phone);
  const url = Platform.select({
    ios: p
      ? `whatsapp://send?phone=${p}&text=${encodeURIComponent(message)}`
      : `whatsapp://send?text=${encodeURIComponent(message)}`,
    default: p
      ? `https://wa.me/${p}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`,
  });
  return Linking.openURL(url!).catch(() => Linking.openURL(`https://wa.me/${p}?text=${encodeURIComponent(message)}`));
}

export default function TenantPortalScreen() {
  const { t, isRTL } = useI18n();
  const params = useLocalSearchParams<{
    id?: string;
    t?: string;
    n?: string;
    u?: string;
    prop?: string;
    name?: string;
    unit?: string;
    tn?: string;
    tp?: string;
  }>();
  const { countEnabled } = useNotificationPrefs();
  const { state } = usePropertyOS(countEnabled);
  const { tickets, openTicket, tenantApprove, tenantReprocess } = useOperational();
  const { technicians, create } = useTechnicians();
  const { logLogin } = usePortalAccess();
  const [showJourney, setShowJourney] = useState(false);
  const [guestMaint, setGuestMaint] = useState('');
  const [guestType, setGuestType] = useState('سباكة');
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  const localTenant = state.tenants.find((x) => x.id === params.id && x.portalToken === params.t);
  const guestName = String(params.n || params.name || '').trim();
  const guestUnit = String(params.u || params.unit || '').trim();
  const guestProp = String(params.prop || '').trim();
  const guestTechName = String(params.tn || '').trim();
  const guestTechPhone = digitsPhone(params.tp);
  const guestMode = !localTenant && Boolean(params.id && params.t && (guestName || params.t));
  const tenant = localTenant || (guestMode
    ? {
        id: String(params.id),
        unitId: '',
        name: guestName || (isRTL ? 'مستأجر' : 'Tenant'),
        phone: '',
        email: '',
        portalToken: String(params.t),
        portalUrl: '',
        qrData: '',
        whatsAppMessage: '',
      }
    : undefined);
  const unit = localTenant ? state.units.find((u) => u.id === localTenant.unitId) : undefined;
  const unitLabel = unit?.number || guestUnit || '—';
  const propertyLabel = state.property?.name || guestProp || '—';
  const contract = localTenant ? state.contracts.find((c) => c.tenantId === localTenant.id) : undefined;
  const payments = state.payments?.filter((p) => p.tenantId === localTenant?.id) ?? [];
  const ledgerDue = (state.paymentLedger || [])
    .filter((l) => l.tenantId === localTenant?.id)
    .reduce((s, l) => s + (Number(l.remaining) || 0), 0);
  const myTickets = localTenant
    ? tickets.filter((tk) => tk.tenantId === localTenant.id || tk.unitId === localTenant.unitId)
    : [];
  const awaitingTicket = myTickets.find((tk) => tk.status === 'awaiting_tenant');

  const assignedTech = useMemo(() => {
    const fromTicket = myTickets.find((tk) => tk.technicianId || tk.technicianName);
    if (fromTicket?.technicianId) {
      const found = technicians.find((x) => x.id === fromTicket.technicianId);
      if (found) return found;
    }
    if (guestTechPhone) {
      return {
        id: 'guest-tech',
        name: guestTechName || (isRTL ? 'فني الصيانة' : 'Technician'),
        phone: guestTechPhone,
      };
    }
    if (technicians[0]) return technicians[0];
    if (fromTicket?.technicianName) {
      return { id: 'named', name: fromTicket.technicianName, phone: '' };
    }
    return null;
  }, [myTickets, technicians, guestTechPhone, guestTechName, isRTL]);

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

  const paymentOk = payments.length > 0 && ledgerDue <= 0;
  const ar = !!isRTL;

  const contactTechWa = () => {
    Haptics.selectionAsync();
    const phone = assignedTech?.phone || guestTechPhone;
    const msg = ar
      ? `مرحباً${assignedTech?.name ? ` ${assignedTech.name}` : ''}، أنا المستأجر ${tenant.name} — وحدة ${unitLabel}${propertyLabel !== '—' ? ` / ${propertyLabel}` : ''}. أحتاج تواصلك بخصوص الوحدة.`
      : `Hello${assignedTech?.name ? ` ${assignedTech.name}` : ''}, tenant ${tenant.name} — unit ${unitLabel}. I need help with the unit.`;
    void openWhatsApp(phone, msg);
  };

  const callTech = () => {
    const phone = digitsPhone(assignedTech?.phone || guestTechPhone);
    if (!phone) return;
    Haptics.selectionAsync();
    void Linking.openURL(`tel:+${phone}`);
  };

  const sendGuestMaintenance = () => {
    Haptics.selectionAsync();
    const desc = guestMaint.trim() || (ar ? 'بلاغ صيانة' : 'Maintenance request');
    const msg = ar
      ? `🛠 طلب صيانة من بوابة المستأجر\nالمستأجر: ${tenant.name}\nالوحدة: ${unitLabel}\nالعقار: ${propertyLabel}\nالنوع: ${guestType}\nالوصف: ${desc}`
      : `🛠 Maintenance request\nTenant: ${tenant.name}\nUnit: ${unitLabel}\nProperty: ${propertyLabel}\nType: ${guestType}\nDetails: ${desc}`;
    void openWhatsApp(assignedTech?.phone || guestTechPhone, msg);
  };

  return (
    <ScreenScaffold testID="tenant-portal">

        <StoryScreenHeader
          question={`${t('opsv2.tenant.welcome' as any)}، ${tenant.name}`}
          hint={guestMode
            ? (ar ? 'تم فتح رابط البوابة بنجاح — يمكنك المتابعة من هنا' : 'Portal link opened — continue below')
            : t('op.tenant.sub')}
          showBack
        />

        <ActingAsBadge
          role="tenant"
          displayName={tenant.name}
          scope={`${t('op.tenant.unit')} ${unitLabel} · ${propertyLabel}`}
        />

        <GlassCard padding={18} radiusToken="md" edge="gold">
          <Text style={[styles.section, ar && styles.rtl]}>{ar ? 'وحدتك' : 'Your unit'}</Text>
          <Text style={[styles.body, ar && styles.rtl]}>
            {unitLabel} · {propertyLabel}
      <StoryScreenHeader
        question={`${t('opsv2.tenant.welcome' as any)}، ${tenant.name}`}
        hint={guestMode
          ? (isRTL ? 'تم فتح رابط البوابة بنجاح' : 'Portal link opened successfully')
          : t('op.tenant.sub')}
        showBack
      />

      <ActingAsBadge
        role="tenant"
        displayName={tenant.name}
        scope={`${t('op.tenant.unit')} ${unitLabel} · ${propertyLabel}`}
      />
      <PortalInstallHint role="tenant" />

      <GlassCard padding={18} radiusToken="md" edge="gold">
        <Text style={[styles.section, isRTL && styles.rtl]}>{t('op.tenant.unit')}</Text>
        <Text style={[styles.body, isRTL && styles.rtl]}>
          {unitLabel} · {propertyLabel}
        </Text>
      </GlassCard>

      {guestMode ? (
        <GlassCard padding={18} radiusToken="md" edge="emerald" style={styles.gap}>
          <Text style={[styles.section, isRTL && styles.rtl]}>
            {isRTL ? 'الرابط يعمل' : 'Link is active'}

          </Text>
          <Text style={[styles.dim, ar && styles.rtl]}>
            {ar ? 'الحالة: رابط البوابة نشط' : 'Status: portal link active'}
          </Text>
        </GlassCard>

        <GlassCard padding={16} radiusToken="md" edge="emerald" style={styles.gap}>
          <Text style={[styles.section, ar && styles.rtl]}>{ar ? 'مزايا بوابتك' : 'Your portal'}</Text>
          {[
            ar ? 'عرض الوحدة والعقار' : 'View unit & property',
            ar ? 'متابعة العقد والمدفوعات' : 'Contract & payments',
            ar ? 'طلب صيانة ومتابعة البلاغ' : 'Request & track maintenance',
            ar ? 'تواصل مباشر مع الفني' : 'Direct technician contact',
          ].map((line) => (
            <Text key={line} style={[styles.feature, ar && styles.rtl]}>· {line}</Text>
          ))}
        </GlassCard>


        {contract ? (
          <GlassCard padding={18} radiusToken="md" style={styles.gap}>
            <Text style={[styles.section, ar && styles.rtl]}>{t('op.tenant.contract')}</Text>
            <Text style={[styles.body, ar && styles.rtl]}>#{contract.number}</Text>
            <Text style={[styles.dim, ar && styles.rtl]}>
              {formatDate(contract.startDate)} — {formatDate(contract.endDate)}

      ) : null}

      <GlassCard padding={18} radiusToken="md" edge="emerald" style={styles.gap}>
        <Text style={[styles.section, isRTL && styles.rtl]}>{t('opsv2.tenant.payments' as any)}</Text>
        <Text style={[styles.body, isRTL && styles.rtl]}>
          {paymentOk ? t('opsv2.tenant.paid' as any) : t('opsv2.tenant.due' as any)}
        </Text>
      </GlassCard>

      <TenantPortalDesk
        tenantId={tenant.id}
        tenantName={tenant.name}
        unitId={localTenant?.unitId || unit?.id}
        guestMode={guestMode}
      />

      {myTickets[0]?.tenantNotifications?.length ? (
        <GlassCard padding={16} radiusToken="md" style={styles.gap}>
          <Text style={[styles.section, isRTL && styles.rtl]}>{t('opsv2.tenant.notifications' as any)}</Text>
          {myTickets[0].tenantNotifications!.slice(0, 5).map((n, i) => (
            <Text key={i} style={[styles.dim, isRTL && styles.rtl]}>
              · {t(n.messageKey as any)}

            </Text>
            {contract.rentAmount ? (
              <Text style={[styles.body, ar && styles.rtl]}>
                {ar ? 'الإيجار: ' : 'Rent: '}
                {Number(contract.rentAmount).toLocaleString()}
              </Text>
            ) : null}
          </GlassCard>
        ) : null}

        <GlassCard padding={18} radiusToken="md" edge="emerald" style={styles.gap}>
          <Text style={[styles.section, ar && styles.rtl]}>{t('opsv2.tenant.payments' as any)}</Text>
          <Text style={[styles.body, ar && styles.rtl]}>
            {guestMode
              ? (ar ? 'التفاصيل تظهر عند مزامنة بيانات العقار على هذا الجهاز' : 'Details appear when property data is synced on this device')
              : paymentOk
                ? t('opsv2.tenant.paid' as any)
                : ledgerDue > 0
                  ? `${t('opsv2.tenant.due' as any)} · ${ledgerDue.toLocaleString()}`
                  : t('opsv2.tenant.due' as any)}
          </Text>
        </GlassCard>

        <GlassCard padding={16} radiusToken="md" edge="gold" style={styles.gap}>
          <Text style={[styles.section, ar && styles.rtl]}>{ar ? 'تواصل مع الفني مباشرة' : 'Contact technician'}</Text>
          <Text style={[styles.body, ar && styles.rtl]}>
            {assignedTech?.name || (ar ? 'فني الصيانة' : 'Technician')}
            {assignedTech?.phone ? ` · ${assignedTech.phone}` : ''}
          </Text>
          {!assignedTech?.phone && !guestTechPhone ? (
            <Text style={[styles.dim, ar && styles.rtl]}>
              {ar ? 'لا يوجد رقم فني بعد — سيظهر عند ربطه من الإدارة' : 'No technician phone yet — it appears once linked by management'}
            </Text>
          ) : (
            <View style={styles.row}>
              <Pressable style={styles.approveBtn} onPress={contactTechWa}>
                <Feather name="message-circle" size={16} color={colors.bg} />
                <Text style={styles.approveText}>{ar ? 'واتساب' : 'WhatsApp'}</Text>
              </Pressable>
              <Pressable style={styles.reprocessBtn} onPress={callTech}>
                <Feather name="phone" size={16} color={colors.gold} />
                <Text style={styles.reprocessText}>{ar ? 'اتصال' : 'Call'}</Text>
              </Pressable>
            </View>
          )}
        </GlassCard>

        {myTickets[0]?.tenantNotifications?.length ? (
          <GlassCard padding={16} radiusToken="md" style={styles.gap}>
            <Text style={[styles.section, ar && styles.rtl]}>{t('opsv2.tenant.notifications' as any)}</Text>
            {myTickets[0].tenantNotifications!.slice(0, 5).map((n, i) => (
              <Text key={i} style={[styles.dim, ar && styles.rtl]}>
                · {t(n.messageKey as any)}
              </Text>
            ))}
          </GlassCard>
        ) : null}

        {awaitingTicket ? (
          <GlassCard padding={16} radiusToken="md" edge="gold" style={styles.gap}>
            <Text style={[styles.section, ar && styles.rtl]}>{t('maint.rating' as any)}</Text>
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
              style={[styles.input, ar && styles.rtl]}
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

        {!guestMode && !showJourney ? (
          <Pressable style={styles.requestBtn} onPress={() => setShowJourney(true)}>
            <Text style={styles.requestBtnText}>{t('op.tenant.requestMaintenance')}</Text>
          </Pressable>
        ) : null}

        {!guestMode && showJourney ? (
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
        ) : null}

        {guestMode ? (
          <GlassCard padding={16} radiusToken="md" style={styles.gap}>
            <Text style={[styles.section, ar && styles.rtl]}>{ar ? 'طلب صيانة' : 'Maintenance request'}</Text>
            <View style={styles.typeRow}>
              {(ar ? ['سباكة', 'كهرباء', 'تكييف', 'أخرى'] : ['Plumbing', 'Electrical', 'AC', 'Other']).map((label) => (
                <Pressable
                  key={label}
                  onPress={() => setGuestType(label)}
                  style={[styles.typeChip, guestType === label && styles.typeChipOn]}
                >
                  <Text style={[styles.typeChipText, guestType === label && styles.typeChipTextOn]}>{label}</Text>
                </Pressable>
              ))}
            </View>
            <KeyboardAwareTextInput
              value={guestMaint}
              onChangeText={setGuestMaint}
              placeholder={ar ? 'وصف المشكلة…' : 'Describe the issue…'}
              placeholderTextColor={colors.textSubtle}
              style={[styles.input, ar && styles.rtl]}
              multiline
            />
            <Pressable style={styles.requestBtn} onPress={sendGuestMaintenance}>
              <Text style={styles.requestBtnText}>{ar ? 'إرسال للفني عبر واتساب' : 'Send to technician via WhatsApp'}</Text>
            </Pressable>
          </GlassCard>
        ) : null}

        {myTickets.length ? (
          <View style={styles.gap}>
            <Text style={[styles.section, ar && styles.rtl]}>{t('opsv2.tenant.track' as any)}</Text>
            {myTickets.map((tk) => (
              <GlassCard key={tk.id} padding={14} radiusToken="md" style={{ marginBottom: spacing.sm }}>
                <Text style={[styles.body, ar && styles.rtl]}>{tk.title}</Text>
                {tk.technicianName ? (
                  <Text style={[styles.dim, ar && styles.rtl]}>
                    {ar ? 'الفني: ' : 'Tech: '}{tk.technicianName}
                  </Text>
                ) : null}
                <MaintenanceTimeline ticket={tk} showEta={false} />
              </GlassCard>
            ))}
          </View>
        ) : (
          <Text style={[styles.dim, styles.gap, ar && styles.rtl]}>
            {ar ? 'لا توجد بلاغات حالياً — يمكنك إنشاء طلب جديد أعلاه' : 'No tickets yet — create a request above'}
          </Text>
        )}
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
  feature: { color: colors.text, fontSize: typography.small, marginTop: 6 },
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
    padding: 10, color: colors.text, minHeight: 60, textAlignVertical: 'top', marginTop: 8,
  },
  row: { flexDirection: 'row', gap: 8, marginTop: 10 },
  approveBtn: {
    flex: 1, padding: 12, borderRadius: radius.md, backgroundColor: colors.emerald,
    alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6,
  },
  approveText: { color: colors.bg, fontWeight: typography.weight.semibold },
  reprocessBtn: {
    flex: 1, padding: 12, borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.goldEdge,
    alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6,
  },
  reprocessText: { color: colors.gold, fontWeight: typography.weight.semibold },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  typeChip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  typeChipOn: { borderColor: colors.emerald, backgroundColor: 'rgba(16,185,129,0.15)' },
  typeChipText: { color: colors.textDim, fontSize: typography.small },
  typeChipTextOn: { color: colors.emerald, fontWeight: typography.weight.semibold },
});
