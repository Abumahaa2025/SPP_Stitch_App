import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform, Linking } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { GlassCard } from '@/src/components/GlassCard';
import { inAppAgentRoute } from '@/src/utils/portal-access-store';
import { buildAgentPortalLink } from '@/src/utils/portal-links';
import { sharePortalInstallLink } from '@/src/utils/portal-install';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';
import type { PropertyAgentRecord } from '@/src/types/portal-access';
import { AGENT_OWNER_PERM_KEYS } from '@/src/types/portal-access';

type Props = {
  agent: PropertyAgentRecord;
  testID?: string;
};

/** Agent portal — link, QR, permissions, WhatsApp. */
export function AgentPortalShareCard({ agent, testID = 'agent-portal-share' }: Props) {
  const { t, isRTL, lang } = useI18n();
  const ar = lang === 'ar' || !!isRTL;
  const router = useRouter();
  const live = buildAgentPortalLink(agent.id, agent.portalToken, { name: agent.name });
  const shareUrl = live.url;
  const qrUri = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(shareUrl)}`;
  const installTip = t('opsv2.portalInstall.shareTip' as any);
  const msg = `${t('opsv2.agent.title' as any)} — ${ar ? 'تنزيل كتطبيق' : 'install as app'}:\n${shareUrl}\n\n${installTip}`;
  const permKeys = AGENT_OWNER_PERM_KEYS.filter((p) => agent.permissions[p]);

  const shareWhatsApp = () => {
    Haptics.selectionAsync();
    const digits = agent.phone.replace(/\D/g, '');
    const url = Platform.select({
      ios: `whatsapp://send?phone=${digits}&text=${encodeURIComponent(msg)}`,
      default: digits ? `https://wa.me/${digits}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`,
    });
    Linking.openURL(url!).catch(() => {});
  };

  const shareInstall = () => {
    Haptics.selectionAsync();
    sharePortalInstallLink({
      url: shareUrl,
      roleLabel: t('opsv2.portalInstall.role.agent' as any),
      ar,
      tip: installTip,
    });
  };

  return (
    <GlassCard padding={18} radiusToken="md" edge="gold" testID={testID} style={{ marginTop: spacing.md }}>
      <Text style={[styles.title, isRTL && styles.rtl]}>{agent.name}</Text>
      <Text style={[styles.created, isRTL && styles.rtl]}>{t('result.agent.created' as any)}</Text>
      {permKeys.map((p) => (
        <Text key={p} style={[styles.perm, isRTL && styles.rtl]}>✓ {t(`opsv2.portals.perm.${p}` as any)}</Text>
      ))}
      <View style={styles.qrRow}>
        <Image source={{ uri: qrUri }} style={styles.qr} contentFit="contain" />
        <View style={styles.linkCol}>
          <Text style={[styles.label, isRTL && styles.rtl]}>{t('pos.portal.link')}</Text>
          <Text style={styles.link} selectable numberOfLines={3}>{shareUrl}</Text>
        </View>
      </View>
      <Text style={[styles.created, isRTL && styles.rtl]}>
        {t('opsv2.portalInstall.ownerHint' as any)}
      </Text>
      <View style={[styles.actions, isRTL && styles.rowRtl]}>
        <Pressable style={styles.btnPrimary} onPress={shareInstall} testID={`${testID}-install`}>
          <Feather name="download" size={14} color={colors.bg} />
          <Text style={styles.btnPrimaryText}>{t('opsv2.portalInstall.downloadBtn' as any)}</Text>
        </Pressable>
        <Pressable style={styles.btn} onPress={shareWhatsApp} testID={`${testID}-whatsapp`}>
          <Feather name="message-circle" size={14} color={colors.emerald} />
          <Text style={styles.btnText}>{t('result.sendLink' as any)}</Text>
        </Pressable>
        <Pressable
          style={styles.btn}
          onPress={() => { Haptics.selectionAsync(); router.push(inAppAgentRoute(agent.id, agent.portalToken) as any); }}
        >
          <Feather name="external-link" size={14} color={colors.gold} />
          <Text style={[styles.btnText, { color: colors.gold }]}>{t('opsv2.agent.title' as any)}</Text>
        </Pressable>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: typography.body, fontWeight: typography.weight.semibold },
  created: { color: colors.textDim, fontSize: 13, marginTop: 6, lineHeight: 20 },
  perm: { color: colors.emerald, fontSize: 13, marginTop: 4 },
  label: { color: colors.textMuted, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  qrRow: { flexDirection: 'row', gap: 14, marginTop: 14, alignItems: 'center' },
  rowRtl: { flexDirection: 'row-reverse' },
  qr: { width: 88, height: 88, borderRadius: radius.sm, backgroundColor: '#fff' },
  linkCol: { flex: 1 },
  link: { color: colors.gold, fontSize: 11, marginTop: 4, lineHeight: 16 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14, flexWrap: 'wrap' },
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  btnText: { color: colors.emerald, fontSize: 12, fontWeight: typography.weight.medium },
  btnPrimary: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.md,
    backgroundColor: colors.emerald,
  },
  btnPrimaryText: { color: colors.bg, fontSize: 12, fontWeight: typography.weight.semibold },
});
