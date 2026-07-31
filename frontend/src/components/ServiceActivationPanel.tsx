import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { GlassCard } from '@/src/components/GlassCard';
import { useConnections, type ServiceKey } from '@/src/hooks/useConnections';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';

const SERVICES: { key: ServiceKey; route: string; titleKey: string; benefitKey: string; icon: keyof typeof Feather.glyphMap }[] = [
  { key: 'whatsapp', route: '/setup/whatsapp', titleKey: 'op.services.whatsapp.title', benefitKey: 'op.services.whatsapp.benefit', icon: 'message-circle' },
  { key: 'greenApi', route: '/setup/greenApi', titleKey: 'op.services.greenApi.title', benefitKey: 'op.services.greenApi.benefit', icon: 'radio' },
  { key: 'sheets', route: '/setup/sheets', titleKey: 'op.services.sheets.title', benefitKey: 'op.services.sheets.benefit', icon: 'database' },
  { key: 'homeAssistant', route: '/setup/homeAssistant', titleKey: 'op.services.ha.title', benefitKey: 'op.services.ha.benefit', icon: 'home' },
  { key: 'email', route: '/setup/email', titleKey: 'op.services.email.title', benefitKey: 'op.services.email.benefit', icon: 'mail' },
];

export function ServiceActivationPanel({ testID = 'service-activation' }: { testID?: string }) {
  const { t, isRTL } = useI18n();
  const router = useRouter();
  const { connections } = useConnections();

  return (
    <View testID={testID}>
      <Text style={[styles.lead, isRTL && styles.rtl]}>{t('op.services.lead')}</Text>
      {SERVICES.map((svc, i) => {
        const connected = connections[svc.key].connected;
        return (
          <Animated.View key={svc.key} entering={FadeInDown.duration(480).delay(40 + i * 50)}>
            <GlassCard padding={16} radiusToken="md" style={styles.card}>
              <View style={[styles.row, isRTL && styles.rowRtl]}>
                <View style={styles.iconWrap}>
                  <Feather name={svc.icon} size={17} color={connected ? colors.emerald : colors.textDim} />
                </View>
                <View style={styles.textCol}>
                  <Text style={[styles.name, isRTL && styles.rtl]}>{t(svc.titleKey as any)}</Text>
                  <Text style={[styles.benefit, isRTL && styles.rtl]} numberOfLines={2}>
                    {t(svc.benefitKey as any)}
                  </Text>
                </View>
                <Pressable
                  onPress={() => { Haptics.selectionAsync(); router.push(svc.route as any); }}
                  style={[styles.cta, connected && styles.ctaDone]}
                  testID={`svc-${svc.key}`}
                >
                  <Text style={[styles.ctaText, connected && styles.ctaTextDone]}>
                    {connected ? t('op.services.connected') : t('op.services.activate')}
                  </Text>
                </Pressable>
              </View>
            </GlassCard>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  lead: { color: colors.textDim, fontSize: typography.small, lineHeight: 21, marginBottom: spacing.md },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  card: { marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowRtl: { flexDirection: 'row-reverse' },
  iconWrap: {
    width: 38, height: 38, borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  textCol: { flex: 1, gap: 3 },
  name: { color: colors.text, fontSize: typography.body, fontWeight: typography.weight.semibold },
  benefit: { color: colors.textMuted, fontSize: typography.small, lineHeight: 18 },
  cta: {
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.goldEdge,
    backgroundColor: colors.goldSoft,
  },
  ctaDone: { borderColor: colors.emeraldEdge, backgroundColor: colors.emeraldSoft },
  ctaText: { color: colors.gold, fontSize: 11, fontWeight: typography.weight.semibold },
  ctaTextDone: { color: colors.emerald },
});
