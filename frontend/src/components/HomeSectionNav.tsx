import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';

type Section = {
  key: string;
  route: string;
  icon: keyof typeof Feather.glyphMap;
  titleKey: string;
};

const SECTIONS: Section[] = [
  { key: 'upload', route: '/upload', icon: 'upload-cloud', titleKey: 'sections.upload' },
  { key: 'analysis', route: '/upload', icon: 'search', titleKey: 'sections.analysis' },
  { key: 'memory', route: '/memory', icon: 'database', titleKey: 'sections.memory' },
  { key: 'intelligence', route: '/intelligence', icon: 'zap', titleKey: 'sections.intelligence' },
  { key: 'notifications', route: '/notifications', icon: 'bell', titleKey: 'sections.notifications' },
  { key: 'contracts', route: '/contracts', icon: 'file-text', titleKey: 'sections.contracts' },
  { key: 'maintenance', route: '/maintenance', icon: 'tool', titleKey: 'sections.maintenance' },
  { key: 'health', route: '/health', icon: 'heart', titleKey: 'sections.health' },
];

type Props = {
  onNavigate: (route: string) => void;
};

/** Source web capability groups — 8 clear Arabic section entry points. */
export function HomeSectionNav({ onNavigate }: Props) {
  const { t } = useI18n();

  return (
    <View style={styles.wrap} testID="home-section-nav">
      <Text style={styles.title}>{t('home.sectionNav.title')}</Text>
      <Text style={styles.sub}>{t('home.sectionNav.sub')}</Text>
      <View style={styles.grid}>
        {SECTIONS.map((s) => (
          <Pressable
            key={s.key}
            testID={`home-section-${s.key}`}
            onPress={() => { Haptics.selectionAsync(); onNavigate(s.route); }}
            style={styles.tile}
          >
            <View style={styles.iconWrap}>
              <Feather name={s.icon} size={16} color={colors.gold} />
            </View>
            <Text style={styles.tileLabel} numberOfLines={2}>{t(s.titleKey as any)}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.xl },
  title: {
    color: colors.text, fontSize: 20, fontWeight: typography.weight.semibold,
    letterSpacing: typography.letter.tight,
  },
  sub: { color: colors.textDim, fontSize: 14, lineHeight: 22, marginTop: 6, marginBottom: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    width: '48%', flexGrow: 1, minWidth: '46%',
    padding: spacing.md, borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.025)', gap: 10,
  },
  iconWrap: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.goldEdge,
    backgroundColor: colors.goldSoft, alignItems: 'center', justifyContent: 'center',
  },
  tileLabel: {
    color: colors.text, fontSize: 14, fontWeight: typography.weight.medium, lineHeight: 20,
  },
});
