import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NavIllustration } from '@/src/components/NavIllustration';
import { useWorkspace } from '@/src/context/WorkspaceContext';
import { WORKSPACE_HEADER_HEIGHT } from '@/src/data/workspace-nav';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';

export function WorkspaceCenterHeader() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, isRTL } = useI18n();
  const { isTablet, toggleSidebar, contentInsets } = useWorkspace();

  return (
    <View
      style={[
        styles.wrap,
        {
          paddingTop: insets.top,
          height: insets.top + WORKSPACE_HEADER_HEIGHT,
          paddingRight: contentInsets.right + spacing.sm,
          paddingLeft: spacing.sm,
        },
      ]}
      testID="workspace-center-header"
    >
      <BlurView intensity={Platform.OS === 'android' ? 24 : 64} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[styles.inner, isRTL && styles.rowRtl]}>
        {!isTablet ? (
          <Pressable onPress={toggleSidebar} style={styles.menuBtn} testID="ws-menu-toggle" hitSlop={8}>
            <Feather name="menu" size={18} color={colors.textDim} />
          </Pressable>
        ) : null}

        <Pressable
          testID="ws-notifications"
          onPress={() => { Haptics.selectionAsync(); router.push('/notifications'); }}
          style={[styles.chip, isRTL && styles.rowRtl]}
        >
          <NavIllustration icon="bell" tone="gold" size={32} />
          <View style={styles.chipText}>
            <Text style={[styles.chipTitle, isRTL && styles.rtl]}>{t('ws.header.notifications')}</Text>
            <Text style={[styles.chipSub, isRTL && styles.rtl]}>{t('ws.header.notificationsSub')}</Text>
          </View>
          <View style={styles.badge} />
        </Pressable>

        <Pressable
          testID="ws-ask-spp"
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/brain'); }}
          style={[styles.chip, styles.chipAsk, isRTL && styles.rowRtl]}
        >
          <NavIllustration icon="search" tone="emerald" size={32} />
          <View style={styles.chipText}>
            <Text style={[styles.chipTitle, isRTL && styles.rtl]}>{t('ws.header.ask')}</Text>
            <Text style={[styles.chipSub, isRTL && styles.rtl]} numberOfLines={1}>{t('ws.header.askSub')}</Text>
          </View>
          <Feather name={isRTL ? 'chevron-left' : 'chevron-right'} size={16} color={colors.textMuted} />
        </Pressable>

        {isTablet ? (
          <Pressable onPress={toggleSidebar} style={styles.menuBtn} testID="ws-sidebar-toggle">
            <Feather name="menu" size={18} color={colors.textDim} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    overflow: 'hidden',
  },
  inner: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: spacing.xs,
  },
  rowRtl: { flexDirection: 'row-reverse' },
  menuBtn: {
    width: 36, height: 36, borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  chip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 6, paddingHorizontal: 10, borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
    minHeight: 44,
  },
  chipAsk: { flex: 1.2, borderColor: colors.emeraldEdge, backgroundColor: colors.emeraldSoft },
  chipText: { flex: 1, minWidth: 0 },
  chipTitle: { color: colors.text, fontSize: 12.5, fontWeight: typography.weight.semibold },
  chipSub: { color: colors.textMuted, fontSize: 10, marginTop: 1 },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  badge: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: colors.gold,
    shadowColor: colors.gold, shadowOpacity: 0.8, shadowRadius: 4, shadowOffset: { width: 0, height: 0 },
  },
});
