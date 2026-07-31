import React from 'react';
import { Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ScreenHeader } from '@/src/components/ScreenHeader';
import { ScreenExplainer } from '@/src/components/ScreenExplainer';
import { FeatureContext } from '@/src/components/FeatureContext';
import { spacing } from '@/src/theme';

type Props = {
  icon?: string;
  title: string;
  subtitle: string;
  lead?: string;
  why: string;
  benefit: string;
  background: string;
  showBack?: boolean;
  contextOpen?: boolean;
  delay?: number;
  testID?: string;
};

/**
 * Source web PAGE_META + capFeatureContext — every major screen explains itself.
 */
export function WebPageChrome({
  icon,
  title,
  subtitle,
  lead,
  why,
  benefit,
  background,
  showBack,
  contextOpen = false,
  delay = 0,
  testID,
}: Props) {
  return (
    <Animated.View entering={FadeInDown.duration(600).delay(delay)} testID={testID}>
      {icon ? <Text style={styles.pageIcon}>{icon}</Text> : null}
      <ScreenHeader title={title} sub={subtitle} showBack={showBack} />
      {lead ? <ScreenExplainer text={lead} edge="gold" delay={delay + 40} /> : null}
      <FeatureContext
        why={why}
        benefit={benefit}
        background={background}
        delay={delay + 80}
        defaultOpen={contextOpen}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pageIcon: { fontSize: 32, marginBottom: spacing.sm },
});
