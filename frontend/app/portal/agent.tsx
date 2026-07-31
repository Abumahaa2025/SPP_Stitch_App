import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { ScreenScaffold } from '@/src/components/ScreenScaffold';
import { StoryScreenHeader } from '@/src/components/StoryScreenHeader';
import { GlassCard } from '@/src/components/GlassCard';
import { AliveEmpty } from '@/src/components/AliveEmpty';
import { ActingAsBadge } from '@/src/components/ActingAsBadge';
import { usePortalAccess } from '@/src/hooks/usePortalAccess';
import { setActiveAgentSession } from '@/src/components/AgentPermissionGate';
import { colors, spacing, typography } from '@/src/theme';
import { useI18n } from '@/src/i18n';

export default function AgentPortalScreen() {
  const { t, isRTL } = useI18n();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; t?: string }>();
  const { agents, logLogin } = usePortalAccess();

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

  const links: { key: string; route: string; perm: keyof typeof agent.permissions }[] = [
    { key: 'contracts', route: '/contracts', perm: 'contracts' },
    { key: 'maintenance', route: '/maintenance', perm: 'maintenance' },
    { key: 'tenants', route: '/tenants', perm: 'tenants' },
  ];

  return (
    <ScreenScaffold testID="agent-portal">
      <StoryScreenHeader
        question={t('opsv2.agent.welcome' as any).replace('{name}', agent.name)}
        hint={agent.email}
        showBack
      />

      <ActingAsBadge role="agent" displayName={agent.name} scope={agent.email} />

      <GlassCard padding={16} radiusToken="md" edge="gold">
        <Text style={[styles.section, isRTL && styles.rtl]}>{t('opsv2.portals.addAgent' as any)}</Text>
        {(['contracts', 'maintenance', 'tenants', 'wallet', 'settings'] as const).map((p) => (
          <Text key={p} style={[styles.perm, isRTL && styles.rtl]}>
            {agent.permissions[p] ? '✓' : '✗'} {t(`opsv2.portals.perm.${p}` as any)}
          </Text>
        ))}
      </GlassCard>

      <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
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
  section: { color: colors.textMuted, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase' },
  perm: { color: colors.text, fontSize: 14, marginTop: 8 },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  link: { color: colors.gold, fontSize: 15, fontWeight: typography.weight.medium },
});
