import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ExpandableGroup } from '@/src/components/ExpandableGroup';
import { HOME_DIRECTORY } from '@/src/data/home-directory';
import { colors, spacing, typography } from '@/src/theme';
import { useI18n } from '@/src/i18n';

type Props = {
  delay?: number;
  testID?: string;
};

/** Expandable directory — every tool grouped and reachable. */
export function HomeDirectory({ delay = 120, testID = 'home-directory' }: Props) {
  const { t, isRTL } = useI18n();

  return (
    <Animated.View entering={FadeInDown.duration(600).delay(delay)} style={styles.wrap} testID={testID}>
      <Text style={[styles.title, isRTL && styles.rtl]}>{t('org.directory.title')}</Text>
      <Text style={[styles.sub, isRTL && styles.rtl]}>{t('org.directory.sub')}</Text>
      <View style={styles.list}>
        {HOME_DIRECTORY.map((group) => (
          <ExpandableGroup key={group.key} group={group} testID={`org-group-${group.key}`} />
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing['2xl'] },
  title: {
    color: colors.text, fontSize: 18, fontWeight: typography.weight.semibold,
    letterSpacing: typography.letter.tight,
  },
  sub: { color: colors.textDim, fontSize: 13, lineHeight: 20, marginTop: 6, marginBottom: spacing.md },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  list: { gap: 0 },
});
