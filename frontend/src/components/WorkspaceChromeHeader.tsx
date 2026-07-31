import React from 'react';

import { View, StyleSheet, Platform, Pressable } from 'react-native';

import { BlurView } from 'expo-blur';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useRouter } from 'expo-router';

import * as Haptics from 'expo-haptics';

import { BrandAnchor } from '@/src/components/BrandAnchor';

import { AgreementPulse } from '@/src/components/AgreementPulse';

import { useAttentionPulse } from '@/src/hooks/useAttentionPulse';

import { useWorkspace } from '@/src/context/WorkspaceContext';

import { WORKSPACE_TOTAL_HEADER_HEIGHT } from '@/src/data/workspace-nav';

import { colors, spacing } from '@/src/theme';

/** Calm header — SPP brand fixed left; permanent identity pulse, clearer when attention is needed. */
export function WorkspaceChromeHeader() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { contentInsets } = useWorkspace();
  const { alert } = useAttentionPulse();

  const onBrandPress = () => {
    Haptics.selectionAsync();
    router.push(alert ? '/notifications' : '/brain');
  };

  return (
    <View
      style={[
        styles.wrap,
        {
          paddingTop: insets.top,
          height: insets.top + WORKSPACE_TOTAL_HEADER_HEIGHT,
          paddingRight: contentInsets.right + spacing.sm,
          paddingLeft: spacing.sm,
        },
      ]}
      testID="workspace-chrome-header"
    >
      <BlurView intensity={Platform.OS === 'android' ? 28 : 72} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.row}>
        <Pressable
          onPress={onBrandPress}
          style={styles.brandLeft}
          testID="header-brand-anchor"
          accessibilityRole="button"
          accessibilityState={{ selected: alert }}
          accessibilityLabel={alert ? 'SPP — إشعار يحتاج انتباهك' : 'SPP — يعمل معك'}
        >
          <AgreementPulse
            size={7}
            intensity={alert ? 'alert' : 'idle'}
            testID={alert ? 'attention-pulse' : 'identity-pulse'}
          />
          <BrandAnchor testID="ws-brand-anchor" align="start" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 35,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    overflow: 'hidden',
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: WORKSPACE_TOTAL_HEADER_HEIGHT,
  },
  brandLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
    paddingRight: spacing.sm,
  },
});
