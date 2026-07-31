import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { GlassCard } from '@/src/components/GlassCard';
import type { DirectoryAction, DirectoryGroup } from '@/src/data/home-directory';
import { openSourcePortal } from '@/src/utils/source-web';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const KIND_COLOR: Record<DirectoryAction['kind'], string> = {
  view: colors.textDim,
  add: colors.gold,
  send: colors.emerald,
  report: colors.gold,
  analyze: colors.gold,
  follow: colors.emerald,
};

type Props = {
  group: DirectoryGroup;
  testID?: string;
};

async function runAction(action: DirectoryAction, router: ReturnType<typeof useRouter>) {
  if (action.sourceApp && await openSourcePortal(action.sourceApp)) return;
  if (action.route) router.push(action.route as any);
}

export function ExpandableGroup({ group, testID }: Props) {
  const { t, isRTL } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(Boolean(group.defaultOpen));

  const toggle = () => {
    Haptics.selectionAsync();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((v) => !v);
  };

  const accentColor = group.accent === 'emerald' ? colors.emerald : colors.gold;

  return (
    <View style={styles.wrap} testID={testID}>
      <Pressable onPress={toggle} testID={`${testID}-toggle`}>
        <GlassCard padding={18} radiusToken="lg" edge={group.accent ?? 'neutral'}>
          <View style={[styles.header, isRTL && styles.rowRtl]}>
            <View style={[styles.iconWrap, { borderColor: `${accentColor}44` }]}>
              <Feather name={group.icon} size={16} color={accentColor} />
            </View>
            <View style={styles.headerText}>
              <Text style={[styles.title, isRTL && styles.rtl]}>{t(group.titleKey as 'org.group.properties')}</Text>
              <Text style={[styles.hint, isRTL && styles.rtl]} numberOfLines={open ? 2 : 1}>
                {t(group.hintKey as 'org.group.properties.hint')}
              </Text>
            </View>
            <Feather
              name={open ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={colors.textMuted}
            />
          </View>
        </GlassCard>
      </Pressable>

      {open ? (
        <View style={styles.actions}>
          {group.actions.map((action) => (
            <Pressable
              key={action.key}
              testID={`${testID}-action-${action.key}`}
              onPress={async () => {
                Haptics.selectionAsync();
                await runAction(action, router);
              }}
              style={({ pressed }) => [
                styles.actionRow, isRTL && styles.rowRtl, pressed && styles.actionPressed,
              ]}
            >
              <View style={[styles.kindBadge, { borderColor: `${KIND_COLOR[action.kind]}55` }]}>
                <Text style={[styles.kindText, { color: KIND_COLOR[action.kind] }]}>
                  {t(`org.action.${action.kind}` as 'org.action.view')}
                </Text>
              </View>
              <View style={[styles.actionMain, isRTL && styles.rowRtl]}>
                <Feather name={action.icon} size={14} color={colors.textDim} />
                <Text style={[styles.actionLabel, isRTL && styles.rtl]} numberOfLines={2}>
                  {t(action.labelKey as 'org.properties.portfolio')}
                </Text>
              </View>
              <Feather name={isRTL ? 'chevron-left' : 'chevron-right'} size={16} color={colors.textSubtle} />
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowRtl: { flexDirection: 'row-reverse' },
  iconWrap: {
    width: 36, height: 36, borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  headerText: { flex: 1, gap: 3 },
  title: {
    color: colors.text, fontSize: 15, fontWeight: typography.weight.semibold,
    letterSpacing: typography.letter.tight,
  },
  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  actions: {
    marginTop: 6,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.02)',
    overflow: 'hidden',
  },
  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 13, paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  actionPressed: { backgroundColor: 'rgba(255,255,255,0.03)' },
  kindBadge: {
    minWidth: 52, paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  kindText: { fontSize: 10, fontWeight: typography.weight.semibold, letterSpacing: 0.2 },
  actionMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  actionLabel: { flex: 1, color: colors.text, fontSize: 13, lineHeight: 18 },
});
