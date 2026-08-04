import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { ScreenScaffold } from '@/src/components/ScreenScaffold';
import { StoryScreenHeader } from '@/src/components/StoryScreenHeader';
import { GlassCard } from '@/src/components/GlassCard';
import { AliveEmpty } from '@/src/components/AliveEmpty';
import { ActingAsBadge } from '@/src/components/ActingAsBadge';
import { PortalInstallHint } from '@/src/components/PortalInstallHint';
import { usePortalAccess } from '@/src/hooks/usePortalAccess';
import { setActiveAgentSession } from '@/src/components/AgentPermissionGate';
import { inAppAgentFollowUpsRoute } from '@/src/utils/portal-access-store';
import { AGENT_OWNER_PERM_KEYS } from '@/src/types/portal-access';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';

export default function AgentPortalScreen() {
  const { t, isRTL } = useI18n();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; t?: string }>();
  const { agents, guards, followUps, logLogin } = usePortalAccess();

  const agent = agents.find((a) => a.id === params.id && a.portalToken === params.t && a.linkActive);

  useEffect(() => {
    if (agent) {
      void logLogin(agent.id, 'agent', agent.name);
      void setActiveAgentSession(agent.id);
    } else {
      void setActiveAgentSession(null);
    }
  }, [agent?.id]);

  if (!agent) {
    return (
      <ScreenScaffold testID="agent-portal">
        <StoryScreenHeader question={t('opsv2.agent.title' as any)} showBack />
        <AliveEmpty title={t('opsv2.agent.title' as any)} body={t('opsv2.agent.invalid' as any)} />
      </ScreenScaffold>
    );
  }

  const links: { key: string; route: string; perm: typeof AGENT_OWNER_PERM_KEYS[number] }[] = [
    { key: 'contracts', route: '/contracts', perm: 'contracts' },
    { key: 'rentals', route: '/tenants', perm: 'rentals' },
    { key: 'electricity', route: '/wallet', perm: 'electricity' },
    { key: 'water', route: '/wallet', perm: 'water' },
    { key: 'maintenance', route: '/maintenance', perm: 'maintenance' },
  ];

  const openFollowUps = followUps.filter(
    (f) => f.agentId === agent.id && f.status !== 'done',
  ).length;
  const pairedGuards = guards.filter((g) => !g.pairedAgentId || g.pairedAgentId === agent.id);

  return (
    <ScreenScaffold testID="agent-portal">
      <StoryScreenHeader
        question={t('opsv2.agent.welcome' as any).replace('{name}', agent.name)}
        hint={agent.email}
        showBack
      />

      <ActingAsBadge role="agent" displayName={agent.name} scope={agent.email} />
      <PortalInstallHint role="agent" />

      <GlassCard padding={16} radiusToken="md" edge="gold" style={{ marginBottom: spacing.md }}>
        <Text style={[styles.section, isRTL && styles.rtl]}>{t('opsv2.agent.permsTitle' as any)}</Text>
        <Text style={[styles.hint, isRTL && styles.rtl]}>{t('opsv2.agent.permsHint' as any)}</Text>
        {AGENT_OWNER_PERM_KEYS.map((p) => (
          <View key={p} style={[styles.permRow, isRTL && styles.rowRtl]}>
            <Text style={[styles.perm, isRTL && styles.rtl]}>
              {agent.permissions[p] ? '✓' : '✗'} {t(`opsv2.portals.perm.${p}` as any)}
            </Text>
          </View>
        ))}
      </GlassCard>

      <Pressable
        onPress={() => router.push(inAppAgentFollowUpsRoute(agent.id, agent.portalToken) as any)}
        testID="agent-open-followups"
      >
        <GlassCard padding={16} radiusToken="md" edge="emerald" style={{ marginBottom: spacing.md }}>
          <View style={[styles.row, isRTL && styles.rowRtl]}>
            <Feather name="git-pull-request" size={16} color={colors.emerald} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.linkTitle, isRTL && styles.rtl]}>
                {t('opsv2.agent.followupsTitle' as any)}
              </Text>
              <Text style={[styles.hint, isRTL && styles.rtl]}>
                {t('opsv2.agent.followupsHint' as any)
                  .replace('{n}', String(openFollowUps))
                  .replace('{g}', String(pairedGuards.length))}
              </Text>
            </View>
            <Feather name="chevron-right" size={16} color={colors.textMuted} />
          </View>
        </GlassCard>
      </Pressable>

      <View style={{ gap: spacing.sm }}>
        {links.filter((l) => agent.permissions[l.perm]).map((l) => (
          <Pressable key={l.key} onPress={() => router.push(l.route as any)}>
            <GlassCard padding={14} radiusToken="md">
              <Text style={styles.link}>{t(`opsv2.portals.perm.${l.perm}` as any)} →</Text>
            </GlassCard>
          </Pressable>
        ))}
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  section: {
    color: colors.textMuted, fontSize: 11, letterSpacing: 0.8,
    textTransform: 'uppercase', fontWeight: typography.weight.semibold,
  },
  hint: { color: colors.textDim, fontSize: 12, marginTop: 6, lineHeight: 18 },
  perm: { color: colors.text, fontSize: 14, marginTop: 8 },
  permRow: { flexDirection: 'row', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowRtl: { flexDirection: 'row-reverse' },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  link: { color: colors.gold, fontSize: 15, fontWeight: typography.weight.medium },
  linkTitle: { color: colors.text, fontSize: 15, fontWeight: typography.weight.semibold },
});
