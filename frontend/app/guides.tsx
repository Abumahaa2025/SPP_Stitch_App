import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { ScreenScaffold } from '@/src/components/ScreenScaffold';
import { StoryScreenHeader } from '@/src/components/StoryScreenHeader';
import { GlassCard } from '@/src/components/GlassCard';
import { AliveEmpty } from '@/src/components/AliveEmpty';
import { LEARN_TOPICS } from '@/src/data/learn-topics';
import { openSourcePortal } from '@/src/utils/source-web';
import { api, type GuideT } from '@/src/api/client';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';

export default function Guides() {
  const { t, isRTL } = useI18n();
  const router = useRouter();
  const [items, setItems] = useState<GuideT[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  React.useEffect(() => { api.guides().then(setItems).catch(() => {}); }, []);

  const openTopic = async (key: string, route: string, sourceApp?: typeof LEARN_TOPICS[0]['sourceApp']) => {
    Haptics.selectionAsync();
    if (sourceApp && await openSourcePortal(sourceApp)) return;
    router.push(route as any);
  };

  return (
    <ScreenScaffold testID="guides-screen">
      <StoryScreenHeader question={t('learn.title')} hint={t('guides.sub')} showBack testID="guides-header" />

      {LEARN_TOPICS.map((topic, i) => {
        const open = expanded === topic.key;
        return (
          <Animated.View key={topic.key} entering={FadeInDown.duration(500).delay(40 * i)} style={{ marginBottom: spacing.sm }}>
            <Pressable onPress={() => setExpanded(open ? null : topic.key)} testID={`learn-topic-${topic.key}`}>
              <GlassCard padding={18} radiusToken="md" edge={open ? 'gold' : 'neutral'}>
                <View style={[styles.topicHead, isRTL && styles.rowRtl]}>
                  <Feather name={topic.icon} size={16} color={colors.gold} />
                  <Text style={[styles.topicTitle, isRTL && styles.rtl]}>
                    {t(`learn.topic.${topic.key}` as 'learn.topic.start')}
                  </Text>
                  <Feather name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
                </View>
                {open ? (
                  <View style={styles.topicBody}>
                    <Text style={[styles.blockLabel, isRTL && styles.rtl]}>{t('learn.what')}</Text>
                    <Text style={[styles.blockText, isRTL && styles.rtl]}>
                      {t(`learn.${topic.key}.what` as 'learn.start.what')}
                    </Text>
                    <Text style={[styles.blockLabel, isRTL && styles.rtl]}>{t('learn.why')}</Text>
                    <Text style={[styles.blockText, isRTL && styles.rtl]}>
                      {t(`learn.${topic.key}.why` as 'learn.start.why')}
                    </Text>
                    <Text style={[styles.blockLabel, isRTL && styles.rtl]}>{t('learn.steps')}</Text>
                    <Text style={[styles.blockText, isRTL && styles.rtl]}>
                      {t(`learn.${topic.key}.steps` as 'learn.start.steps')}
                    </Text>
                    <View style={styles.videoPlaceholder}>
                      <Feather name="play-circle" size={20} color={colors.gold} />
                      <Text style={styles.videoText}>{t('learn.videoPlaceholder')}</Text>
                    </View>
                    <Text style={[styles.blockLabel, isRTL && styles.rtl]}>{t('learn.tips')}</Text>
                    <Text style={[styles.blockText, isRTL && styles.rtl]}>
                      {t(`learn.${topic.key}.tips` as 'learn.start.tips')}
                    </Text>
                    <Text style={[styles.blockLabel, isRTL && styles.rtl]}>{t('learn.faq')}</Text>
                    <Text style={[styles.blockText, isRTL && styles.rtl]}>
                      {t(`learn.${topic.key}.faq` as 'learn.start.faq')}
                    </Text>
                    <Pressable style={styles.openBtn} onPress={() => openTopic(topic.key, topic.route, topic.sourceApp)}>
                      <Text style={styles.openBtnText}>{t('learn.openFeature')}</Text>
                      <Feather name="arrow-up-right" size={14} color={colors.gold} />
                    </Pressable>
                  </View>
                ) : null}
              </GlassCard>
            </Pressable>
          </Animated.View>
        );
      })}

      <Text style={[styles.sectionTitle, isRTL && styles.rtl, { marginTop: spacing.lg }]}>{t('learn.videos')}</Text>
      {items.length === 0 ? (
        <AliveEmpty title={t('alive.guides.title')} body={t('alive.guides.body')} />
      ) : items.map((g, i) => (
        <Animated.View key={g.id} entering={FadeInDown.duration(600).delay(60 * i)}>
          <Pressable testID={`guide-${g.id}`} onPress={() => Haptics.selectionAsync()} style={{ marginBottom: spacing.md }}>
            <GlassCard padding={0} radiusToken="lg">
              <View style={styles.card}>
                <Image source={{ uri: g.poster }} style={styles.poster} contentFit="cover" transition={340} />
                <View style={styles.playWrap}>
                  <View style={styles.playChip}><Feather name="play" size={22} color={colors.bg} /></View>
                </View>
                <View style={styles.body}>
                  <Text style={[styles.title, isRTL && styles.rtl]}>{g.title}</Text>
                  <Text style={styles.meta}>{g.chapters} {t('guides.chapters')} · {g.duration}</Text>
                </View>
              </View>
            </GlassCard>
          </Pressable>
        </Animated.View>
      ))}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  lead: { color: colors.textDim, fontSize: 14, lineHeight: 22, marginBottom: spacing.lg },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  rowRtl: { flexDirection: 'row-reverse' },
  topicHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  topicTitle: { flex: 1, color: colors.text, fontSize: 14, fontWeight: typography.weight.semibold },
  topicBody: { marginTop: spacing.md, gap: 6 },
  blockLabel: { color: colors.gold, fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase', marginTop: 8 },
  blockText: { color: colors.textDim, fontSize: 13, lineHeight: 20 },
  videoPlaceholder: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10,
    padding: 14, borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.goldEdge,
    backgroundColor: colors.goldSoft,
  },
  videoText: { color: colors.gold, fontSize: 12 },
  openBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  openBtnText: { color: colors.gold, fontSize: 13, fontWeight: typography.weight.medium },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: typography.weight.semibold, marginBottom: spacing.md },
  card: { borderRadius: radius.lg, overflow: 'hidden' },
  poster: { width: '100%', height: 160 },
  playWrap: { position: 'absolute', top: 160 / 2 - 26, left: 0, right: 0, alignItems: 'center' },
  playChip: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  body: { padding: 16 },
  title: { color: colors.text, fontSize: 15, fontWeight: typography.weight.semibold },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: 6 },
});
