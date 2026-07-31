import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Modal, ScrollView, Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { OPERATION_TOOLS } from '@/src/data/operations';
import { openSourcePortal } from '@/src/utils/source-web';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';

/** Persistent floating command bar — ask, upload, act from anywhere. */
export function QuickCommandBar() {
  const { t, isRTL } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const go = (route: string) => {
    Haptics.selectionAsync();
    setOpen(false);
    router.push(route as any);
  };

  const quickActions = [
    { key: 'ask', icon: 'message-circle' as const, label: t('cmd.bar.ask'), route: '/brain' },
    { key: 'upload', icon: 'upload-cloud' as const, label: t('cmd.bar.upload'), route: '/upload' },
    { key: 'tech', icon: 'tool' as const, label: t('cmd.bar.technician'), route: '/maintenance' },
    { key: 'report', icon: 'file-text' as const, label: t('cmd.bar.report'), route: '/reports' },
  ];

  return (
    <>
      <View style={styles.wrap} pointerEvents="box-none" testID="quick-command-bar">
        <View style={styles.shadow}>
          <BlurView intensity={Platform.OS === 'android' ? 28 : 72} tint="dark" style={styles.bar}>
            <Pressable
              testID="cmd-bar-ask"
              onPress={() => go('/brain')}
              style={styles.askPill}
            >
              <Feather name="search" size={15} color={colors.gold} />
              <Text style={[styles.askText, isRTL && styles.rtl]} numberOfLines={1}>
                {t('cmd.bar.placeholder')}
              </Text>
            </Pressable>

            <Pressable testID="cmd-bar-upload" onPress={() => go('/upload')} style={styles.iconBtn} hitSlop={6}>
              <Feather name="upload-cloud" size={18} color={colors.text} />
            </Pressable>

            <Pressable testID="cmd-bar-more" onPress={() => { Haptics.selectionAsync(); setOpen(true); }} style={styles.iconBtn} hitSlop={6}>
              <Feather name="grid" size={17} color={colors.gold} />
            </Pressable>
          </BlurView>
        </View>
      </View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Animated.View entering={FadeInDown.duration(350)}>
              <Text style={[styles.sheetTitle, isRTL && styles.rtl]}>{t('cmd.bar.title')}</Text>
              <Text style={[styles.sheetSub, isRTL && styles.rtl]}>{t('cmd.bar.sub')}</Text>

              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
                <View style={styles.quickGrid}>
                  {quickActions.map((a, i) => (
                    <Pressable
                      key={a.key}
                      testID={`cmd-action-${a.key}`}
                      onPress={() => go(a.route)}
                      style={styles.quickTile}
                    >
                      <View style={styles.quickIcon}>
                        <Feather name={a.icon} size={16} color={colors.gold} />
                      </View>
                      <Text style={[styles.quickLabel, isRTL && styles.rtl]}>{a.label}</Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={[styles.sectionLabel, isRTL && styles.rtl]}>{t('ops.title')}</Text>
                {OPERATION_TOOLS.map((op) => (
                  <Pressable
                    key={op.key}
                    testID={`cmd-op-${op.key}`}
                    onPress={async () => {
                      setOpen(false);
                      if (op.sourceApp && await openSourcePortal(op.sourceApp)) return;
                      if (op.route) go(op.route);
                    }}
                    style={styles.opRow}
                  >
                    <View style={[
                      styles.opIcon,
                      op.accent === 'gold' && { borderColor: colors.goldEdge, backgroundColor: colors.goldSoft },
                      op.accent === 'emerald' && { borderColor: colors.emeraldEdge, backgroundColor: colors.emeraldSoft },
                    ]}>
                      <Feather name={op.icon} size={14} color={op.accent === 'emerald' ? colors.emerald : colors.gold} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.opLabel, isRTL && styles.rtl]}>{t(op.labelKey as 'ops.ownerPortal')}</Text>
                      <Text style={[styles.opHint, isRTL && styles.rtl]}>{t(op.hintKey as 'ops.ownerPortal.hint')}</Text>
                    </View>
                    <Feather name={isRTL ? 'chevron-left' : 'chevron-right'} size={14} color={colors.textSubtle} />
                  </Pressable>
                ))}
              </ScrollView>

              <Pressable onPress={() => setOpen(false)} style={styles.closeBtn}>
                <Text style={styles.closeText}>{t('common.done')}</Text>
              </Pressable>
            </Animated.View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute', left: spacing.sm, right: spacing.sm,
    bottom: spacing.md + 4 + 78,
    alignItems: 'center',
  },
  shadow: {
    width: '100%', borderRadius: radius.lg, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(6,11,20,0.55)',
  },
  bar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 10, paddingVertical: 10,
  },
  askPill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 11, borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.goldEdge,
    backgroundColor: colors.goldSoft,
  },
  askText: { flex: 1, color: colors.textDim, fontSize: 14 },
  iconBtn: {
    width: 42, height: 42, borderRadius: 21,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.62)',
    justifyContent: 'flex-end', padding: spacing.md,
    paddingBottom: spacing.xl + 20,
  },
  sheet: {
    borderRadius: radius.lg, padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    backgroundColor: colors.bgElevated ?? 'rgba(10,16,28,0.98)',
    maxHeight: '78%',
  },
  sheetTitle: {
    color: colors.text, fontSize: 20, fontWeight: typography.weight.semibold,
    letterSpacing: typography.letter.tight,
  },
  sheetSub: { color: colors.textDim, fontSize: 13, marginTop: 6, marginBottom: spacing.lg },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: spacing.lg },
  quickTile: {
    width: '47%', padding: 14, borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  quickIcon: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.goldEdge,
    backgroundColor: colors.goldSoft,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  quickLabel: { color: colors.text, fontSize: 13, fontWeight: typography.weight.medium },
  sectionLabel: {
    color: colors.textMuted, fontSize: 10, letterSpacing: 2,
    textTransform: 'uppercase', fontWeight: typography.weight.medium,
    marginBottom: spacing.sm,
  },
  opRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
  },
  opIcon: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  opLabel: { color: colors.text, fontSize: 14, fontWeight: typography.weight.semibold },
  opHint: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  closeBtn: {
    marginTop: spacing.lg, paddingVertical: 14, alignItems: 'center',
    borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  closeText: { color: colors.gold, fontSize: 14, fontWeight: typography.weight.semibold },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
});
