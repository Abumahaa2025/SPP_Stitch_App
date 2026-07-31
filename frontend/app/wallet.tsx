import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { ScreenScaffold } from '@/src/components/ScreenScaffold';
import { StoryScreenHeader } from '@/src/components/StoryScreenHeader';
import { GlassCard } from '@/src/components/GlassCard';
import { colors, spacing, typography } from '@/src/theme';
import { useI18n } from '@/src/i18n';

/** Thin ops hub — Spec §5.14. Reports stay under More (single entry). */
const LINKS = [
  { key: 'payments', icon: 'dollar-sign' as const, labelKey: 'op.wallet.payments', hintKey: 'op.wallet.payments.hint', route: '/operational/payments', tone: 'emerald' as const },
  { key: 'maintenance', icon: 'tool' as const, labelKey: 'op.wallet.maintenance', hintKey: 'op.wallet.maintenance.hint', route: '/maintenance', tone: 'gold' as const },
];

export default function WalletScreen() {
  const { t, isRTL } = useI18n();
  const router = useRouter();

  return (
    <ScreenScaffold testID="wallet-screen">
      <StoryScreenHeader
        question={t('op.wallet.title')}
        hint={t('op.wallet.sub')}
        showBack
        testID="wallet-header"
      />
      <View style={styles.list}>
        {LINKS.map((link, i) => (
          <Animated.View key={link.key} entering={FadeInDown.duration(450).delay(40 + i * 40)}>
            <Pressable
              testID={`wallet-${link.key}`}
              onPress={() => { Haptics.selectionAsync(); router.push(link.route as any); }}
              style={({ pressed }) => [pressed && { opacity: 0.88 }]}
            >
              <GlassCard padding={16} radiusToken="md" edge={link.tone === 'emerald' ? 'emerald' : link.tone === 'gold' ? 'gold' : 'neutral'}>
                <View style={[styles.row, isRTL && styles.rowRtl]}>
                  <Feather name={link.icon} size={18} color={link.tone === 'emerald' ? colors.emerald : colors.gold} />
                  <View style={styles.text}>
                    <Text style={[styles.label, isRTL && styles.rtl]}>{t(link.labelKey as any)}</Text>
                    <Text style={[styles.hint, isRTL && styles.rtl]}>{t(link.hintKey as any)}</Text>
                  </View>
                  <Feather name={isRTL ? 'chevron-left' : 'chevron-right'} size={16} color={colors.textSubtle} />
                </View>
              </GlassCard>
            </Pressable>
          </Animated.View>
        ))}
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm, marginTop: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowRtl: { flexDirection: 'row-reverse' },
  text: { flex: 1, gap: 3 },
  label: { color: colors.text, fontSize: 14, fontWeight: typography.weight.semibold },
  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
});
