import React, { useRef } from 'react';
import {
  View, StyleSheet, ViewStyle, RefreshControl, KeyboardAvoidingView, Platform,
  ScrollView, type RefreshControlProps,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedScrollHandler } from 'react-native-reanimated';
import { AmbientBackground } from './AmbientBackground';
import { colors, spacing } from '../theme';
import { useWorkspacePadding } from '../hooks/use-workspace-padding';
import { TAB_BAR_RESERVED } from '../constants/chrome';
import { KeyboardScrollProvider } from '@/src/context/KeyboardScrollContext';

const AScroll = Animated.ScrollView;

type Props = {
  children: React.ReactNode;
  testID?: string;
  scrollable?: boolean;
  contentStyle?: ViewStyle;
  showTabBar?: boolean;
  keyboardAware?: boolean;
  refreshControl?: React.ReactElement<RefreshControlProps>;
};

/** Screen shell — keeps inputs and buttons above the keyboard. */
export function ScreenScaffold({
  children, testID, scrollable = true, contentStyle, showTabBar = true,
  refreshControl, keyboardAware = true,
}: Props) {
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => { scrollY.value = e.contentOffset.y; });
  const wsPad = useWorkspacePadding();
  const keyboardScrollRef = useRef<ScrollView>(null);

  const padTop = insets.top + wsPad.paddingTop + spacing.lg;
  const padRight = wsPad.paddingRight + spacing.lg;
  const tabReserve = showTabBar ? TAB_BAR_RESERVED + insets.bottom : spacing.xl;
  const padBottom = tabReserve + spacing.lg + (keyboardAware ? spacing.xl : 0);

  const scrollContent = scrollable ? (
    <AScroll
      ref={keyboardScrollRef as never}
      onScroll={onScroll}
      scrollEventThrottle={16}
      decelerationRate="normal"
      overScrollMode="never"
      nestedScrollEnabled
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets={keyboardAware}
      refreshControl={refreshControl}
      contentContainerStyle={[{
        paddingTop: padTop,
        paddingBottom: padBottom,
        paddingLeft: spacing.lg,
        paddingRight: padRight,
        flexGrow: 1,
      }, contentStyle]}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </AScroll>
  ) : (
    <View style={[{
      flex: 1, paddingTop: padTop, paddingBottom: padBottom,
      paddingLeft: spacing.lg, paddingRight: padRight,
    }, contentStyle]}>
      {children}
    </View>
  );

  const body = keyboardAware ? (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
    >
      {scrollContent}
    </KeyboardAvoidingView>
  ) : scrollContent;

  return (
    <KeyboardScrollProvider scrollRef={keyboardScrollRef}>
      <View style={styles.root} testID={testID}>
        <StatusBar style="light" />
        <AmbientBackground scrollY={scrollY} />
        {body}
      </View>
    </KeyboardScrollProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
});
