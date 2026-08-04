import React, { useMemo, useState } from 'react';
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
import { usePortalAccess } from '@/src/hooks/usePortalAccess';
import type { FollowUpDomain } from '@/src/types/portal-access';
import { AGENT_OWNER_PERM_KEYS } from '@/src/types/portal-access';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';

const DOMAINS: FollowUpDomain[] = [
  'contracts', 'rentals', 'electricity', 'water', 'maintenance', 'general',
];

/**
 * Agent follow-up workspace — coordination between property agent, building guard, and owner.
 * Additive screen; reuses existing GlassCard / StoryScreenHeader identity.
 */
export default function AgentFollowUpsScreen() {
  const { t, isRTL, lang } = useI18n();
  const ar = lang === 'ar' || !!isRTL;
  const params = useLocalSearchParams<{ id?: string; t?: string }>();
  const {
    agents, guards, followUps,
    createFollowUp, replyFollowUp, setFollowUpStatus,
  } = usePortalAccess();

  const agent = agents.find((a) => a.id === params.id && a.portalToken === params.t && a.linkActive);
  const pairedGuards = useMemo(
    () => guards.filter((g) => g.linkActive && (!g.pairedAgentId || g.pairedAgentId === agent?.id)),
    [guards, agent?.id],
  );

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [domain, setDomain] = useState<FollowUpDomain>('maintenance');
  const [guardId, setGuardId] = useState<string>('');
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});

  if (!agent) {
    return (
      <ScreenScaffold testID="agent-followups">
        <StoryScreenHeader question={t('opsv2.agent.followupsTitle' as any)} showBack />
        <AliveEmpty title={t('opsv2.agent.title' as any)} body={t('opsv2.agent.invalid' as any)} />
      </ScreenScaffold>
    );
  }

  const mine = followUps.filter((f) => !f.agentId || f.agentId === agent.id);
  const allowedDomains = DOMAINS.filter((d) => (
    d === 'general'
    || ((AGENT_OWNER_PERM_KEYS as readonly string[]).includes(d)
      && agent.permissions[d as keyof typeof agent.permissions])
  ));

  const submit = async () => {
    if (!title.trim() || !body.trim()) return;
    await createFollowUp({
      title: title.trim(),
      body: body.trim(),
      domain: allowedDomains.includes(domain) ? domain : 'general',
      createdBy: 'agent',
      createdByName: agent.name,
      agentId: agent.id,
      guardId: guardId || pairedGuards[0]?.id,
      status: guardId || pairedGuards[0] ? 'waiting_guard' : 'waiting_owner',
    });
    setTitle('');
    setBody('');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const sendReply = async (followUpId: string) => {
    const msg = (replyDraft[followUpId] || '').trim();
    if (!msg) return;
    await replyFollowUp(followUpId, 'agent', agent.name, msg, 'waiting_owner');
    setReplyDraft((prev) => ({ ...prev, [followUpId]: '' }));
    Haptics.selectionAsync();
  };

  return (
    <ScreenScaffold testID="agent-followups">
      <StoryScreenHeader
        question={t('opsv2.agent.followupsTitle' as any)}
        hint={t('opsv2.agent.followupsSub' as any).replace('{name}', agent.name)}
        showBack
      />
      <ActingAsBadge role="agent" displayName={agent.name} />

      <ScrollView contentContainerStyle={{ paddingBottom: spacing['2xl'], gap: spacing.md }}>
        <GlassCard padding={14} radiusToken="md" edge="gold">
          <Text style={[styles.section, isRTL && styles.rtl]}>{t('opsv2.agent.teamTitle' as any)}</Text>
          <Text style={[styles.line, isRTL && styles.rtl]}>
            {ar ? `المالك · يتابع الموافقات` : 'Owner · approvals'}
          </Text>
          <Text style={[styles.line, isRTL && styles.rtl]}>
            {ar ? `الوكيل · ${agent.name}` : `Agent · ${agent.name}`}
          </Text>
          {pairedGuards.length ? pairedGuards.map((g) => (
            <Text key={g.id} style={[styles.line, isRTL && styles.rtl]}>
              {ar ? `الحارس · ${g.name}` : `Guard · ${g.name}`}
              {g.phone ? ` · ${g.phone}` : ''}
            </Text>
          )) : (
            <Text style={[styles.hint, isRTL && styles.rtl]}>{t('opsv2.agent.noGuard' as any)}</Text>
          )}
        </GlassCard>

        <GlassCard padding={14} radiusToken="md">
          <Text style={[styles.section, isRTL && styles.rtl]}>{t('opsv2.agent.newFollowup' as any)}</Text>
          <View style={[styles.chips, isRTL && styles.rowRtl]}>
            {allowedDomains.map((d) => (
              <Pressable
                key={d}
                onPress={() => setDomain(d)}
                style={[styles.chip, domain === d && styles.chipOn]}
              >
                <Text style={[styles.chipText, domain === d && styles.chipTextOn]}>
                  {d === 'general'
                    ? (ar ? 'عام' : 'General')
                    : t(`opsv2.portals.perm.${d}` as any)}
                </Text>
              </Pressable>
            ))}
          </View>
          {pairedGuards.length > 1 ? (
            <View style={[styles.chips, isRTL && styles.rowRtl]}>
              {pairedGuards.map((g) => (
                <Pressable
                  key={g.id}
                  onPress={() => setGuardId(g.id)}
                  style={[styles.chip, guardId === g.id && styles.chipOn]}
                >
                  <Text style={[styles.chipText, guardId === g.id && styles.chipTextOn]}>{g.name}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <KeyboardAwareTextInput
            value={title}
            onChangeText={setTitle}
            placeholder={t('opsv2.agent.followupTitlePh' as any)}
            placeholderTextColor={colors.textSubtle}
            style={[styles.input, isRTL && styles.rtl]}
          />
          <KeyboardAwareTextInput
            value={body}
            onChangeText={setBody}
            placeholder={t('opsv2.agent.followupBodyPh' as any)}
            placeholderTextColor={colors.textSubtle}
            multiline
            style={[styles.input, styles.area, isRTL && styles.rtl]}
          />
          <Pressable style={styles.primary} onPress={submit} testID="agent-create-followup">
            <Feather name="send" size={14} color={colors.bg} />
            <Text style={styles.primaryText}>{t('opsv2.agent.sendFollowup' as any)}</Text>
          </Pressable>
        </GlassCard>

        <Text style={[styles.section, isRTL && styles.rtl]}>{t('opsv2.agent.openFollowups' as any)}</Text>
        {!mine.length ? (
          <Text style={[styles.hint, isRTL && styles.rtl]}>{t('opsv2.agent.emptyFollowups' as any)}</Text>
        ) : null}
        {mine.map((f) => (
          <GlassCard key={f.id} padding={14} radiusToken="md" style={{ marginBottom: spacing.sm }}>
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
                  <Pressable style={styles.secondary} onPress={() => sendReply(f.id)}>
                    <Text style={styles.secondaryText}>{t('opsv2.agent.reply' as any)}</Text>
                  </Pressable>
                  <Pressable
                    style={styles.secondary}
                    onPress={() => setFollowUpStatus(f.id, 'waiting_guard')}
                  >
                    <Text style={styles.secondaryText}>{t('opsv2.agent.askGuard' as any)}</Text>
                  </Pressable>
                  <Pressable
                    style={styles.secondary}
                    onPress={() => setFollowUpStatus(f.id, 'done')}
                  >
                    <Text style={styles.secondaryText}>{t('opsv2.agent.markDone' as any)}</Text>
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  chip: {
    paddingVertical: 6, paddingHorizontal: 10, borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  chipOn: { borderColor: colors.goldEdge, backgroundColor: colors.goldSoft },
  chipText: { color: colors.textMuted, fontSize: 11 },
  chipTextOn: { color: colors.gold, fontWeight: typography.weight.semibold },
  input: {
    borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    padding: 10, color: colors.text, marginBottom: 8, fontSize: 14,
  },
  area: { minHeight: 72, textAlignVertical: 'top' },
  primary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.gold, borderRadius: radius.md, paddingVertical: 12,
  },
  primaryText: { color: colors.bg, fontWeight: typography.weight.semibold, fontSize: 13 },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: typography.weight.semibold },
  meta: { color: colors.textMuted, fontSize: 11, marginTop: 4 },
  body: { color: colors.textDim, fontSize: 13, marginTop: 8, lineHeight: 20 },
  reply: { color: colors.emerald, fontSize: 12, marginTop: 6 },
  secondary: {
    paddingVertical: 8, paddingHorizontal: 10, borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  secondaryText: { color: colors.text, fontSize: 11 },
});
