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
import { TechTaskWorkflowCard } from '@/src/components/TechTaskWorkflowCard';
import { usePropertyOS } from '@/src/hooks/usePropertyOS';
import { useOperational } from '@/src/hooks/useOperational';
import { useTechnicians } from '@/src/hooks/useTechnicians';
import { usePortalDesk } from '@/src/hooks/usePortalDesk';
import { useNotificationPrefs } from '@/src/hooks/usePreferences';
import { techThreadId } from '@/src/types/portal-desk';
import { loadPortalDesk, pushPortalNotice } from '@/src/utils/portal-desk-store';
import { colors, spacing, typography } from '@/src/theme';
import { useI18n } from '@/src/i18n';

/**
 * Technician limited portal — installable link app with task workflow:
 * notify → accept → in progress → photo/video → complete → report.
 */
export default function TechPortalScreen() {
  const { t, isRTL, lang } = useI18n();
  const ar = lang === 'ar' || !!isRTL;
  const params = useLocalSearchParams<{ id?: string; t?: string; n?: string; name?: string }>();
  const { countEnabled } = useNotificationPrefs();
  const { state } = usePropertyOS(countEnabled);
  const {
    tickets, ticketsForTechnician, acceptTicket, enRouteTicket, startTicket,
    uploadTicketMedia, completeTicket,
  } = useOperational();
  const { technicians, logLogin } = useTechnicians();
  usePortalDesk(); // keep desk subscription alive for notices in LimitedPortalContact


  const localTech = technicians.find((x) => x.id === params.id && x.portalToken === params.t);
  const guestName = String(params.n || params.name || '').trim();
  const legacyValid = Boolean(
    !params.id && params.t && state.technicianPortalToken && params.t === state.technicianPortalToken,
  );
  const guestMode = !localTech && Boolean(params.t && (params.id || guestName));
  const tech = localTech || (guestMode && params.id
    ? {
        id: String(params.id),
        name: guestName || (t('op.tech.title') as string) || 'Technician',
        phone: '',
        specialty: 'general' as const,
        portalToken: String(params.t),
        portalUrl: '',
        qrData: '',
        createdAt: '',
        linkActive: true,
        completedJobs: 0,
      }
    : undefined);
  const valid = Boolean(tech) || legacyValid || (guestMode && !!params.t);

  useEffect(() => {
    if (tech) void logLogin(tech.id);
  }, [tech?.id]);

  const myTickets = useMemo(() => {
    if (tech) return ticketsForTechnician(tech.id);
    if (legacyValid) return [];
    return [];
  }, [tech, legacyValid, ticketsForTechnician, tickets]);

  // Soft notify once per assigned ticket title (deduped against existing desk notices).
  useEffect(() => {
    if (!tech) return;
    let cancelled = false;
    (async () => {
      const desk = await loadPortalDesk();
      const existing = new Set(
        desk.notices
          .filter((n) => n.audience === 'tech' && n.audienceId === tech.id)
          .map((n) => n.body),
      );
      const assigned = myTickets.filter((tk) => tk.status === 'assigned' || tk.status === 'open');
      for (const tk of assigned) {
        const body = ar ? `مهمة جديدة: ${tk.title}` : `New task: ${tk.title}`;
        if (existing.has(body)) continue;
        if (cancelled) return;
        await pushPortalNotice({
          audience: 'tech',
          audienceId: tech.id,
          title: ar ? 'إشعار بمهمة' : 'Task notification',
          body,
          kind: 'task',
        });
        existing.add(body);
      }
    })();
    return () => { cancelled = true; };
  }, [tech?.id, myTickets.map((t) => `${t.id}:${t.status}`).join('|'), ar]);

  const { newTasks, activeTasks, doneTasks } = useMemo(() => ({
    newTasks: myTickets.filter((tk) => tk.status === 'assigned' || tk.status === 'open'),
    activeTasks: myTickets.filter((tk) => ['accepted', 'en_route', 'in_progress'].includes(tk.status)),
    doneTasks: myTickets.filter((tk) => tk.status === 'closed' || tk.status === 'awaiting_tenant'),
  }), [myTickets]);

  if (!valid) {
    return (
      <ScreenScaffold testID="tech-portal">
        <StoryScreenHeader question={t('maint.techDashboard' as any)} hint={t('op.tech.invalid')} showBack />
        <AliveEmpty title={t('op.tech.title')} body={t('op.tech.invalid')} />
      </ScreenScaffold>
    );
  }

  const renderList = (label: string, list: typeof myTickets) => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, isRTL && styles.rtl]}>{label}</Text>
      {list.length === 0 ? <Text style={styles.empty}>—</Text> : list.map((tk) => {
        const unit = state.units.find((u) => u.id === tk.unitId);
        return (
          <TechTaskWorkflowCard
            key={tk.id}
            ticket={tk}
            unitNumber={unit?.number}
            onAccept={async () => {
              await acceptTicket(tk.id);
              if (tech) {
                await pushPortalNotice({
                  audience: 'tech',
                  audienceId: tech.id,
                  title: ar ? 'استلام المهمة' : 'Task accepted',
                  body: ar ? `تم استلام: ${tk.title}` : `Accepted: ${tk.title}`,
                  kind: 'task',
                });
              }
            }}
            onEnRoute={async () => { await enRouteTicket(tk.id); }}
            onStart={async () => {
              await startTicket(tk.id);
              if (tech) {
                await pushPortalNotice({
                  audience: 'tech',
                  audienceId: tech.id,
                  title: ar ? 'جاري تنفيذ المهمة' : 'Work in progress',
                  body: ar ? `قيد التنفيذ: ${tk.title}` : `In progress: ${tk.title}`,
                  kind: 'task',
                });
              }
            }}
            onUpload={async (media, phase) => {
              await uploadTicketMedia(tk.id, media, phase);
              if (tech) {
                await pushPortalNotice({
                  audience: 'tech',
                  audienceId: tech.id,
                  title: ar ? 'توثيق العمل' : 'Work documented',
                  body: ar
                    ? `تم رفع ${media[0]?.type === 'video' ? 'فيديو' : 'صورة'} للمهمة: ${tk.title}`
                    : `${media[0]?.type === 'video' ? 'Video' : 'Photo'} uploaded for: ${tk.title}`,
                  kind: 'media',
                });
              }
            }}
            onComplete={async (report) => {
              await completeTicket(tk.id, report || undefined);
              if (tech) {
                await pushPortalNotice({
                  audience: 'tech',
                  audienceId: tech.id,
                  title: ar ? 'اكتمال المهمة · التقرير' : 'Task complete · report',
                  body: report
                    ? (ar ? `اكتملت مع تقرير: ${report}` : `Completed with report: ${report}`)
                    : (ar ? `اكتملت المهمة: ${tk.title}` : `Completed: ${tk.title}`),
                  kind: 'task',
                });
              }
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }}
          />
        );
      })}
    </View>
  );

  return (
    <ScreenScaffold testID="tech-portal">
      <ScrollView contentContainerStyle={{ paddingBottom: spacing['2xl'] }}>
        <StoryScreenHeader
          question={tech ? tech.name : t('op.tech.title')}
          hint={guestMode
            ? (isRTL ? 'تم فتح رابط الفني بنجاح — ثبّته كتطبيق على جوالك' : 'Technician link opened — install it as an app')
            : t('opsv2.tech.portalHint' as any)}
          showBack
        />

        {tech ? (
          <ActingAsBadge
            role="tech"
            displayName={tech.name}
            scope={`${t('maint.techJobs' as any)}: ${tech.completedJobs ?? 0}`}
          />
        ) : null}

        <PortalInstallHint role="tech" />

        {tech ? (
          <LimitedPortalContact
            actor="tech"
            actorId={tech.id}
            actorName={tech.name}
            threadId={techThreadId(tech.id)}
          />
        ) : null}

        <GlassCard padding={14} radiusToken="md" edge="gold" style={{ marginBottom: spacing.md }}>
          <Text style={[styles.sectionTitle, isRTL && styles.rtl]}>
            {t('opsv2.tech.stepsTitle' as any)}
          </Text>
          <Text style={[styles.dim, isRTL && styles.rtl]}>
            {t('opsv2.tech.limitedBody' as any)}
          </Text>
        </GlassCard>

        {guestMode ? (
          <GlassCard padding={16} radiusToken="md" edge="emerald" style={{ marginBottom: spacing.md }}>
            <Text style={[styles.sectionTitle, isRTL && styles.rtl]}>
              {isRTL ? 'الرابط يعمل' : 'Link is active'}
            </Text>
            <Text style={[styles.dim, isRTL && styles.rtl]}>
              {isRTL
                ? 'ثبّت الرابط كتطبيق، ثم ستظهر المهام المعيّنة مع خطوات الاستلام والتنفيذ والتوثيق والتقرير.'
                : 'Install this link as an app. Assigned tasks appear with accept → progress → proof → report steps.'}
            </Text>
          </GlassCard>
        ) : null}

        {!guestMode && myTickets.length === 0 ? (
          <AliveEmpty title={t('op.tech.title')} body={t('op.tech.noTickets')} />
        ) : !guestMode ? (
          <>
            {renderList(t('opsv2.tech.new' as any), newTasks)}
            {renderList(t('opsv2.tech.active' as any), activeTasks)}
            {renderList(t('opsv2.tech.done' as any), doneTasks)}
          </>
        ) : null}
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
  dim: { color: colors.textMuted, fontSize: typography.small, lineHeight: 18 },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
});
