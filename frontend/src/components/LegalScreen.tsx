import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ScreenScaffold } from '@/src/components/ScreenScaffold';
import { StoryScreenHeader } from '@/src/components/StoryScreenHeader';
import { GlassCard } from '@/src/components/GlassCard';
import { colors, spacing, typography } from '@/src/theme';
import { useI18n } from '@/src/i18n';

type Doc = { title: string; sub: string; sections: { h: string; p: string }[] };

export function LegalScreen({ doc, question, testID }: { doc: Doc; question: string; testID: string }) {
  const { t, isRTL } = useI18n();

  return (
    <ScreenScaffold testID={testID}>
      <StoryScreenHeader question={question} hint={doc.sub} showBack testID={`${testID}-header`} />
      <Animated.View entering={FadeInDown.duration(600)}>
        <GlassCard padding={22} radiusToken="lg">
          {doc.sections.map((s, i) => (
            <View key={s.h}>
              <Text style={[styles.h, isRTL && styles.rtl]}>{s.h}</Text>
              <Text style={[styles.p, isRTL && styles.rtl]}>{s.p}</Text>
              {i < doc.sections.length - 1 ? <View style={styles.divider} /> : null}
            </View>
          ))}
        </GlassCard>
      </Animated.View>
      <View style={styles.footer}>
        <View style={styles.line} />
        <Text style={styles.updated}>{t('legal.updated')}</Text>
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  h: { color: colors.text, fontSize: 15, fontWeight: typography.weight.semibold, letterSpacing: -0.2, marginTop: spacing.md },
  p: { color: colors.textDim, fontSize: 13.5, lineHeight: 22, marginTop: 8, letterSpacing: -0.05 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginTop: spacing.md },
  footer: { alignItems: 'center', marginTop: spacing.xl, gap: 10 },
  line: { width: 32, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  updated: { color: colors.textSubtle, fontSize: 10.5, letterSpacing: 1.6, textTransform: 'uppercase', fontWeight: typography.weight.medium },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
});
