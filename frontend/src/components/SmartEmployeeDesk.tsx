/**
 * Smart Employee Desk — think / suggest / execute / follow-up (not voice commands).
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Linking, Platform, Share, Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { GlassCard } from '@/src/components/GlassCard';
import { usePropertyOS } from '@/src/hooks/usePropertyOS';
import { useOperational } from '@/src/hooks/useOperational';
import { useNotificationPrefs } from '@/src/hooks/usePreferences';
import {
  thinkSmartEmployee, completeTask, dismissTask, snoozeTask,
} from '@/src/utils/smart-employee-agent';
import {
  enrichSmartEmployeeState,
  isExternalEmployeeEnrichAvailable,
} from '@/src/utils/smart-employee-enrich';
import { loadSmartEmployee, saveSmartEmployee } from '@/src/utils/smart-employee-store';
import { pushLocalNotification } from '@/src/utils/local-notifications';
import type { EmployeeTask, SmartEmployeeState } from '@/src/types/smart-employee';
import { arrearsFromPropertyOS } from '@/src/utils/ops-truth';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';

type Props = { testID?: string };

export function SmartEmployeeDesk({ testID = 'smart-employee-desk' }: Props) {
  const { t, isRTL, lang } = useI18n();
  const ar = lang === 'ar';
  const router = useRouter();
  const { countEnabled } = useNotificationPrefs();
  const { state: os, reload } = usePropertyOS(countEnabled);
  const { openTickets } = useOperational();
  const [emp, setEmp] = useState<SmartEmployeeState>({ tasks: [], activity: [] });
  const [busyId, setBusyId] = useState<string | null>(null);
  const osRef = React.useRef(os);
  osRef.current = os;

  const refresh = useCallback(async () => {
    await reload();
    const prev = await loadSmartEmployee();
    const raw = await import('@/src/utils/storage').then((m) => m.storage.getItem<string>('spp.propertyOS', ''));
    let osLive = osRef.current;
    if (raw) {
      try { osLive = JSON.parse(raw); } catch { /* ignore */ }
    }
    let thought = thinkSmartEmployee({ os: osLive, openTickets, previous: prev });
    const truth = arrearsFromPropertyOS(osLive);
    thought = await enrichSmartEmployeeState(thought, {
      propertyName: osLive.property?.name,
      lateTenantCount: truth.lateTenantCount,
      vacantCount: osLive.units.filter((u) => u.status === 'vacant').length,
      openMaintCount: openTickets.length,
    });
    try {
      const { syncEjarNotices } = await import('@/src/utils/ejar-sync');
      const { tasks: ejarTasks } = await syncEjarNotices(ar);
      if (ejarTasks.length) {
        const existing = new Set(thought.tasks.map((t) => t.id));
        thought = {
          ...thought,
          tasks: [...ejarTasks.filter((t) => !existing.has(t.id)), ...thought.tasks],
          lastThoughtAr: thought.lastThoughtAr
            || 'كويل راجع إشعارات منصة إيجار ويقترح إبلاغ الأطراف بعد إذنك.',
          lastThoughtEn: thought.lastThoughtEn
            || 'Kowil reviewed Ejar notices and suggests notifying parties after your permission.',
        };
      }
    } catch { /* offline */ }
    try {
      const { syncUtilityNotices } = await import('@/src/utils/utilities-sync');
      const { tasks: utilTasks } = await syncUtilityNotices(ar);
      if (utilTasks.length) {
        const existing = new Set(thought.tasks.map((t) => t.id));
        thought = {
          ...thought,
          tasks: [...utilTasks.filter((t) => !existing.has(t.id)), ...thought.tasks],
          lastThoughtAr: thought.lastThoughtAr
            || 'كويل راجع فواتير الكهرباء/المياه ويقترح السداد بعد إذنك.',
          lastThoughtEn: thought.lastThoughtEn
            || 'Kowil reviewed electricity/water bills and suggests payment after your permission.',
        };
      }
    } catch { /* offline */ }
    try {
      const { syncPlatformInbox } = await import('@/src/utils/platform-inbox-sync');
      const { tasks: platTasks } = await syncPlatformInbox(ar);
      if (platTasks.length) {
        const existing = new Set(thought.tasks.map((t) => t.id));
        thought = {
          ...thought,
          tasks: [...platTasks.filter((t) => !existing.has(t.id)), ...thought.tasks],
          lastThoughtAr: thought.lastThoughtAr
            || 'كويل قرأ رسائل المنصات الآلية ومنصات الذكاء — بانتظار موافقتك للتوجيه.',
          lastThoughtEn: thought.lastThoughtEn
            || 'Kowil read automated messaging & intelligence feeds — waiting for your approval to route.',
        };
      }
    } catch { /* offline */ }
    await saveSmartEmployee(thought);
    setEmp(thought);
  }, [openTickets, reload, ar]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const active = emp.tasks.filter((t) =>
    t.status === 'suggested' || t.status === 'in_progress' || t.status === 'waiting_followup');

  const persist = async (next: SmartEmployeeState) => {
    setEmp(next);
    await saveSmartEmployee(next);
  };

  const runAction = async (task: EmployeeTask) => {
    setBusyId(task.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      if (task.requiresOwnerApproval && task.platformEventId) {
        const { approveEjarEvent } = await import('@/src/utils/ejar-sync');
        const { approveUtilityPayment } = await import('@/src/utils/utilities-sync');
        const { approvePlatformInboxEvent } = await import('@/src/utils/platform-inbox-sync');
        const { dispatchAfterOwnerApproval } = await import('@/src/utils/kowil-platform-dispatch');
        const {
          onEjarApproved,
          onUtilityPaymentApproved,
          onPlatformMessageApproved,
        } = await import('@/src/utils/operational-flow-engine');

        let prepared: Record<string, string> | undefined;
        const eid = task.platformEventId;

        if (task.platformSource === 'ejar' || task.id.startsWith('ejar_task_')) {
          const res = await approveEjarEvent(eid);
          prepared = res?.approval?.prepared_messages as Record<string, string> | undefined;
          await onEjarApproved(task.unitNumber || '');
        } else if (task.platformSource === 'electricity' || task.platformSource === 'water') {
          const res = await approveUtilityPayment(eid);
          prepared = res?.approval?.prepared_messages as Record<string, string> | undefined;
          await onUtilityPaymentApproved(task.platformSource, eid);
        } else {
          const res = await approvePlatformInboxEvent(eid);
          prepared = res?.approval?.prepared_messages as Record<string, string> | undefined;
          await onPlatformMessageApproved(task.routeTo || 'tenant', task.platformSource || 'platform');
        }

        await dispatchAfterOwnerApproval(prepared, task, task.routeTo);
        await pushLocalNotification({
          title: ar ? 'كويل أرسل بعد موافقتك' : 'Kowil sent after your approval',
          body: ar ? task.titleAr : task.titleEn,
          route: '/brain',
        });
        await persist(completeTask(emp, task.id, true));
        return;
      }

      if (task.action === 'send_whatsapp' && task.whatsappMessage) {
        const digits = String(task.whatsappPhone || '').replace(/\D/g, '');
        const msg = task.whatsappMessage;
        if (digits) {
          const wa = Platform.select({
            ios: `whatsapp://send?phone=${digits}&text=${encodeURIComponent(msg)}`,
            default: `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`,
          });
          await Linking.openURL(wa!).catch(() => Share.share({ message: msg }));
        } else {
          await Share.share({ message: msg });
        }
        await pushLocalNotification({
          title: 'Kowil sent a message',
          body: task.titleEn,
          titleAr: 'كويل نفّذ إرسالاً',
          titleEn: 'Kowil sent a message',
          bodyAr: task.titleAr,
          bodyEn: task.titleEn,
          route: '/brain',
        });
        await persist(completeTask(emp, task.id, true));
        return;
      }

      if (task.route && task.action !== 'mark_done') {
        router.push(task.route as any);
      }

      if (task.action === 'mark_done') {
        await persist(completeTask(emp, task.id, false));
      } else if (task.action !== 'send_whatsapp') {
        await persist(completeTask(emp, task.id, task.kind === 'collect_arrears'));
        const pathBodyAr = `تم فتح مسار: ${task.titleAr}`;
        const pathBodyEn = `Opened path: ${task.titleEn}`;
        await pushLocalNotification({
          title: 'Kowil is tracking',
          body: pathBodyEn,
          titleAr: 'كويل يتابع',
          titleEn: 'Kowil is tracking',
          bodyAr: pathBodyAr,
          bodyEn: pathBodyEn,
          route: task.route || '/brain',
        });
      }
    } finally {
      setBusyId(null);
    }
  };

  const onSnooze = async (task: EmployeeTask) => {
    Haptics.selectionAsync();
    await persist(snoozeTask(emp, task.id, 24));
  };

  const onDismiss = async (task: EmployeeTask) => {
    Haptics.selectionAsync();
    Alert.alert(
      t('opsv2.smart.desk.dismissTitle' as any),
      ar ? task.titleAr : task.titleEn,
      [
        { text: t('opsv2.smart.desk.dismissCancel' as any), style: 'cancel' },
        {
          text: t('opsv2.smart.desk.dismissConfirm' as any),
          style: 'destructive',
          onPress: async () => { await persist(dismissTask(emp, task.id)); },
        },
      ],
    );
  };

  return (
    <View testID={testID} style={styles.wrap}>
      <GlassCard padding={16} radiusToken="md" edge="gold" style={styles.thought}>
        <View style={[styles.thoughtHead, ar && styles.rowRtl]}>
          <Feather name="cpu" size={18} color={colors.gold} />
          <Text style={[styles.thoughtTitle, ar && styles.rtl]}>
            {t('opsv2.smart.desk.title' as any)}
          </Text>
        </View>
        <Text style={[styles.thoughtBody, ar && styles.rtl]}>
          {ar
            ? (emp.lastThoughtAr || t('opsv2.smart.desk.thinking' as any))
            : (emp.lastThoughtEn || t('opsv2.smart.desk.thinking' as any))}
        </Text>
        <Text style={[styles.modeLine, ar && styles.rtl]}>
          {isExternalEmployeeEnrichAvailable()
            ? t('opsv2.smart.desk.mode.enrich' as any)
            : t('opsv2.smart.desk.mode.local' as any)}
        </Text>
        <Pressable onPress={() => void refresh()} style={[styles.refresh, ar && styles.rowRtl]}>
          <Feather name="refresh-cw" size={12} color={colors.emerald} />
          <Text style={styles.refreshText}>{t('opsv2.smart.desk.reanalyze' as any)}</Text>
        </Pressable>
      </GlassCard>

      <Text style={[styles.section, ar && styles.rtl]}>
        {t('opsv2.smart.desk.todayWork' as any).replace('{count}', String(active.length))}
      </Text>

      {active.length === 0 ? (
        <GlassCard padding={16} radiusToken="md">
          <Text style={[styles.empty, ar && styles.rtl]}>
            {t('opsv2.smart.desk.empty' as any)}
          </Text>
        </GlassCard>
      ) : (
        active.map((task) => (
          <GlassCard key={task.id} padding={14} radiusToken="md" edge={task.priority === 1 ? 'gold' : undefined} style={styles.card}>
            <View style={[styles.priRow, ar && styles.rowRtl]}>
              <View style={[styles.priDot, task.priority === 1 && styles.priHot]} />
              <Text style={[styles.cardTitle, ar && styles.rtl]}>
                {ar ? task.titleAr : task.titleEn}
              </Text>
            </View>
            <Text style={[styles.cardReason, ar && styles.rtl]}>
              {ar ? task.reasonAr : task.reasonEn}
            </Text>
            {task.status === 'waiting_followup' ? (
              <Text style={[styles.follow, ar && styles.rtl]}>
                {t('opsv2.smart.desk.waitFollowup' as any)}
                {task.followUpAt
                  ? ` · ${new Date(task.followUpAt).toLocaleString(ar ? 'ar-SA' : undefined)}`
                  : ''}
              </Text>
            ) : null}
            {(task.attemptCount || 0) > 0 ? (
              <Text style={[styles.attempt, ar && styles.rtl]}>
                {t('opsv2.smart.desk.attempts' as any).replace('{count}', String(task.attemptCount))}
              </Text>
            ) : null}
            <View style={[styles.actions, ar && styles.rowRtl]}>
              <Pressable
                style={[styles.primary, busyId === task.id && { opacity: 0.5 }]}
                disabled={busyId === task.id}
                onPress={() => void runAction(task)}
                testID={`employee-exec-${task.id}`}
              >
                <Feather name="play" size={12} color={colors.bg} />
                <Text style={styles.primaryText}>
                  {ar ? task.actionLabelAr : task.actionLabelEn}
                </Text>
              </Pressable>
              <Pressable style={styles.secondary} onPress={() => void onSnooze(task)}>
                <Text style={styles.secondaryText}>{t('opsv2.smart.desk.later' as any)}</Text>
              </Pressable>
              <Pressable style={styles.ghost} onPress={() => void onDismiss(task)}>
                <Text style={styles.ghostText}>{t('opsv2.smart.desk.skip' as any)}</Text>
              </Pressable>
            </View>
          </GlassCard>
        ))
      )}

      {emp.activity.length > 0 ? (
        <>
          <Text style={[styles.section, ar && styles.rtl, { marginTop: spacing.lg }]}>
            {t('opsv2.smart.desk.executionLog' as any)}
          </Text>
          <GlassCard padding={14} radiusToken="md">
            {emp.activity.slice(0, 5).map((a) => (
              <Text key={a.id} style={[styles.logLine, ar && styles.rtl]}>
                · {ar ? a.textAr : a.textEn}
              </Text>
            ))}
          </GlassCard>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.lg },
  thought: { marginBottom: spacing.md },
  thoughtHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  thoughtTitle: { color: colors.gold, fontSize: 15, fontWeight: typography.weight.semibold, flex: 1 },
  thoughtBody: { color: colors.text, fontSize: 14, lineHeight: 22 },
  modeLine: { color: colors.textMuted, fontSize: 11, marginTop: 8 },
  refresh: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  refreshText: { color: colors.emerald, fontSize: 12, fontWeight: typography.weight.semibold },
  section: {
    color: colors.textMuted, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase',
    fontWeight: typography.weight.semibold, marginBottom: spacing.sm,
  },
  empty: { color: colors.textDim, fontSize: 13, lineHeight: 20 },
  card: { marginBottom: spacing.sm },
  priRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  priDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.emerald },
  priHot: { backgroundColor: colors.gold },
  cardTitle: { color: colors.text, fontSize: 14, fontWeight: typography.weight.semibold, flex: 1 },
  cardReason: { color: colors.textDim, fontSize: 12, marginTop: 6, lineHeight: 18 },
  follow: { color: colors.gold, fontSize: 11, marginTop: 6 },
  attempt: { color: colors.textMuted, fontSize: 10, marginTop: 4 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, alignItems: 'center' },
  primary: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.emerald, paddingHorizontal: 12, paddingVertical: 10, borderRadius: radius.md,
  },
  primaryText: { color: colors.bg, fontWeight: typography.weight.semibold, fontSize: 12 },
  secondary: {
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  secondaryText: { color: colors.text, fontSize: 12 },
  ghost: { paddingHorizontal: 8, paddingVertical: 10 },
  ghostText: { color: colors.textMuted, fontSize: 12 },
  logLine: { color: colors.textDim, fontSize: 12, lineHeight: 18, marginBottom: 4 },
  rowRtl: { flexDirection: 'row-reverse' },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
});
