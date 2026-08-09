/**
 * Owner operations request path — blinking steps for tenant payment/maintenance requests.
 * Separate from the raw tenants table; preserves SPP identity.
 */
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ScreenScaffold } from '@/src/components/ScreenScaffold';
import { StoryScreenHeader } from '@/src/components/StoryScreenHeader';
import { GlassCard } from '@/src/components/GlassCard';
import { BlinkStepPath } from '@/src/components/BlinkStepPath';
import { AliveEmpty } from '@/src/components/AliveEmpty';
import { useTenantOps } from '@/src/hooks/useTenantOps';
import { usePortalDesk } from '@/src/hooks/usePortalDesk';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';

export default function OwnerOpsRequestsScreen() {
  const { t, isRTL, lang } = useI18n();
  const ar = lang === 'ar' || !!isRTL;
  const router = useRouter();
  const { open, markPaymentOwnerReceived, advanceMaintenanceJourney, reload } = useTenantOps();
  const { confirmPayment, reload: reloadDesk } = usePortalDesk();

  useEffect(() => {
    // Opening the ops path = owner received payment notices (idempotent).
    open
      .filter((j) => j.kind === 'payment' && j.paymentId)
      .filter((j) => j.steps.some((s) => s.key === 'owner_received' && s.status !== 'done'))
      .forEach((j) => {
        void markPaymentOwnerReceived(j.paymentId!);
      });
  }, [open]);

  return (
    <ScreenScaffold testID="owner-ops-requests">
      <StoryScreenHeader
        question={ar ? 'مسار عمليات المالك' : 'Owner operations path'}
        hint={ar
          ? 'كل طلب من المستأجر يظهر كمسار واضح مع وميض على الخطوة الحالية'
          : 'Every tenant request appears as a clear path with a blink on the active step'}
        showBack
      />

      <Pressable
        style={[styles.reportsBtn, isRTL && styles.rowRtl]}
        onPress={() => router.push('/operational/ops-reports' as any)}
        testID="open-ops-reports"
      >
        <Feather name="file-text" size={14} color={colors.gold} />
        <Text style={styles.reportsBtnText}>
          {ar ? 'تقارير العمليات المكتملة' : 'Completed operations reports'}
        </Text>
      </Pressable>

      {!open.length ? (
        <AliveEmpty
          title={ar ? 'لا طلبات مفتوحة' : 'No open requests'}
          body={ar
            ? 'عند إرسال مستأجر إشعار سداد أو طلب صيانة يظهر المسار هنا.'
            : 'When a tenant sends a payment notice or maintenance request, the path appears here.'}
        />
      ) : null}

      {open.map((j, index) => (
        <Animated.View key={j.id} entering={FadeInDown.duration(400).delay(index * 40)} style={styles.gap}>
          <GlassCard padding={14} radiusToken="md" edge="gold">
            <Text style={[styles.meta, isRTL && styles.rtl]}>
              {j.tenantName}
              {j.unitNumber ? ` · ${ar ? 'شقة' : 'unit'} ${j.unitNumber}` : ''}
              {j.kind === 'payment' ? (ar ? ' · سداد' : ' · payment') : (ar ? ' · صيانة' : ' · maintenance')}
            </Text>
            <Text style={[styles.body, isRTL && styles.rtl]}>
              {ar ? j.titleAr : j.titleEn}
            </Text>
            {j.amount != null ? (
              <Text style={[styles.dim, isRTL && styles.rtl]}>{j.amount} SAR</Text>
            ) : null}
          </GlassCard>

          <BlinkStepPath
            title={ar ? 'مسار التنفيذ' : 'Execution path'}
            steps={j.steps}
            testID={`owner-journey-${j.id}`}
          />

          <View style={[styles.row, isRTL && styles.rowRtl]}>
            {j.kind === 'payment' && j.paymentId ? (
              <Pressable
                style={styles.approve}
                testID={`ops-confirm-pay-${j.paymentId}`}
                onPress={async () => {
                  await confirmPayment(j.paymentId!, ar);
                  await reloadDesk();
                  await reload();
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }}
              >
                <Text style={styles.approveText}>
                  {ar ? 'موافقة استلام السداد' : 'Approve payment receipt'}
                </Text>
              </Pressable>
            ) : null}

            {j.kind === 'maintenance' && j.ticketId ? (
              <>
                <Pressable
                  style={styles.approve}
                  onPress={async () => {
                    await advanceMaintenanceJourney(j.ticketId!, 'owner_approved');
                    await reload();
                    Haptics.selectionAsync();
                  }}
                >
                  <Text style={styles.approveText}>
                    {ar ? 'موافقة على طلب الصيانة' : 'Approve maintenance request'}
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.secondary}
                  onPress={() => router.push('/maintenance' as any)}
                >
                  <Text style={styles.secondaryText}>
                    {ar ? 'فتح الصيانة' : 'Open maintenance'}
                  </Text>
                </Pressable>
              </>
            ) : null}
          </View>
        </Animated.View>
      ))}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  gap: { marginBottom: spacing.md },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  rowRtl: { flexDirection: 'row-reverse' },
  meta: { color: colors.gold, fontSize: 12, fontWeight: typography.weight.semibold },
  body: { color: colors.text, fontSize: typography.body, marginTop: 4 },
  dim: { color: colors.textDim, fontSize: 12, marginTop: 4 },
  approve: {
    flexGrow: 1,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.emerald,
    alignItems: 'center',
  },
  approveText: { color: colors.bg, fontWeight: typography.weight.semibold, fontSize: 13 },
  secondary: {
    flexGrow: 1,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.goldEdge,
    alignItems: 'center',
  },
  secondaryText: { color: colors.gold, fontWeight: typography.weight.semibold, fontSize: 13 },
  reportsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  reportsBtnText: { color: colors.gold, fontSize: 13, fontWeight: typography.weight.medium },
});
