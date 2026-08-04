/**
 * TechTaskWorkflowCard — limited technician portal task desk.
 * Steps: notify → accept → in progress → photo/video proof → complete → report.
 * Additive GlassCard UI; no identity redesign.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';

import { GlassCard } from '@/src/components/GlassCard';
import { KeyboardAwareTextInput } from '@/src/components/KeyboardAwareTextInput';
import { MaintenanceTimeline } from '@/src/components/maintenance/MaintenanceTimeline';
import type { MaintenanceTicket, MediaAttachment } from '@/src/types/operational';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';

export type TechWorkflowStepId =
  | 'notify'
  | 'accept'
  | 'progress'
  | 'document'
  | 'complete'
  | 'report';

type Props = {
  ticket: MaintenanceTicket;
  unitNumber?: string;
  onAccept: () => Promise<void> | void;
  onStart: () => Promise<void> | void;
  onEnRoute?: () => Promise<void> | void;
  onUpload: (media: MediaAttachment[], phase: 'before' | 'after' | 'general') => Promise<void> | void;
  onComplete: (report: string) => Promise<void> | void;
};

function stepState(
  ticket: MaintenanceTicket,
  id: TechWorkflowStepId,
): 'done' | 'current' | 'todo' {
  const s = ticket.status;
  const hasMedia = Boolean(
    (ticket.beforeMedia?.length || 0)
    + (ticket.afterMedia?.length || 0)
    + (ticket.media?.length || 0),
  );
  const closed = s === 'closed' || s === 'awaiting_tenant';

  switch (id) {
    case 'notify':
      return 'done';
    case 'accept':
      if (s === 'assigned' || s === 'open') return 'current';
      return 'done';
    case 'progress':
      if (s === 'assigned' || s === 'open') return 'todo';
      if (s === 'accepted' || s === 'en_route') return 'current';
      return 'done';
    case 'document':
      if (['assigned', 'open', 'accepted', 'en_route'].includes(s)) return 'todo';
      if (s === 'in_progress' && !hasMedia) return 'current';
      if (s === 'in_progress' && hasMedia) return 'done';
      if (closed) return 'done';
      return hasMedia ? 'done' : 'todo';
    case 'complete':
      if (closed) return 'done';
      if (s === 'in_progress') return 'current';
      return 'todo';
    case 'report':
      if (closed) return 'done';
      if (s === 'in_progress') return 'current';
      return 'todo';
    default:
      return 'todo';
  }
}

export function TechTaskWorkflowCard({
  ticket, unitNumber, onAccept, onStart, onEnRoute, onUpload, onComplete,
}: Props) {
  const { t, isRTL, lang } = useI18n();
  const ar = lang === 'ar' || !!isRTL;
  const [report, setReport] = useState('');

  const steps = useMemo(() => ([
    { id: 'notify' as const, label: t('opsv2.tech.step.notify' as any) },
    { id: 'accept' as const, label: t('opsv2.tech.step.accept' as any) },
    { id: 'progress' as const, label: t('opsv2.tech.step.progress' as any) },
    { id: 'document' as const, label: t('opsv2.tech.step.document' as any) },
    { id: 'complete' as const, label: t('opsv2.tech.step.complete' as any) },
    { id: 'report' as const, label: t('opsv2.tech.step.report' as any) },
  ]), [t]);

  const pick = async (kind: 'photo' | 'video', phase: 'before' | 'after' | 'general') => {
    const res = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      type: kind === 'photo' ? ['image/*'] : ['video/*'],
    });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    await onUpload([{
      uri: a.uri,
      type: kind,
      name: a.name,
      addedAt: new Date().toISOString(),
      phase,
    }], phase);
    Haptics.selectionAsync();
  };

  const mediaCount = (ticket.beforeMedia?.length || 0)
    + (ticket.afterMedia?.length || 0)
    + (ticket.media?.length || 0);

  const closed = ticket.status === 'closed' || ticket.status === 'awaiting_tenant';

  return (
    <GlassCard padding={16} radiusToken="md" style={styles.card} edge="emerald" testID={`tech-task-${ticket.id}`}>
      <Text style={[styles.title, isRTL && styles.rtl]}>{ticket.title}</Text>
      <Text style={[styles.dim, isRTL && styles.rtl]}>
        {t('op.tenant.unit')} {unitNumber ?? '—'} · {ticket.progressPercent ?? 0}%
        {mediaCount ? ` · 📎 ${mediaCount}` : ''}
      </Text>

      <Text style={[styles.section, isRTL && styles.rtl, { marginTop: 12 }]}>
        {t('opsv2.tech.stepsTitle' as any)}
      </Text>
      <View style={styles.steps}>
        {steps.map((st) => {
          const state = stepState(ticket, st.id);
          return (
            <View key={st.id} style={[styles.stepRow, isRTL && styles.rowRtl]}>
              <View style={[
                styles.dot,
                state === 'done' && styles.dotDone,
                state === 'current' && styles.dotCurrent,
              ]}
              />
              <Text style={[
                styles.stepLabel,
                isRTL && styles.rtl,
                state === 'done' && styles.stepDone,
                state === 'current' && styles.stepCurrent,
              ]}
              >
                {st.label}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={{ marginTop: 10 }}>
        <MaintenanceTimeline ticket={ticket} showProgress showEta={!closed} />
      </View>

      {/* Actions by status */}
      {(ticket.status === 'assigned' || ticket.status === 'open') ? (
        <Pressable
          style={styles.primary}
          testID={`tech-accept-${ticket.id}`}
          onPress={async () => {
            await onAccept();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }}
        >
          <Feather name="check-circle" size={14} color={colors.bg} />
          <Text style={styles.primaryText}>{t('opsv2.tech.step.accept' as any)}</Text>
        </Pressable>
      ) : null}

      {ticket.status === 'accepted' ? (
        <View style={[styles.row, isRTL && styles.rowRtl]}>
          {onEnRoute ? (
            <Pressable style={styles.secondary} onPress={() => onEnRoute()}>
              <Text style={styles.secondaryText}>{t('maint.enRoute' as any)}</Text>
            </Pressable>
          ) : null}
          <Pressable
            style={styles.primary}
            testID={`tech-start-${ticket.id}`}
            onPress={async () => {
              await onStart();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }}
          >
            <Text style={styles.primaryText}>{t('opsv2.tech.step.progress' as any)}</Text>
          </Pressable>
        </View>
      ) : null}

      {ticket.status === 'en_route' ? (
        <Pressable
          style={styles.primary}
          onPress={async () => {
            await onStart();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }}
        >
          <Text style={styles.primaryText}>{t('opsv2.tech.step.progress' as any)}</Text>
        </Pressable>
      ) : null}

      {ticket.status === 'in_progress' ? (
        <>
          <Text style={[styles.section, isRTL && styles.rtl, { marginTop: 12 }]}>
            {t('opsv2.tech.step.document' as any)}
          </Text>
          <View style={[styles.row, isRTL && styles.rowRtl]}>
            <Pressable style={styles.chip} onPress={() => pick('photo', 'before')} testID={`tech-photo-before-${ticket.id}`}>
              <Feather name="camera" size={14} color={colors.gold} />
              <Text style={styles.chipText}>{ar ? 'صورة قبل' : 'Photo before'}</Text>
            </Pressable>
            <Pressable style={styles.chip} onPress={() => pick('video', 'before')} testID={`tech-video-before-${ticket.id}`}>
              <Feather name="video" size={14} color={colors.gold} />
              <Text style={styles.chipText}>{ar ? 'فيديو قبل' : 'Video before'}</Text>
            </Pressable>
            <Pressable style={styles.chip} onPress={() => pick('photo', 'after')}>
              <Feather name="camera" size={14} color={colors.emerald} />
              <Text style={styles.chipText}>{ar ? 'صورة بعد' : 'Photo after'}</Text>
            </Pressable>
            <Pressable style={styles.chip} onPress={() => pick('video', 'after')}>
              <Feather name="video" size={14} color={colors.emerald} />
              <Text style={styles.chipText}>{ar ? 'فيديو بعد' : 'Video after'}</Text>
            </Pressable>
          </View>

          <Text style={[styles.section, isRTL && styles.rtl, { marginTop: 12 }]}>
            {t('opsv2.tech.step.report' as any)}
          </Text>
          <KeyboardAwareTextInput
            value={report}
            onChangeText={setReport}
            placeholder={t('opsv2.tech.reportPh' as any)}
            placeholderTextColor={colors.textSubtle}
            style={[styles.input, isRTL && styles.rtl]}
            multiline
            testID={`tech-report-${ticket.id}`}
          />
          <Pressable
            style={[styles.primary, { marginTop: 10 }]}
            testID={`tech-complete-${ticket.id}`}
            onPress={async () => {
              await onComplete(report.trim());
              setReport('');
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }}
          >
            <Feather name="flag" size={14} color={colors.bg} />
            <Text style={styles.primaryText}>{t('opsv2.tech.step.complete' as any)}</Text>
          </Pressable>
        </>
      ) : null}

      {closed ? (
        <GlassCard padding={12} radiusToken="md" style={{ marginTop: 12 }} edge="gold">
          <Text style={[styles.section, isRTL && styles.rtl]}>{t('opsv2.tech.step.report' as any)}</Text>
          <Text style={[styles.dim, isRTL && styles.rtl]}>
            {(ticket.notes && ticket.notes[ticket.notes.length - 1]) || (ar ? 'اكتملت المهمة' : 'Task completed')}
          </Text>
          {mediaCount ? (
            <Text style={[styles.dim, isRTL && styles.rtl]}>
              {ar ? `مرفقات التوثيق: ${mediaCount}` : `Proof attachments: ${mediaCount}`}
            </Text>
          ) : null}
        </GlassCard>
      ) : null}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  title: { color: colors.text, fontSize: typography.body, fontWeight: typography.weight.semibold },
  dim: { color: colors.textMuted, fontSize: typography.small, marginTop: 4, lineHeight: 18 },
  section: {
    color: colors.textMuted, fontSize: 11, letterSpacing: 0.8,
    textTransform: 'uppercase', fontWeight: typography.weight.semibold, marginBottom: 8,
  },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  steps: { gap: 6, marginBottom: 4 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowRtl: { flexDirection: 'row-reverse' },
  dot: {
    width: 10, height: 10, borderRadius: 5,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: 'transparent',
  },
  dotDone: { backgroundColor: colors.emerald, borderColor: colors.emerald },
  dotCurrent: { backgroundColor: colors.gold, borderColor: colors.gold },
  stepLabel: { color: colors.textDim, fontSize: 13, flex: 1 },
  stepDone: { color: colors.emerald },
  stepCurrent: { color: colors.gold, fontWeight: typography.weight.semibold },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  primary: {
    marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.emerald, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: 14,
  },
  primaryText: { color: colors.bg, fontWeight: typography.weight.semibold, fontSize: 13 },
  secondary: {
    paddingVertical: 10, paddingHorizontal: 12, borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  secondaryText: { color: colors.text, fontSize: 12 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 8, paddingHorizontal: 10, borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  chipText: { color: colors.textMuted, fontSize: 12 },
  input: {
    borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    padding: 10, color: colors.text, minHeight: 72, textAlignVertical: 'top', fontSize: 14,
  },
});
