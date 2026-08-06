/**
 * GuardTaskWorkflowCard — limited guard portal task desk.
 * Steps: notify → accept → notes/photo/video → hand to agent → done.
 * Additive GlassCard UI; no identity redesign.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';

import { GlassCard } from '@/src/components/GlassCard';
import { KeyboardAwareTextInput } from '@/src/components/KeyboardAwareTextInput';
import type { AgentFollowUp, FollowUpMediaItem } from '@/src/types/portal-access';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';

export type GuardWorkflowStepId =
  | 'notify'
  | 'accept'
  | 'document'
  | 'handoff'
  | 'done';

type Props = {
  followUp: AgentFollowUp;
  onAccept: () => Promise<void> | void;
  onReply: (text: string, media?: FollowUpMediaItem[], nextStatus?: 'waiting_agent' | 'waiting_guard') => Promise<void> | void;
  onHandToAgent: () => Promise<void> | void;
  onMarkDone?: () => Promise<void> | void;
};

function guardMediaCount(f: AgentFollowUp): number {
  return f.replies.reduce((n, r) => n + (r.media?.length || 0), 0);
}

function guardHasNotes(f: AgentFollowUp): boolean {
  return f.replies.some((r) => r.actor === 'guard' && r.text.trim().length > 0);
}

function stepState(
  f: AgentFollowUp,
  id: GuardWorkflowStepId,
): 'done' | 'current' | 'todo' {
  const accepted = Boolean(f.guardAcceptedAt);
  const closed = f.status === 'done';
  const handed = f.status === 'waiting_agent' || f.status === 'waiting_owner' || closed;
  const documented = guardMediaCount(f) > 0 || guardHasNotes(f);

  switch (id) {
    case 'notify':
      return 'done';
    case 'accept':
      if (closed || handed) return 'done';
      if (!accepted) return 'current';
      return 'done';
    case 'document':
      if (!accepted && !closed) return 'todo';
      if (closed || handed) return documented ? 'done' : 'done';
      if (accepted && !documented) return 'current';
      return documented ? 'done' : 'current';
    case 'handoff':
      if (!accepted && !closed) return 'todo';
      if (handed || closed) return 'done';
      return 'current';
    case 'done':
      if (closed) return 'done';
      if (handed) return 'current';
      return 'todo';
    default:
      return 'todo';
  }
}

export function GuardTaskWorkflowCard({
  followUp, onAccept, onReply, onHandToAgent, onMarkDone,
}: Props) {
  const { t, isRTL, lang } = useI18n();
  const ar = lang === 'ar' || !!isRTL;
  const [note, setNote] = useState('');
  const [pendingMedia, setPendingMedia] = useState<FollowUpMediaItem[]>([]);

  const steps = useMemo(() => ([
    { id: 'notify' as const, label: t('opsv2.guard.step.notify' as any) },
    { id: 'accept' as const, label: t('opsv2.guard.step.accept' as any) },
    { id: 'document' as const, label: t('opsv2.guard.step.document' as any) },
    { id: 'handoff' as const, label: t('opsv2.guard.step.handoff' as any) },
    { id: 'done' as const, label: t('opsv2.guard.step.done' as any) },
  ]), [t]);

  const pick = async (kind: 'photo' | 'video') => {
    const res = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      type: kind === 'photo' ? ['image/*'] : ['video/*'],
    });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    setPendingMedia((prev) => [...prev, { uri: a.uri, kind, name: a.name }].slice(0, 6));
    Haptics.selectionAsync();
  };

  const accepted = Boolean(followUp.guardAcceptedAt);
  const closed = followUp.status === 'done';
  const mediaCount = guardMediaCount(followUp) + pendingMedia.length;
  const domainLabel = followUp.domain === 'general'
    ? (ar ? 'عام' : 'General')
    : t(`opsv2.portals.perm.${followUp.domain}` as any);

  const submitNotes = async (handOff: boolean) => {
    const text = note.trim();
    if (!text && !pendingMedia.length) {
      if (handOff) await onHandToAgent();
      return;
    }
    await onReply(
      text || (ar ? 'مرفق توثيق' : 'Proof attachment'),
      pendingMedia.length ? pendingMedia : undefined,
      handOff ? 'waiting_agent' : 'waiting_guard',
    );
    setNote('');
    setPendingMedia([]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  return (
    <GlassCard
      padding={16}
      radiusToken="md"
      style={styles.card}
      edge="emerald"
      testID={`guard-task-${followUp.id}`}
    >
      <Text style={[styles.title, isRTL && styles.rtl]}>{followUp.title}</Text>
      <Text style={[styles.dim, isRTL && styles.rtl]}>
        {domainLabel}
        {' · '}
        {t(`opsv2.agent.status.${followUp.status}` as any)}
        {mediaCount ? ` · 📎 ${mediaCount}` : ''}
      </Text>
      <Text style={[styles.body, isRTL && styles.rtl]}>{followUp.body}</Text>

      <Text style={[styles.section, isRTL && styles.rtl, { marginTop: 12 }]}>
        {t('opsv2.guard.stepsTitle' as any)}
      </Text>
      <View style={styles.steps}>
        {steps.map((st) => {
          const state = stepState(followUp, st.id);
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

      {followUp.replies.slice(-4).map((r, i) => (
        <Text key={`${followUp.id}-r-${i}`} style={[styles.reply, isRTL && styles.rtl]}>
          {r.authorName}: {r.text}
          {r.media?.length
            ? ` · ${r.media.map((m) => (m.kind === 'video' ? (ar ? 'فيديو' : 'video') : (ar ? 'صورة' : 'photo'))).join(', ')}`
            : ''}
        </Text>
      ))}

      {!closed && !accepted ? (
        <Pressable
          style={styles.primary}
          testID={`guard-accept-${followUp.id}`}
          onPress={async () => {
            await onAccept();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }}
        >
          <Feather name="check-circle" size={14} color={colors.bg} />
          <Text style={styles.primaryText}>{t('opsv2.guard.step.accept' as any)}</Text>
        </Pressable>
      ) : null}

      {!closed && accepted ? (
        <>
          <Text style={[styles.section, isRTL && styles.rtl, { marginTop: 12 }]}>
            {t('opsv2.guard.step.document' as any)}
          </Text>
          <KeyboardAwareTextInput
            value={note}
            onChangeText={setNote}
            placeholder={t('opsv2.guard.notesPh' as any)}
            placeholderTextColor={colors.textSubtle}
            style={[styles.input, isRTL && styles.rtl]}
            multiline
            testID={`guard-notes-${followUp.id}`}
          />
          <View style={[styles.row, isRTL && styles.rowRtl]}>
            <Pressable
              style={styles.chip}
              onPress={() => pick('photo')}
              testID={`guard-photo-${followUp.id}`}
            >
              <Feather name="camera" size={14} color={colors.gold} />
              <Text style={styles.chipText}>{t('opsv2.guard.uploadPhoto' as any)}</Text>
            </Pressable>
            <Pressable
              style={styles.chip}
              onPress={() => pick('video')}
              testID={`guard-video-${followUp.id}`}
            >
              <Feather name="video" size={14} color={colors.gold} />
              <Text style={styles.chipText}>{t('opsv2.guard.uploadVideo' as any)}</Text>
            </Pressable>
          </View>
          {pendingMedia.length ? (
            <Text style={[styles.dim, isRTL && styles.rtl]}>
              {ar
                ? `مرفقات جاهزة: ${pendingMedia.length}`
                : `Pending attachments: ${pendingMedia.length}`}
            </Text>
          ) : null}

          <View style={[styles.row, isRTL && styles.rowRtl]}>
            <Pressable
              style={styles.secondary}
              testID={`guard-save-${followUp.id}`}
              onPress={() => submitNotes(false)}
            >
              <Feather name="save" size={12} color={colors.emerald} />
              <Text style={styles.secondaryText}>{t('opsv2.guard.saveNotes' as any)}</Text>
            </Pressable>
            <Pressable
              style={styles.primaryInline}
              testID={`guard-handoff-${followUp.id}`}
              onPress={() => submitNotes(true)}
            >
              <Feather name="send" size={12} color={colors.bg} />
              <Text style={styles.primaryText}>{t('opsv2.guard.handAgent' as any)}</Text>
            </Pressable>
          </View>
        </>
      ) : null}

      {!closed && followUp.status === 'waiting_agent' && onMarkDone ? (
        <Pressable
          style={[styles.secondary, { marginTop: 10 }]}
          onPress={async () => {
            await onMarkDone();
            Haptics.selectionAsync();
          }}
        >
          <Text style={styles.secondaryText}>{t('opsv2.guard.markDone' as any)}</Text>
        </Pressable>
      ) : null}

      {closed ? (
        <GlassCard padding={12} radiusToken="md" style={{ marginTop: 12 }} edge="gold">
          <Text style={[styles.section, isRTL && styles.rtl]}>
            {t('opsv2.guard.step.done' as any)}
          </Text>
          <Text style={[styles.dim, isRTL && styles.rtl]}>
            {ar ? 'المهمة مُسلَّمة ومغلقة' : 'Task delivered and closed'}
          </Text>
        </GlassCard>
      ) : null}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  title: { color: colors.text, fontSize: typography.body, fontWeight: typography.weight.semibold },
  dim: { color: colors.textMuted, fontSize: typography.small, marginTop: 4, lineHeight: 18 },
  body: { color: colors.textDim, fontSize: 13, marginTop: 8, lineHeight: 20 },
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
  reply: { color: colors.emerald, fontSize: 12, marginTop: 6 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  primary: {
    marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.emerald, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: 14,
  },
  primaryInline: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.emerald, borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 12,
  },
  primaryText: { color: colors.bg, fontWeight: typography.weight.semibold, fontSize: 13 },
  secondary: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
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
