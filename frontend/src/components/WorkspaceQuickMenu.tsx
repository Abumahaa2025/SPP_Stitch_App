import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Modal, ScrollView, Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';
import { useWorkspace } from '@/src/context/WorkspaceContext';

type MenuItem = {
  key: string;
  icon: keyof typeof Feather.glyphMap;
  labelKey: string;
  route?: string;
  setup?: string;
  action?: 'sidebar';
  accent?: 'gold' | 'emerald';
};

const SECTIONS: { titleKey: string; items: MenuItem[] }[] = [
  {
    titleKey: 'menu.section.nav',
    items: [
      { key: 'home', icon: 'home', labelKey: 'menu.item.home', route: '/' },
      { key: 'upload', icon: 'upload-cloud', labelKey: 'menu.item.upload', route: '/upload', accent: 'gold' },
      { key: 'brain', icon: 'cpu', labelKey: 'menu.item.brain', route: '/brain', accent: 'gold' },
      { key: 'portfolio', icon: 'layers', labelKey: 'menu.item.portfolio', route: '/portfolio' },
      { key: 'settings', icon: 'settings', labelKey: 'menu.item.settings', route: '/settings' },
    ],
  },
  {
    titleKey: 'menu.section.kowil',
    items: [
      { key: 'import', icon: 'file-plus', labelKey: 'kowil.cap.import', route: '/upload' },
      { key: 'employee', icon: 'sunrise', labelKey: 'kowil.cap.employee', route: '/brain' },
      { key: 'collection', icon: 'trending-up', labelKey: 'kowil.cap.collection', route: '/billing' },
      { key: 'maintenance', icon: 'tool', labelKey: 'kowil.cap.maintenance', route: '/maintenance' },
      { key: 'vision', icon: 'eye', labelKey: 'kowil.cap.vision', route: '/intelligence' },
      { key: 'alerts', icon: 'bell', labelKey: 'kowil.cap.alerts', route: '/notifications' },
    ],
  },
  {
    titleKey: 'menu.section.integrations',
    items: [
      { key: 'sheets', icon: 'database', labelKey: 'settings.services.sheets', setup: '/setup/sheets', accent: 'emerald' },
      { key: 'green', icon: 'message-circle', labelKey: 'settings.services.greenApi', setup: '/setup/greenApi', accent: 'emerald' },
      { key: 'ha', icon: 'home', labelKey: 'settings.services.homeAssistant', setup: '/setup/homeAssistant', accent: 'emerald' },
      { key: 'wa', icon: 'smartphone', labelKey: 'settings.services.whatsapp', setup: '/setup/whatsapp' },
    ],
  },
];

type Props = {
  visible: boolean;
  onClose: () => void;
};

/** Professional header dropdown — Kowil capabilities + integrations (additive). */
export function WorkspaceQuickMenu({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, isRTL } = useI18n();
  const { toggleSidebar } = useWorkspace();

  const onItem = (item: MenuItem) => {
    Haptics.selectionAsync();
    onClose();
    if (item.action === 'sidebar') {
      toggleSidebar();
      return;
    }
    if (item.setup) router.push(item.setup as never);
    else if (item.route) router.push(item.route as never);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <Animated.View
        entering={FadeIn.duration(200)}
        style={[
          styles.panel,
          {
            top: insets.top + 54,
            marginHorizontal: spacing.sm,
            maxHeight: '72%',
          },
        ]}
      >
        <BlurView intensity={Platform.OS === 'android' ? 32 : 80} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.panelInner}>
          <View style={[styles.panelHead, isRTL && styles.rowRtl]}>
            <Text style={[styles.panelTitle, isRTL && styles.rtl]}>{t('menu.title' as never)}</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Feather name="x" size={18} color={colors.textMuted} />
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
            {SECTIONS.map((section, si) => (
              <View key={section.titleKey} style={si > 0 ? styles.sectionGap : undefined}>
                <Text style={[styles.sectionLabel, isRTL && styles.rtl]}>{t(section.titleKey as never)}</Text>
                {section.items.map((item, ii) => (
                  <Animated.View key={item.key} entering={FadeInDown.duration(280).delay(40 + ii * 30)}>
                    <Pressable
                      testID={`menu-${item.key}`}
                      onPress={() => onItem(item)}
                      style={({ pressed }) => [styles.row, isRTL && styles.rowRtl, pressed && styles.rowPressed]}
                    >
                      <View style={[styles.iconWrap, item.accent === 'gold' && styles.iconGold, item.accent === 'emerald' && styles.iconEmerald]}>
                        <Feather name={item.icon} size={16} color={item.accent === 'gold' ? colors.gold : item.accent === 'emerald' ? colors.emerald : colors.textDim} />
                      </View>
                      <Text style={[styles.rowLabel, isRTL && styles.rtl]} numberOfLines={2}>
                        {t(item.labelKey as never)}
                      </Text>
                      <Feather name={isRTL ? 'chevron-left' : 'chevron-right'} size={14} color={colors.textSubtle} />
                    </Pressable>
                  </Animated.View>
                ))}
              </View>
            ))}
            <Pressable
              testID="menu-full-sidebar"
              onPress={() => onItem({ key: 'map', icon: 'map', labelKey: 'menu.item.fullMap', action: 'sidebar' })}
              style={[styles.fullMapBtn, isRTL && styles.rowRtl]}
            >
              <Feather name="map" size={15} color={colors.gold} />
              <Text style={[styles.fullMapText, isRTL && styles.rtl]}>{t('menu.item.fullMap' as never)}</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.goldEdge,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
  },
  panelInner: { padding: spacing.md },
  panelHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  panelTitle: { color: colors.text, fontSize: 15, fontWeight: typography.weight.semibold },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginBottom: 6,
    fontWeight: typography.weight.medium,
  },
  sectionGap: { marginTop: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 4,
    borderRadius: radius.md,
  },
  rowPressed: { backgroundColor: 'rgba(255,255,255,0.04)' },
  rowRtl: { flexDirection: 'row-reverse' },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  iconGold: { backgroundColor: colors.goldSoft, borderColor: colors.goldEdge },
  iconEmerald: { backgroundColor: colors.emeraldSoft, borderColor: colors.emeraldEdge },
  rowLabel: { flex: 1, color: colors.text, fontSize: 14, fontWeight: typography.weight.medium },
  fullMapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: spacing.md,
    paddingVertical: 12,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.goldEdge,
    backgroundColor: colors.goldSoft,
  },
  fullMapText: { color: colors.gold, fontSize: 13, fontWeight: typography.weight.semibold },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
});
