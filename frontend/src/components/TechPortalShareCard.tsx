import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform, Linking } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { GlassCard } from '@/src/components/GlassCard';
import { inAppTechRouteFor } from '@/src/utils/technician-store';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';
import type { TechnicianRecord } from '@/src/types/technician';

type Props = {
  tech: TechnicianRecord;
  testID?: string;
};

/** Technician portal — link, QR, WhatsApp, allowed tasks. */
export function TechPortalShareCard({ tech, testID = 'tech-portal-share' }: Props) {
  const { t, isRTL } = useI18n();
  const router = useRouter();
  const qrUri = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(tech.portalUrl)}`;
  const msg = `${t('op.tech.title')}: ${tech.portalUrl}`;

  const shareWhatsApp = () => {
    Haptics.selectionAsync();
    const digits = tech.phone.replace(/\D/g, '');
    const url = Platform.select({
      ios: `whatsapp://send?phone=${digits}&text=${encodeURIComponent(msg)}`,
      default: digits ? `https://wa.me/${digits}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`,
    });
    Linking.openURL(url!).catch(() => {});
  };

  return (
    <GlassCard padding={18} radiusToken="md" edge="emerald" testID={testID} style={{ marginTop: spacing.md }}>
      <Text style={[styles.title, isRTL && styles.rtl]}>{t('opsv2.portals.techLink' as any)}</Text>
      <Text style={[styles.sub, isRTL && styles.rtl]}>{tech.name} · {tech.phone}</Text>
      <Text style={[styles.label, isRTL && styles.rtl, { marginTop: 10 }]}>{t('result.tech.tasks' as any)}</Text>
      <Text style={[styles.task, isRTL && styles.rtl]}>
        {t(`opsv2.maint.type.${tech.specialty}` as any)}
      </Text>
      <View style={styles.qrRow}>
        <Image source={{ uri: qrUri }} style={styles.qr} contentFit="contain" />
        <View style={styles.linkCol}>
          <Text style={[styles.label, isRTL && styles.rtl]}>{t('pos.portal.link')}</Text>
          <Text style={styles.link} selectable numberOfLines={3}>{tech.portalUrl}</Text>
        </View>
      </View>
      <View style={[styles.actions, isRTL && styles.rowRtl]}>
        <Pressable style={styles.btn} onPress={shareWhatsApp} testID={`${testID}-whatsapp`}>
          <Feather name="message-circle" size={14} color={colors.emerald} />
          <Text style={styles.btnText}>{t('result.sendLink' as any)}</Text>
        </Pressable>
        <Pressable
          style={styles.btn}
          onPress={() => { Haptics.selectionAsync(); router.push(inAppTechRouteFor(tech) as any); }}
        >
          <Feather name="external-link" size={14} color={colors.gold} />
          <Text style={[styles.btnText, { color: colors.gold }]}>{t('op.tech.title')}</Text>
        </Pressable>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: typography.body, fontWeight: typography.weight.semibold },
  sub: { color: colors.textMuted, fontSize: typography.small, marginTop: 4 },
  label: { color: colors.textMuted, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' },
  task: { color: colors.text, fontSize: 13, marginTop: 4 },
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
});
