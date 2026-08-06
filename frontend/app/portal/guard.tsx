import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { ScreenScaffold } from '@/src/components/ScreenScaffold';
import { StoryScreenHeader } from '@/src/components/StoryScreenHeader';
import { GlassCard } from '@/src/components/GlassCard';
import { AliveEmpty } from '@/src/components/AliveEmpty';
import { ActingAsBadge } from '@/src/components/ActingAsBadge';
import { PortalInstallHint } from '@/src/components/PortalInstallHint';
import { LimitedPortalContact } from '@/src/components/LimitedPortalContact';
import { GuardTaskWorkflowCard } from '@/src/components/GuardTaskWorkflowCard';
import { usePortalAccess } from '@/src/hooks/usePortalAccess';
import { usePortalDesk } from '@/src/hooks/usePortalDesk';
import { guardThreadId } from '@/src/types/portal-desk';
import { loadPortalDesk, pushPortalNotice } from '@/src/utils/portal-desk-store';
import { colors, spacing, typography } from '@/src/theme';
import { useI18n } from '@/src/i18n';

/**
 * Guard limited portal — installable link app with task workflow:
 * notify → accept → notes/photo/video → hand to agent → done.
 */
export default function GuardPortalScreen() {
  const { t, isRTL, lang } = useI18n();
  const ar = lang === 'ar' || !!isRTL;
  const params = useLocalSearchParams<{ id?: string; t?: string }>();
  const {
    guards, followUps, agents, ready,
    replyFollowUp, acceptGuardFollowUp, setFollowUpStatus, logLogin,
  } = usePortalAccess();
  usePortalDesk();

  const guard = guards.find((g) => g.id === params.id && g.portalToken === params.t && g.linkActive);

  useEffect(() => {
    if (guard) void logLogin(guard.id, 'guard', guard.name);
  }, [guard?.id]);

  const mine = useMemo(
    () => followUps.filter(
      (f) => f.guardId === guard?.id || (!f.guardId && f.status === 'waiting_guard' && !!guard),
    ),
    [followUps, guard?.id],
  );

  const pairedAgent = agents.find((a) => a.id === guard?.pairedAgentId);

  const { newTasks, activeTasks, doneTasks } = useMemo(() => ({
    newTasks: mine.filter((f) => !f.guardAcceptedAt && f.status !== 'done'),
    activeTasks: mine.filter((f) => f.guardAcceptedAt && f.status !== 'done'),
    doneTasks: mine.filter((f) => f.status === 'done'),
  }), [mine]);

  // Soft notify once per waiting_guard title (deduped against existing desk notices).
  useEffect(() => {
    if (!guard) return;
    let cancelled = false;
    (async () => {
      const desk = await loadPortalDesk();
      const existing = new Set(
        desk.notices
          .filter((n) => n.audience === 'guard' && n.audienceId === guard.id)
          .map((n) => n.body),
      );
      const assigned = mine.filter((f) => !f.guardAcceptedAt && f.status !== 'done');
      for (const f of assigned) {
        const body = ar ? `مهمة جديدة: ${f.title}` : `New task: ${f.title}`;
        if (existing.has(body)) continue;
        if (cancelled) return;
        await pushPortalNotice({
          audience: 'guard',
          audienceId: guard.id,
          title: ar ? 'إشعار بمهمة' : 'Task notification',
          body,
          kind: 'task',
        });
        existing.add(body);
      }
    })();
    return () => { cancelled = true; };
  }, [guard?.id, mine.map((f) => `${f.id}:${f.status}:${f.guardAcceptedAt || ''}`).join('|'), ar]);

  if (!ready) {
    return (
      <ScreenScaffold testID="guard-portal">
        <StoryScreenHeader question={t('opsv2.guard.title' as any)} showBack />
        <AliveEmpty title={t('opsv2.guard.title' as any)} body={ar ? 'جاري التحميل…' : 'Loading…'} />
      </ScreenScaffold>
    );
  }

  if (!guard) {
    return (
      <ScreenScaffold testID="guard-portal">
        <StoryScreenHeader question={t('opsv2.guard.title' as any)} showBack />
        <AliveEmpty title={t('opsv2.guard.title' as any)} body={t('opsv2.guard.invalid' as any)} />
      </ScreenScaffold>
    );
  }

  const renderList = (label: string, list: typeof mine) => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, isRTL && styles.rtl]}>{label}</Text>
      {list.length === 0 ? <Text style={styles.empty}>—</Text> : list.map((f) => (
        <GuardTaskWorkflowCard
          key={f.id}
          followUp={f}
          onAccept={async () => {
            await acceptGuardFollowUp(f.id);
            await pushPortalNotice({
              audience: 'guard',
              audienceId: guard.id,
              title: ar ? 'استلام المهمة' : 'Task accepted',
              body: ar ? `تم استلام: ${f.title}` : `Accepted: ${f.title}`,
              kind: 'task',
            });
          }}
          onReply={async (text, media, nextStatus) => {
            await replyFollowUp(f.id, 'guard', guard.name, text, nextStatus, media);
            if (media?.length) {
              await pushPortalNotice({
                audience: 'guard',
                audienceId: guard.id,
                title: ar ? 'رفع توثيق' : 'Proof uploaded',
                body: ar
                  ? `تم رفع ${media[0]?.kind === 'video' ? 'فيديو' : 'صورة'} للمهمة: ${f.title}`
                  : `${media[0]?.kind === 'video' ? 'Video' : 'Photo'} uploaded for: ${f.title}`,
                kind: 'media',
              });
            } else if (text.trim()) {
              await pushPortalNotice({
                audience: 'guard',
                audienceId: guard.id,
                title: ar ? 'ملاحظات المهمة' : 'Task notes',
                body: ar ? `ملاحظة على: ${f.title}` : `Note on: ${f.title}`,
                kind: 'task',
              });
            }
          }}
          onHandToAgent={async () => {
            await setFollowUpStatus(f.id, 'waiting_agent');
            await pushPortalNotice({
              audience: 'guard',
              audienceId: guard.id,
              title: ar ? 'تسليم للوكيل' : 'Handed to agent',
              body: ar ? `تم تحويل: ${f.title}` : `Handed off: ${f.title}`,
              kind: 'task',
            });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }}
          onMarkDone={async () => {
            await setFollowUpStatus(f.id, 'done');
            await pushPortalNotice({
              audience: 'guard',
              audienceId: guard.id,
              title: ar ? 'اكتمال المهمة' : 'Task complete',
              body: ar ? `اكتملت: ${f.title}` : `Completed: ${f.title}`,
              kind: 'task',
            });
          }}
        />
      ))}
    </View>
  );

  return (
    <ScreenScaffold testID="guard-portal">
      <ScrollView contentContainerStyle={{ paddingBottom: spacing['2xl'] }}>
        <StoryScreenHeader
          question={t('opsv2.guard.welcome' as any).replace('{name}', guard.name)}
          hint={t('opsv2.guard.portalHint' as any)}
          showBack
        />
        <ActingAsBadge role="guard" displayName={guard.name} scope={pairedAgent?.name} />
        <PortalInstallHint role="guard" />
        <LimitedPortalContact
          actor="guard"
          actorId={guard.id}
          actorName={guard.name}
          threadId={guardThreadId(guard.id)}
        />

        <GlassCard padding={14} radiusToken="md" edge="emerald" style={{ marginBottom: spacing.md }}>
          <Text style={[styles.sectionTitle, isRTL && styles.rtl]}>
            {t('opsv2.agent.teamTitle' as any)}
          </Text>
          <Text style={[styles.dim, isRTL && styles.rtl]}>
            {ar ? 'المالك · يتابع الموافقات' : 'Owner · approvals'}
          </Text>
          <Text style={[styles.dim, isRTL && styles.rtl]}>
            {pairedAgent
              ? (ar ? `الوكيل · ${pairedAgent.name}` : `Agent · ${pairedAgent.name}`)
              : (ar ? 'الوكيل · مرتبط بالعقار' : 'Agent · property-linked')}
          </Text>
          <Text style={[styles.dim, isRTL && styles.rtl]}>
            {ar ? `الحارس · ${guard.name}` : `Guard · ${guard.name}`}
          </Text>
        </GlassCard>

        <GlassCard padding={14} radiusToken="md" edge="gold" style={{ marginBottom: spacing.md }}>
          <Text style={[styles.sectionTitle, isRTL && styles.rtl]}>
            {t('opsv2.guard.stepsTitle' as any)}
          </Text>
          <Text style={[styles.dim, isRTL && styles.rtl]}>
            {t('opsv2.guard.limitedBody' as any)}
          </Text>
        </GlassCard>

        {mine.length === 0 ? (
          <AliveEmpty
            title={t('opsv2.guard.title' as any)}
            body={t('opsv2.agent.emptyFollowups' as any)}
          />
        ) : (
          <>
            {renderList(t('opsv2.guard.new' as any), newTasks)}
            {renderList(t('opsv2.guard.active' as any), activeTasks)}
            {renderList(t('opsv2.guard.done' as any), doneTasks)}
          </>
        )}
      </ScrollView>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: spacing.lg },
  sectionTitle: {
    color: colors.textMuted, fontSize: 10, letterSpacing: 1.5,
    textTransform: 'uppercase', marginBottom: spacing.sm,
    fontWeight: typography.weight.semibold,
  },
  empty: { color: colors.textSubtle, fontSize: 12 },
  dim: { color: colors.textMuted, fontSize: typography.small, lineHeight: 18, marginTop: 4 },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
});
