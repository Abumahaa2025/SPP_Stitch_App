import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { ScreenScaffold } from '@/src/components/ScreenScaffold';
import { StoryScreenHeader } from '@/src/components/StoryScreenHeader';
import { GlassCard } from '@/src/components/GlassCard';
import { AliveEmpty } from '@/src/components/AliveEmpty';
import { BrainVerdict } from '@/src/components/BrainVerdict';
import { api, type KnowledgeT } from '@/src/api/client';
import { colors, spacing, typography } from '@/src/theme';
import { useI18n } from '@/src/i18n';

export default function Knowledge() {
  const { t } = useI18n();
  const [items, setItems] = useState<KnowledgeT[]>([]);
  useEffect(() => { api.knowledge().then(setItems).catch(() => {}); }, []);

  return (
    <ScreenScaffold testID="knowledge-screen">
      <StoryScreenHeader question={t('page.q.knowledge')} hint={t('knowledge.sub')} showBack testID="knowledge-header" />
      <BrainVerdict screen="knowledge" />
      {items.length === 0 ? (
        <AliveEmpty title={t('alive.knowledge.title')} body={t('alive.knowledge.body')} />
      ) : items.map((k, i) => (
        <Animated.View key={k.id} entering={FadeInDown.duration(600).delay(50 * i)}>
          <Pressable
            testID={`kn-${k.id}`}
            onPress={() => Haptics.selectionAsync()}
            style={{ marginBottom: spacing.md }}
          >
            <GlassCard padding={22} radiusToken="lg">
              <View style={styles.topRow}>
                <Text style={styles.topic}>{k.topic.toUpperCase()}</Text>
                <View style={{ flex: 1 }} />
                <View style={styles.readRow}>
                  <Feather name="clock" size={11} color={colors.textSubtle} />
                  <Text style={styles.read}>{k.reading_minutes} {t('knowledge.minRead')}</Text>
                </View>
              </View>
              <Text style={styles.title}>{k.title}</Text>
              <Text style={styles.body}>{k.body}</Text>
              <View style={styles.footer}>
                <Text style={styles.cta}>Continue reading</Text>
                <Feather name="arrow-right" size={13} color={colors.gold} />
              </View>
            </GlassCard>
          </Pressable>
        </Animated.View>
      ))}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center' },
  topic: { color: colors.textMuted, fontSize: 10, letterSpacing: 2, fontWeight: typography.weight.medium },
  readRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  read: { color: colors.textSubtle, fontSize: 11 },
  title: {
    color: colors.text, fontSize: 18, fontWeight: typography.weight.semibold,
    letterSpacing: -0.3, marginTop: 12, lineHeight: 24,
  },
  body: { color: colors.textDim, fontSize: 14, lineHeight: 21, marginTop: 10 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md },
  cta: { color: colors.gold, fontSize: 12.5, letterSpacing: 0.1, fontWeight: typography.weight.medium },
});
