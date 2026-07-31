import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, LayoutAnimation, Platform, UIManager,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { NavIllustration } from '@/src/components/NavIllustration';
import { SmartEmployeeMark } from '@/src/components/SmartEmployeeMark';
import {
  WORKSPACE_NAV, WORKSPACE_SIDEBAR_WIDTH, type WorkspaceNavGroup, type WorkspaceNavItem,
} from '@/src/data/workspace-nav';
import { useWorkspace } from '@/src/context/WorkspaceContext';
import { openSourcePortal } from '@/src/utils/source-web';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function NavItemRow({
  item, groupKey, active, isRTL, onSelect,
}: {
  item: WorkspaceNavItem;
  groupKey: string;
  active: boolean;
  isRTL: boolean;
  onSelect: (item: WorkspaceNavItem) => void;
}) {
  const { t } = useI18n();
  return (
    <Pressable
      testID={`ws-item-${groupKey}-${item.key}`}
      onPress={() => onSelect(item)}
      style={[styles.itemRow, isRTL && styles.rowRtl, active && styles.itemActive]}
    >
      <NavIllustration icon={item.icon} tone={item.tone ?? 'neutral'} size={30} />
      <View style={styles.itemText}>
        <Text style={[styles.itemLabel, isRTL && styles.rtl, active && styles.itemLabelActive]} numberOfLines={1}>
          {t(item.labelKey as 'ws.manager.ask')}
        </Text>
        <Text style={[styles.itemDesc, isRTL && styles.rtl]} numberOfLines={2}>
          {t(item.descKey as 'ws.manager.ask.desc')}
        </Text>
      </View>
      {active ? <View style={styles.activeDot} /> : null}
    </Pressable>
  );
}

function NavGroup({
  group, pathname, onSelect, onStandalone, isRTL,
}: {
  group: WorkspaceNavGroup;
  pathname: string;
  onSelect: (item: WorkspaceNavItem) => void;
  onStandalone: (route: string) => void;
  isRTL: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(Boolean(group.defaultOpen));
  const isHome = group.standalone;
  const isFeatured = group.featured;
  const isActive = isHome
    ? pathname === '/'
    : group.items.some((item) => item.route === pathname || (item.route === '/' && pathname === '/'));

  if (isHome) {
    return (
      <Pressable
        testID="ws-home"
        onPress={() => group.standaloneRoute && onStandalone(group.standaloneRoute)}
        style={[styles.homeRow, isRTL && styles.rowRtl, pathname === '/' && styles.homeActive]}
      >
        <NavIllustration emoji={group.emoji} icon={group.icon} tone="gold" size={36} />
        <Text style={[styles.homeLabel, isRTL && styles.rtl]}>{t('ws.group.dashboard')}</Text>
      </Pressable>
    );
  }

  const toggle = () => {
    Haptics.selectionAsync();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((v) => !v);
  };

  return (
    <View style={[styles.group, isFeatured && styles.groupFeatured]} testID={`ws-group-${group.key}`}>
      <Pressable onPress={toggle} style={[styles.groupHead, isRTL && styles.rowRtl, isFeatured && styles.groupHeadFeatured]}>
        {isFeatured ? (
          <SmartEmployeeMark size={40} />
        ) : (
          <NavIllustration emoji={group.emoji} icon={group.icon} tone={group.tone ?? 'neutral'} size={36} />
        )}
        <View style={styles.groupText}>
          <Text style={[styles.groupTitle, isRTL && styles.rtl, isFeatured && styles.groupTitleFeatured]} numberOfLines={2}>
            {t(group.labelKey as 'ws.group.manager')}
          </Text>
          {group.hintKey ? (
            <Text style={[styles.groupHint, isRTL && styles.rtl]} numberOfLines={2}>
              {t(group.hintKey as 'ws.group.manager.hint')}
            </Text>
          ) : null}
        </View>
        <Feather name={open ? 'chevron-up' : 'chevron-down'} size={16} color={isFeatured ? colors.gold : colors.textMuted} />
      </Pressable>
      {open ? (
        <Animated.View entering={FadeInDown.duration(280)} style={styles.items}>
          {group.items.map((item) => {
            const active = item.route === pathname
              || (item.route === '/' && pathname === '/' && item.key === 'brief');
            return (
              <NavItemRow
                key={item.key}
                item={item}
                groupKey={group.key}
                active={active}
                isRTL={isRTL}
                onSelect={onSelect}
              />
            );
          })}
        </Animated.View>
      ) : null}
      {isActive && !open ? <View style={[styles.groupActiveBar, isFeatured && styles.groupActiveBarFeatured]} /> : null}
    </View>
  );
}

export function WorkspaceSidebar() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname() || '/';
  const { t, isRTL } = useI18n();
  const { isTablet, sidebarOpen, setSidebarOpen, requestHomeAnchor, setNavigateItem } = useWorkspace();

  const handleSelect = useCallback(async (item: WorkspaceNavItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!isTablet) setSidebarOpen(false);
    if (item.sourceApp && await openSourcePortal(item.sourceApp)) return;
    if (item.homeAnchor) requestHomeAnchor(item.homeAnchor);
    if (item.route) router.push(item.route as any);
  }, [isTablet, setSidebarOpen, requestHomeAnchor, router]);

  const handleStandalone = useCallback((route: string) => {
    Haptics.selectionAsync();
    if (!isTablet) setSidebarOpen(false);
    router.push(route as any);
  }, [isTablet, setSidebarOpen, router]);

  useEffect(() => {
    setNavigateItem(handleSelect);
  }, [handleSelect, setNavigateItem]);

  if (!isTablet && !sidebarOpen) return null;

  const panel = (
    <BlurView intensity={Platform.OS === 'android' ? 28 : 72} tint="dark" style={styles.blur}>
      <View style={[styles.mapHead, { paddingTop: insets.top + spacing.md }, isRTL && styles.rowRtl]}>
        <View style={styles.mapText}>
          <Text style={[styles.mapTitle, isRTL && styles.rtl]}>{t('ws.mapTitle')}</Text>
          <Text style={[styles.mapSub, isRTL && styles.rtl]}>{t('ws.mapSub')}</Text>
        </View>
        {!isTablet ? (
          <Pressable onPress={() => setSidebarOpen(false)} hitSlop={8} testID="ws-sidebar-close">
            <Feather name="x" size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xl }]}
      >
        {WORKSPACE_NAV.map((group) => (
          <NavGroup
            key={group.key}
            group={group}
            pathname={pathname}
            onSelect={handleSelect}
            onStandalone={handleStandalone}
            isRTL={isRTL}
          />
        ))}
      </ScrollView>
    </BlurView>
  );

  if (!isTablet) {
    return (
      <View style={styles.overlay} pointerEvents="box-none">
        <Pressable style={styles.backdrop} onPress={() => setSidebarOpen(false)} />
        <View style={styles.drawer}>{panel}</View>
      </View>
    );
  }

  return (
    <View style={[styles.docked, { width: WORKSPACE_SIDEBAR_WIDTH }]}>
      {panel}
    </View>
  );
}

const styles = StyleSheet.create({
  docked: {
    position: 'absolute', top: 0, bottom: 0, right: 0, zIndex: 40,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.border,
    backgroundColor: 'rgba(6,11,20,0.94)',
  },
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 50, flexDirection: 'row' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.48)' },
  drawer: {
    width: WORKSPACE_SIDEBAR_WIDTH,
    backgroundColor: 'rgba(6,11,20,0.98)',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.border,
  },
  blur: { flex: 1 },
  mapHead: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: spacing.md, paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  mapText: { flex: 1, gap: 2 },
  mapTitle: { color: colors.text, fontSize: 14, fontWeight: typography.weight.semibold },
  mapSub: { color: colors.textMuted, fontSize: 11, lineHeight: 15 },
  rowRtl: { flexDirection: 'row-reverse' },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  scroll: { paddingHorizontal: spacing.sm, paddingTop: spacing.sm },
  homeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 10, marginBottom: 8,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.025)',
  },
  homeActive: { borderColor: colors.goldEdge, backgroundColor: colors.goldSoft },
  homeLabel: { flex: 1, color: colors.text, fontSize: 14.5, fontWeight: typography.weight.semibold },
  group: { marginBottom: 8 },
  groupFeatured: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.goldEdge,
    backgroundColor: 'rgba(212,175,95,0.04)',
    paddingBottom: 4,
  },
  groupHead: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 11, paddingHorizontal: 10, borderRadius: 10,
  },
  groupHeadFeatured: { paddingTop: 14 },
  groupText: { flex: 1, gap: 2 },
  groupTitle: { color: colors.text, fontSize: 13.5, fontWeight: typography.weight.semibold, lineHeight: 18 },
  groupTitleFeatured: { color: colors.gold, fontSize: 14 },
  groupHint: { color: colors.textMuted, fontSize: 10.5, lineHeight: 14 },
  items: { marginHorizontal: 6, paddingBottom: 6, gap: 2 },
  itemRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 10, borderRadius: 10,
  },
  itemActive: { backgroundColor: 'rgba(212,175,95,0.1)' },
  itemText: { flex: 1, gap: 2 },
  itemLabel: { color: colors.text, fontSize: 13, fontWeight: typography.weight.medium, lineHeight: 17 },
  itemLabelActive: { color: colors.gold },
  itemDesc: { color: colors.textMuted, fontSize: 11, lineHeight: 15 },
  activeDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.gold },
  groupActiveBar: {
    height: 2, marginHorizontal: 14, marginTop: 2, marginBottom: 4,
    backgroundColor: colors.gold, opacity: 0.45, borderRadius: 1,
  },
  groupActiveBarFeatured: { opacity: 0.75 },
});
