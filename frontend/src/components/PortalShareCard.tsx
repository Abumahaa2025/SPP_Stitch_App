import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Linking } from 'react-native';

import { GlassCard } from '@/src/components/GlassCard';
import { inAppTenantRoute } from '@/src/utils/operational-flow-engine';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';
import type { TenantRecord } from '@/src/types/property-os';

type Props = {
  tenant: TenantRecord;
  unitNumber?: string;
  testID?: string;
};

/** Tenant portal link, QR, welcome message — reusable share card. */
export function PortalShareCard({ tenant, unitNumber, testID = 'portal-share' }: Props) {
  const { t, isRTL } = useI18n();
  const router = useRouter();
  const inApp = inAppTenantRoute(tenant.id, tenant.portalToken);
  const qrUri = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(tenant.portalUrl)}`;

  const shareWhatsApp = () => {
    Haptics.selectionAsync();
    const url = Platform.select({
      ios: `whatsapp://send?phone=${tenant.phone.replace(/\D/g, '')}&text=${encodeURIComponent(tenant.whatsAppMessage)}`,
      default: `https://wa.me/${tenant.phone.replace(/\D/g, '')}?text=${encodeURIComponent(tenant.whatsAppMessage)}`,
    });
    Linking.openURL(url!).catch(() => {});
  };

  return (
    <GlassCard padding={18} radiusToken="md" edge="emerald" testID={testID}>
      <Text style={[styles.title, isRTL && styles.rtl]}>{t('pos.portal.tenant.lead')}</Text>
      {unitNumber ? (
        <Text style={[styles.sub, isRTL && styles.rtl]}>
          {t('op.tenant.unit')}: {unitNumber}
        </Text>
      ) : null}
      <View style={styles.qrRow}>
        <Image source={{ uri: qrUri }} style={styles.qr} contentFit="contain" />
        <View style={styles.linkCol}>
          <Text style={[styles.label, isRTL && styles.rtl]}>{t('pos.portal.link')}</Text>
          <Text style={styles.link} selectable numberOfLines={3}>{tenant.portalUrl}</Text>
        </View>
      </View>
      <Text style={[styles.label, isRTL && styles.rtl, { marginTop: 10 }]}>{t('pos.portal.whatsapp')}</Text>
      <Text style={[styles.extra, isRTL && styles.rtl]} selectable numberOfLines={4}>{tenant.whatsAppMessage}</Text>
      <View style={[styles.actions, isRTL && styles.rowRtl]}>
        <Pressable style={styles.btn} onPress={shareWhatsApp} testID={`${testID}-whatsapp`}>
          <Feather name="message-circle" size={14} color={colors.emerald} />
          <Text style={styles.btnText}>{t('pos.portal.shareWhatsapp')}</Text>
        </Pressable>
        <Pressable
          style={styles.btn}
          onPress={() => { Haptics.selectionAsync(); router.push(inApp as any); }}
          testID={`${testID}-open`}
        >
          <Feather name="external-link" size={14} color={colors.gold} />
          <Text style={[styles.btnText, { color: colors.gold }]}>{t('op.tenant.title')}</Text>
        </Pressable>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: typography.body, fontWeight: typography.weight.semibold },
  sub: { color: colors.textMuted, fontSize: typography.small, marginTop: 4 },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  qrRow: { flexDirection: 'row', gap: 14, marginTop: 14, alignItems: 'center' },
  rowRtl: { flexDirection: 'row-reverse' },
  qr: { width: 88, height: 88, borderRadius: radius.sm, backgroundColor: '#fff' },
  linkCol: { flex: 1 },
  label: { color: colors.textMuted, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' },
  link: { color: colors.gold, fontSize: 11, marginTop: 4, lineHeight: 16 },
  extra: { color: colors.textDim, fontSize: 12, lineHeight: 18, marginTop: 4 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14, flexWrap: 'wrap' },
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  btnText: { color: colors.emerald, fontSize: 12, fontWeight: typography.weight.medium },
});
