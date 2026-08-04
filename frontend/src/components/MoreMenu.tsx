import React from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { GlassCard } from '@/src/components/GlassCard';
import { SectionTitle } from '@/src/components/SectionTitle';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';
import { signOutSession } from '@/src/services/beta-auth';

type MoreItem = {
  key: string;
  labelKey: string;
  hintKey: string;
  icon: keyof typeof Feather.glyphMap;
  route: string;
  tone?: 'gold' | 'emerald';
};

/**
 * Figma UX reorg — More screen sections:
 * أدوات · الإعداد والاستيراد · الحساب · حول التطبيق
 * No routes removed; portfolio promoted into Tools; About gets its own section.
 */
const TOOL_ITEMS: MoreItem[] = [
  { key: 'reports', labelKey: 'more.reports', hintKey: 'more.reports.hint', icon: 'bar-chart-2', route: '/reports', tone: 'gold' },
  { key: 'portfolio', labelKey: 'more.portfolio', hintKey: 'more.portfolio.hint', icon: 'activity', route: '/portfolio', tone: 'gold' },
  { key: 'monthly', labelKey: 'more.monthly', hintKey: 'more.monthly.hint', icon: 'calendar', route: '/operational/monthly-summary', tone: 'gold' },
  { key: 'roles', labelKey: 'more.roles', hintKey: 'more.roles.hint', icon: 'shield', route: '/roles', tone: 'gold' },
  { key: 'help', labelKey: 'more.help', hintKey: 'more.help.hint', icon: 'help-circle', route: '/support' },
  { key: 'settings', labelKey: 'more.settings', hintKey: 'more.settings.hint', icon: 'settings', route: '/settings' },
];

/** Setup paths stay reachable — import CTA moved to Home (Manual | Import). */
const RARE_ITEMS: MoreItem[] = [
  { key: 'propertyOs', labelKey: 'more.propertyOs', hintKey: 'more.propertyOs.hint', icon: 'compass', route: '/setup/property-os', tone: 'gold' },
];

const ACCOUNT_ITEMS: MoreItem[] = [
  { key: 'profile', labelKey: 'more.profile', hintKey: 'more.profile.hint', icon: 'user', route: '/profile' },
  { key: 'billing', labelKey: 'more.billing', hintKey: 'more.billing.hint', icon: 'credit-card', route: '/billing', tone: 'gold' },
];

const ABOUT_ITEMS: MoreItem[] = [
  { key: 'about', labelKey: 'more.about', hintKey: 'more.about.hint', icon: 'info', route: '/about' },
];

function Section({ title, items, delayBase, count }: { title: string; items: MoreItem[]; delayBase: number; count?: number }) {
  const { t, isRTL } = useI18n();
  const router = useRouter();

  return (
    <View style={styles.section}>
      <SectionTitle eyebrow={title} count={count ?? items.length} />
      {items.map((item, i) => {
        const accent = item.tone === 'gold' ? colors.gold : item.tone === 'emerald' ? colors.emerald : colors.textDim;
        return (
          <Animated.View key={item.key} entering={FadeInDown.duration(480).delay(delayBase + i * 40)}>
            <Pressable
              testID={`more-${item.key}`}
              onPress={() => { Haptics.selectionAsync(); router.push(item.route as any); }}
              style={({ pressed }) => [pressed && { opacity: 0.85 }]}
            >
              <GlassCard padding={16} radiusToken="md" style={styles.rowCard}>
                <View style={[styles.row, isRTL && styles.rowRtl]}>
                  <View style={[styles.iconWrap, { borderColor: `${accent}44` }]}>
                    <Feather name={item.icon} size={18} color={accent} />
                  </View>
                  <View style={styles.rowText}>
                    <Text style={[styles.rowLabel, isRTL && styles.rtl]}>{t(item.labelKey as Parameters<typeof t>[0])}</Text>
                    <Text style={[styles.rowHint, isRTL && styles.rtl]}>
                      {t(item.hintKey as Parameters<typeof t>[0])}
                    </Text>
                  </View>
                  <Feather name={isRTL ? 'chevron-left' : 'chevron-right'} size={16} color={colors.textSubtle} style={styles.chevron} />
                </View>
              </GlassCard>
            </Pressable>
          </Animated.View>
        );
      })}
    </View>
  );
}

/** More screen — Spec: reports, connections, settings, help, about (+ kept setup tools). */
export function MoreMenu() {
  const { t, isRTL } = useI18n();
  const router = useRouter();

  const signOut = () => {
    Haptics.selectionAsync();
    Alert.alert(
      t('settings.action.signout'),
      t('settings.action.signout.hint'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.action.signout'),
          style: 'destructive',
          onPress: async () => {
            await signOutSession();
            router.replace('/beta-login' as never);
          },
        },
      ],
    );
  };

  return (
    <View testID="more-menu">
      <Section title={t('more.section.tools')} items={TOOL_ITEMS} delayBase={40} />
      <Section title={t('more.section.rare')} items={RARE_ITEMS} delayBase={220} />
      <Section title={t('more.section.account')} items={ACCOUNT_ITEMS} delayBase={320} />
      <Section title={t('more.section.about')} items={ABOUT_ITEMS} delayBase={400} />
      <Animated.View entering={FadeInDown.duration(480).delay(480)}>
        <Pressable
          testID="more-logout"
          onPress={signOut}
          style={({ pressed }) => [pressed && { opacity: 0.85 }]}
        >
          <GlassCard padding={16} radiusToken="md" style={styles.rowCard}>
            <View style={[styles.row, isRTL && styles.rowRtl]}>
              <View style={[styles.iconWrap, { borderColor: `${colors.danger}55` }]}>
                <Feather name="log-out" size={18} color={colors.danger} />
              </View>
              <View style={styles.rowText}>
                <Text style={[styles.rowLabel, styles.logoutLabel, isRTL && styles.rtl]}>{t('more.logout')}</Text>
                <Text style={[styles.rowHint, isRTL && styles.rtl]}>{t('more.logout.hint')}</Text>
              </View>
            </View>
          </GlassCard>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: spacing.lg, gap: spacing.sm },
  rowCard: { marginBottom: 0, minHeight: 72 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 },
  rowRtl: { flexDirection: 'row-reverse' },
  iconWrap: {
    width: 42, height: 42, borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  rowText: { flex: 1, gap: 4, minWidth: 0 },
  rowLabel: {
    color: colors.text, fontSize: typography.body,
    fontWeight: typography.weight.semibold, lineHeight: 22, flexShrink: 1,
  },
  rowHint: {
    color: colors.textMuted, fontSize: typography.small,
    lineHeight: 20, flexShrink: 1,
  },
  logoutLabel: { color: colors.danger },
  chevron: { flexShrink: 0 },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
});
