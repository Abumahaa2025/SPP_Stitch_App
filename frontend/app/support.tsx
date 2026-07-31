import React from 'react';
import { View, StyleSheet, Text, Linking } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { ScreenScaffold } from '@/src/components/ScreenScaffold';
import { StoryScreenHeader } from '@/src/components/StoryScreenHeader';
import { GlassCard } from '@/src/components/GlassCard';
import { ListRow } from '@/src/components/ListRow';
import { SectionTitle } from '@/src/components/SectionTitle';
import { colors, spacing, typography, cardPadding } from '@/src/theme';
import { useI18n } from '@/src/i18n';

export default function Support() {
  const { t, isRTL } = useI18n();

  const channels = [
    { key: 'whatsapp', icon: 'message-circle' as const, labelKey: 'support.channel.whatsapp', hintKey: 'support.channel.whatsappHint', href: 'https://wa.me/971000000000', accent: 'emerald' as const },
    { key: 'email', icon: 'mail' as const, labelKey: 'support.channel.email', hintKey: 'support.channel.emailHint', href: 'mailto:support@spp.ai', accent: 'gold' as const },
    { key: 'phone', icon: 'phone' as const, labelKey: 'support.channel.phone', hintKey: 'support.channel.phoneHint', href: 'tel:+971000000000', accent: 'neutral' as const },
  ];

  const faqs = [
    { q: t('support.faq1.q'), a: t('support.faq1.a') },
    { q: t('support.faq2.q'), a: t('support.faq2.a') },
    { q: t('support.faq3.q'), a: t('support.faq3.a') },
  ];

  return (
    <ScreenScaffold testID="support-screen">
      <StoryScreenHeader question={t('page.q.support')} hint={t('support.sub')} showBack testID="support-header" />

      {channels.map((c, i) => (
        <Animated.View key={c.key} entering={FadeInDown.duration(600).delay(60 * i)}>
          <ListRow
            testID={`support-${c.icon}`}
            icon={c.icon}
            title={t(c.labelKey as 'support.channel.whatsapp')}
            subtitle={t(c.hintKey as 'support.channel.whatsappHint')}
            accent={c.accent}
            trailing="external"
            onPress={() => {
              Haptics.selectionAsync();
              Linking.openURL(c.href).catch(() => {});
            }}
          />
        </Animated.View>
      ))}

      <View style={{ marginTop: spacing.xl }}>
        <SectionTitle eyebrow={t('support.faqTitle')} testID="support-faq-title" />
        {faqs.map((f, i) => (
          <Animated.View
            key={f.q}
            entering={FadeInDown.duration(600).delay(200 + 60 * i)}
            style={{ marginTop: spacing.sm }}
          >
            <GlassCard padding={cardPadding.compact} radiusToken="lg">
              <Text style={[styles.q, isRTL && styles.rtl]}>{f.q}</Text>
              <Text style={[styles.a, isRTL && styles.rtl]}>{f.a}</Text>
            </GlassCard>
          </Animated.View>
        ))}
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  q: { color: colors.text, fontSize: 14, fontWeight: typography.weight.semibold, letterSpacing: -0.1 },
  a: { color: colors.textDim, fontSize: 13, lineHeight: 20, marginTop: 8 },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
});
