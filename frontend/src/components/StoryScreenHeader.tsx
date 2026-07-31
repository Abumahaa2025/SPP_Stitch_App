import React from 'react';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ScreenHeader } from '@/src/components/ScreenHeader';

type Props = {
  question: string;
  hint?: string;
  showBack?: boolean;
  delay?: number;
  testID?: string;
};

/** One question per screen — no technical chrome. */
export function StoryScreenHeader({ question, hint, showBack, delay = 0, testID }: Props) {
  return (
    <Animated.View entering={FadeInDown.duration(500).delay(delay)} testID={testID}>
      <ScreenHeader title={question} sub={hint} showBack={showBack} />
    </Animated.View>
  );
}
