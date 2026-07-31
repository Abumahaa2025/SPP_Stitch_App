import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, Linking, Switch } from 'react-native';
import { KeyboardAwareTextInput } from '@/src/components/KeyboardAwareTextInput';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ScreenScaffold } from '@/src/components/ScreenScaffold';
import { StoryScreenHeader } from '@/src/components/StoryScreenHeader';
import { GlassCard } from '@/src/components/GlassCard';
import { PortalShareCard } from '@/src/components/PortalShareCard';
import { AgentPortalShareCard } from '@/src/components/AgentPortalShareCard';
import { TechPortalShareCard } from '@/src/components/TechPortalShareCard';
import { PhaseSaveResult } from '@/src/components/PhaseSaveResult';
import { JourneyGuide } from '@/src/components/JourneyGuide';
import { OperationHint } from '@/src/components/OperationHint';
import { usePropertyOS, buildTechnicianPortal } from '@/src/hooks/usePropertyOS';
import { usePortalAccess } from '@/src/hooks/usePortalAccess';
import { useTechnicians } from '@/src/hooks/useTechnicians';
import { inAppTechRoute } from '@/src/utils/operational-flow-engine';
import { inAppAgentRoute } from '@/src/utils/portal-access-store';
import { useNotificationPrefs } from '@/src/hooks/usePreferences';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';
import { formatDate } from '@/src/utils/locale';
import type { AgentPermissions, PropertyAgentRecord } from '@/src/types/portal-access';

const DEFAULT_PERMS: AgentPermissions = {
  contracts: true, maintenance: true, tenants: true, wallet: false, settings: false,
};

export default function PortalsManagementScreen() {
  const { t, isRTL } = useI18n();
  const router = useRouter();
  const { countEnabled } = useNotificationPrefs();
  const { state, ensureTechnicianPortal } = usePropertyOS(countEnabled);
  const { agents, addAgent, getLastLogin, setAgentActive } = usePortalAccess();
  const { technicians } = useTechnicians();

  const [showAgentForm, setShowAgentForm] = useState(false);
  const [agentName, setAgentName] = useState('');
  const [agentPhone, setAgentPhone] = useState('');
  const [agentEmail, setAgentEmail] = useState('');
  const [perms, setPerms] = useState<AgentPermissions>(DEFAULT_PERMS);
  const [lastCreatedAgent, setLastCreatedAgent] = useState<PropertyAgentRecord | null>(null);

  const techUrl = state.technicianPortalToken
    ? buildTechnicianPortal(state.technicianPortalToken)
    : ensureTechnicianPortal();
  const techToken = state.technicianPortalToken || (techUrl.includes('t=') ? techUrl.split('t=')[1] : '');
  const techQr = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(techUrl)}`;

  const shareWhatsApp = (phone: string, message: string) => {
    const url = Platform.select({
      ios: `whatsapp://send?phone=${phone.replace(/\D/g, '')}&text=${encodeURIComponent(message)}`,
      default: `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`,
    });
    Linking.openURL(url!).catch(() => {});
  };

  const createAgent = async () => {
    if (!agentName.trim()) return;
    const agent = await addAgent({ name: agentName.trim(), phone: agentPhone, email: agentEmail, permissions: perms });
    setLastCreatedAgent(agent);
    setShowAgentForm(false);
    setAgentName('');
    setAgentPhone('');
    setAgentEmail('');
    setPerms(DEFAULT_PERMS);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  return (
    <ScreenScaffold testID="portals-screen">
      <StoryScreenHeader
        question={t('opsv2.portals.title' as any)}
        hint={t('opsv2.portals.sub' as any)}
        showBack
      />

      <OperationHint feature="services" />

      <JourneyGuide
        where={t('journey.portals.guide.where' as any)}
        now={t('journey.portals.guide.now' as any)}
        benefit={t('journey.portals.guide.benefit' as any)}
        next={t('journey.portals.guide.next' as any)}
        testID="portals-journey-guide"
      />

      <Text style={[styles.section, isRTL && styles.rtl]}>{t('op.owner.tenants')}</Text>
      {state.tenants.length === 0 ? (
        <Text style={styles.dim}>{t('alive.tenants.body')}</Text>
      ) : state.tenants.map((tenant, i) => {
        const unit = state.units.find((u) => u.id === tenant.unitId);
        const lastLogin = getLastLogin(tenant.id, 'tenant');
        return (
          <Animated.View key={tenant.id} entering={FadeInDown.duration(400).delay(i * 40)} style={styles.gap}>
            <PortalShareCard tenant={tenant} unitNumber={unit?.number} />
            <View style={[styles.metaRow, isRTL && styles.rowRtl]}>
              <Text style={styles.meta}>
                {t('opsv2.portals.lastLogin' as any)}: {lastLogin ? formatDate(lastLogin) : t('opsv2.portals.never' as any)}
              </Text>
              <Pressable
                style={styles.resend}
                onPress={() => shareWhatsApp(tenant.phone, tenant.whatsAppMessage)}
              >
                <Feather name="send" size={12} color={colors.emerald} />
                <Text style={styles.resendText}>{t('opsv2.portals.resend' as any)}</Text>
              </Pressable>
            </View>
          </Animated.View>
        );
      })}

      <Text style={[styles.section, isRTL && styles.rtl, { marginTop: spacing.xl }]}>
        {t('opsv2.portals.techLink' as any)}
      </Text>
      <GlassCard padding={16} radiusToken="md" edge="emerald">
        <View style={styles.qrRow}>
          <Image source={{ uri: techQr }} style={styles.qr} contentFit="contain" />
          <View style={{ flex: 1 }}>
            <Text style={styles.link} selectable numberOfLines={3}>{techUrl}</Text>
            <Text style={styles.meta}>
              {t('opsv2.portals.lastLogin' as any)}: {getLastLogin('tech', 'technician')
                ? formatDate(getLastLogin('tech', 'technician')!)
                : t('opsv2.portals.never' as any)}
            </Text>
          </View>
        </View>
        <View style={[styles.actions, isRTL && styles.rowRtl]}>
          <Pressable
            style={styles.actionBtn}
            onPress={() => router.push(inAppTechRoute(techToken) as any)}
          >
            <Text style={styles.actionText}>{t('op.tech.title')}</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={() => Linking.openURL(techUrl).catch(() => {})}>
            <Text style={[styles.actionText, { color: colors.gold }]}>{t('opsv2.portals.resend' as any)}</Text>
          </Pressable>
        </View>
      </GlassCard>

      {technicians.map((tech) => (
        <Animated.View key={tech.id} entering={FadeInDown.duration(400)}>
          <TechPortalShareCard tech={tech} />
        </Animated.View>
      ))}

      {lastCreatedAgent ? (
        <Animated.View entering={FadeInDown.duration(400)} style={styles.gap}>
          <PhaseSaveResult
            rows={[
              { label: t('opsv2.portals.agentName' as any), value: lastCreatedAgent.name },
              { label: t('opsv2.portals.agentPhone' as any), value: lastCreatedAgent.phone || '—' },
              { label: t('pos.portal.link'), value: lastCreatedAgent.portalUrl },
            ]}
            nextHint={t('opsv2.portals.sub' as any)}
            actions={[
              { label: t('result.sendLink' as any), onPress: () => shareWhatsApp(lastCreatedAgent.phone, `${t('opsv2.agent.title' as any)}: ${lastCreatedAgent.portalUrl}`), primary: true },
              { label: t('result.viewManage' as any), onPress: () => setLastCreatedAgent(null) },
              { label: t('result.addAnother' as any), onPress: () => { setLastCreatedAgent(null); setShowAgentForm(true); } },
              { label: t('result.goHome' as any), onPress: () => router.replace('/') },
            ]}
          >
            <AgentPortalShareCard agent={lastCreatedAgent} />
          </PhaseSaveResult>
        </Animated.View>
      ) : null}

      <View style={[styles.agentHeader, isRTL && styles.rowRtl]}>
        <Text style={[styles.section, isRTL && styles.rtl]}>{t('opsv2.portals.addAgent' as any)}</Text>
        <Pressable onPress={() => setShowAgentForm(!showAgentForm)}>
          <Feather name={showAgentForm ? 'minus' : 'plus'} size={18} color={colors.gold} />
        </Pressable>
      </View>

      {showAgentForm ? (
        <GlassCard padding={16} radiusToken="md" edge="gold">
          <KeyboardAwareTextInput
            value={agentName}
            onChangeText={setAgentName}
            placeholder={t('opsv2.portals.agentName' as any)}
            placeholderTextColor={colors.textSubtle}
            style={[styles.input, isRTL && styles.rtl]}
          />
          <KeyboardAwareTextInput
            value={agentPhone}
            onChangeText={setAgentPhone}
            placeholder={t('opsv2.portals.agentPhone' as any)}
            placeholderTextColor={colors.textSubtle}
            keyboardType="phone-pad"
            style={[styles.input, isRTL && styles.rtl]}
          />
          <KeyboardAwareTextInput
            value={agentEmail}
            onChangeText={setAgentEmail}
            placeholder={t('opsv2.portals.agentEmail' as any)}
            placeholderTextColor={colors.textSubtle}
            keyboardType="email-address"
            style={[styles.input, isRTL && styles.rtl]}
          />
          {(['contracts', 'maintenance', 'tenants', 'wallet', 'settings'] as const).map((p) => (
            <View key={p} style={[styles.permRow, isRTL && styles.rowRtl]}>
              <Text style={styles.permLabel}>{t(`opsv2.portals.perm.${p}` as any)}</Text>
              <Switch
                value={perms[p]}
                onValueChange={(v) => setPerms((prev) => ({ ...prev, [p]: v }))}
                trackColor={{ true: colors.emerald }}
              />
            </View>
          ))}
          <Pressable style={styles.createBtn} onPress={createAgent}>
            <Text style={styles.createBtnText}>{t('opsv2.portals.createAgent' as any)}</Text>
          </Pressable>
        </GlassCard>
      ) : null}

      {agents.map((agent) => (
        <GlassCard key={agent.id} padding={14} radiusToken="md" style={styles.gap}>
          <View style={[styles.agentRow, isRTL && styles.rowRtl]}>
            <Text style={styles.agentName}>{agent.name}</Text>
            <Text style={styles.meta}>
              {agent.linkActive ? t('opsv2.portals.active' as any) : t('opsv2.portals.inactive' as any)}
            </Text>
          </View>
          <Text style={styles.link} selectable numberOfLines={2}>{agent.portalUrl}</Text>
          <Pressable
            style={styles.actionBtn}
            onPress={() => router.push(inAppAgentRoute(agent.id, agent.portalToken) as any)}
          >
            <Text style={styles.actionText}>{t('opsv2.agent.title' as any)}</Text>
          </Pressable>
          <Pressable onPress={() => setAgentActive(agent.id, !agent.linkActive)}>
            <Text style={styles.toggle}>
              {agent.linkActive ? 'إيقاف الرابط' : 'تفعيل الرابط'}
            </Text>
          </Pressable>
        </GlassCard>
      ))}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  section: {
    color: colors.textMuted, fontSize: 10.5, letterSpacing: 2,
    textTransform: 'uppercase', marginTop: spacing.lg, marginBottom: spacing.sm,
  },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  dim: { color: colors.textDim, fontSize: 13 },
  gap: { marginBottom: spacing.md },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  rowRtl: { flexDirection: 'row-reverse' },
  meta: { color: colors.textMuted, fontSize: 11 },
  resend: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  resendText: { color: colors.emerald, fontSize: 11 },
  qrRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  qr: { width: 72, height: 72, borderRadius: radius.sm, backgroundColor: '#fff' },
  link: { color: colors.gold, fontSize: 11, lineHeight: 16 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: {
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  actionText: { color: colors.emerald, fontSize: 12, fontWeight: typography.weight.medium },
  agentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  input: {
    borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    padding: 10, color: colors.text, marginBottom: 8, fontSize: 14,
  },
  permRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  permLabel: { color: colors.text, fontSize: 13 },
  createBtn: {
    marginTop: 10, padding: 12, borderRadius: radius.md,
    backgroundColor: colors.gold, alignItems: 'center',
  },
  createBtnText: { color: colors.bg, fontWeight: typography.weight.semibold },
  agentRow: { flexDirection: 'row', justifyContent: 'space-between' },
  agentName: { color: colors.text, fontWeight: typography.weight.semibold },
  toggle: { color: colors.textMuted, fontSize: 11, marginTop: 8 },
});
