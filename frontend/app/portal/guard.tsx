import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { KeyboardAwareTextInput } from '@/src/components/KeyboardAwareTextInput';
import { useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';

import { ScreenScaffold } from '@/src/components/ScreenScaffold';
import { StoryScreenHeader } from '@/src/components/StoryScreenHeader';
import { GlassCard } from '@/src/components/GlassCard';
import { AliveEmpty } from '@/src/components/AliveEmpty';
import { ActingAsBadge } from '@/src/components/ActingAsBadge';
import { PortalInstallHint } from '@/src/components/PortalInstallHint';
import { LimitedPortalContact } from '@/src/components/LimitedPortalContact';
import { usePortalAccess } from '@/src/hooks/usePortalAccess';
import { guardThreadId } from '@/src/types/portal-desk';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';

/**
 * Guard portal — replies to agent/owner follow-ups tagged to this guard.
 * Additive; reuses GlassCard / StoryScreenHeader identity.
 */
export default function GuardPortalScreen() {
  const { t, isRTL, lang } = useI18n();
  const ar = lang === 'ar' || !!isRTL;
  const params = useLocalSearchParams<{ id?: string; t?: string }>();
  const { guards, followUps, agents, replyFollowUp, setFollowUpStatus, logLogin } = usePortalAccess();
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});

  const guard = guards.find((g) => g.id === params.id && g.portalToken === params.t && g.linkActive);

  useEffect(() => {
    if (guard) void logLogin(guard.id, 'guard', guard.name);
  }, [guard?.id]);

  if (!guard) {
    return (
      <ScreenScaffold testID="guard-portal">
        <StoryScreenHeader question={t('opsv2.guard.title' as any)} showBack />
        <AliveEmpty title={t('opsv2.guard.title' as any)} body={t('opsv2.guard.invalid' as any)} />
      </ScreenScaffold>
    );
  }

  const mine = followUps.filter(
    (f) => f.guardId === guard.id || (!f.guardId && f.status === 'waiting_guard'),
  );
  const pairedAgent = agents.find((a) => a.id === guard.pairedAgentId);

  const sendReply = async (followUpId: string) => {
    const msg = (replyDraft[followUpId] || '').trim();
    if (!msg) return;
    await replyFollowUp(followUpId, 'guard', guard.name, msg, 'waiting_agent');
    setReplyDraft((prev) => ({ ...prev, [followUpId]: '' }));
    Haptics.selectionAsync();
  };

  return (
    <ScreenScaffold testID="guard-portal">
      <StoryScreenHeader
        question={t('opsv2.guard.welcome' as any).replace('{name}', guard.name)}
        hint={t('opsv2.guard.sub' as any)}
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

      <ScrollView contentContainerStyle={{ paddingBottom: spacing['2xl'], gap: spacing.md }}>
        <GlassCard padding={14} radiusToken="md" edge="emerald">
          <Text style={[styles.section, isRTL && styles.rtl]}>{t('opsv2.agent.teamTitle' as any)}</Text>
          <Text style={[styles.line, isRTL && styles.rtl]}>
            {ar ? 'المالك · يتابع الموافقات' : 'Owner · approvals'}
          </Text>
          {pairedAgent ? (
            <Text style={[styles.line, isRTL && styles.rtl]}>
              {ar ? `الوكيل · ${pairedAgent.name}` : `Agent · ${pairedAgent.name}`}
            </Text>
          ) : (
            <Text style={[styles.line, isRTL && styles.rtl]}>
              {ar ? 'الوكيل · مرتبط بالعقار' : 'Agent · property-linked'}
            </Text>
          )}
          <Text style={[styles.line, isRTL && styles.rtl]}>
            {ar ? `الحارس · ${guard.name}` : `Guard · ${guard.name}`}
          </Text>
        </GlassCard>

        <Text style={[styles.section, isRTL && styles.rtl]}>{t('opsv2.guard.openFollowups' as any)}</Text>
        {!mine.length ? (
          <Text style={[styles.hint, isRTL && styles.rtl]}>{t('opsv2.agent.emptyFollowups' as any)}</Text>
        ) : null}
        {mine.map((f) => (
          <GlassCard key={f.id} padding={14} radiusToken="md">
            <Text style={[styles.cardTitle, isRTL && styles.rtl]}>{f.title}</Text>
            <Text style={[styles.meta, isRTL && styles.rtl]}>
              {f.domain === 'general'
                ? (ar ? 'عام' : 'General')
                : t(`opsv2.portals.perm.${f.domain}` as any)}
              {' · '}
              {t(`opsv2.agent.status.${f.status}` as any)}
            </Text>
            <Text style={[styles.body, isRTL && styles.rtl]}>{f.body}</Text>
            {f.replies.slice(-3).map((r, i) => (
              <Text key={`${f.id}-${i}`} style={[styles.reply, isRTL && styles.rtl]}>
                {r.authorName}: {r.text}
              </Text>
            ))}
            {f.status !== 'done' ? (
              <>
                <KeyboardAwareTextInput
                  value={replyDraft[f.id] || ''}
                  onChangeText={(v) => setReplyDraft((prev) => ({ ...prev, [f.id]: v }))}
                  placeholder={t('opsv2.agent.replyPh' as any)}
                  placeholderTextColor={colors.textSubtle}
                  style={[styles.input, isRTL && styles.rtl]}
                />
                <View style={[styles.row, isRTL && styles.rowRtl]}>
                  <Pressable style={styles.secondary} onPress={() => sendReply(f.id)} testID={`guard-reply-${f.id}`}>
                    <Feather name="send" size={12} color={colors.emerald} />
                    <Text style={styles.secondaryText}>{t('opsv2.agent.reply' as any)}</Text>
                  </Pressable>
                  <Pressable
                    style={styles.secondary}
                    onPress={() => setFollowUpStatus(f.id, 'waiting_agent')}
                  >
                    <Text style={styles.secondaryText}>{t('opsv2.guard.handAgent' as any)}</Text>
                  </Pressable>
                </View>
              </>
            ) : null}
          </GlassCard>
        ))}
      </ScrollView>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  section: {
    color: colors.textMuted, fontSize: 11, letterSpacing: 0.8,
    textTransform: 'uppercase', fontWeight: typography.weight.semibold, marginBottom: 8,
  },
  line: { color: colors.text, fontSize: 13, marginTop: 6 },
  hint: { color: colors.textDim, fontSize: 12, lineHeight: 18 },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  rowRtl: { flexDirection: 'row-reverse' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  input: {
    borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    padding: 10, color: colors.text, marginTop: 8, fontSize: 14,
  },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: typography.weight.semibold },
  meta: { color: colors.textMuted, fontSize: 11, marginTop: 4 },
  body: { color: colors.textDim, fontSize: 13, marginTop: 8, lineHeight: 20 },
  reply: { color: colors.emerald, fontSize: 12, marginTop: 6 },
  secondary: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 8, paddingHorizontal: 10, borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  secondaryText: { color: colors.text, fontSize: 11 },
});
