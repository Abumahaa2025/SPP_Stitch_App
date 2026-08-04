/**
 * Home data entry — Manual or Import (import CTA moved here from scattered menus).
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { GlassCard } from '@/src/components/GlassCard';
import { setPendingPropertyName } from '@/src/utils/pending-property-name';
import { usePropertyOS } from '@/src/hooks/usePropertyOS';
import { useNotificationPrefs } from '@/src/hooks/usePreferences';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = { testID?: string; defaultOpen?: boolean };

export function HomeDataEntry({ testID = 'home-data-entry', defaultOpen = true }: Props) {
  const { isRTL, lang } = useI18n();
  const ar = lang === 'ar' || !!isRTL;
  const router = useRouter();
  const { countEnabled } = useNotificationPrefs();
  const { state, saveProperty } = usePropertyOS(countEnabled);
  const [open, setOpen] = useState(defaultOpen);
  const [name, setName] = useState(state.property?.name || '');

  const toggle = () => {
    Haptics.selectionAsync();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((v) => !v);
  };

  const ensureNamedShell = async () => {
    const n = name.trim() || state.property?.name?.trim() || '';
    if (!n) return null;
    await setPendingPropertyName(n);
    if (!state.property || state.property.name !== n) {
      saveProperty({
        name: n,
        type: state.property?.type || 'residential',
        city: state.property?.city || '—',
        district: state.property?.district || '—',
        buildingCount: state.property?.buildingCount || 1,
        unitCount: state.property?.unitCount || 1,
      });
    }
    return n;
  };

  const goManual = async () => {
    const n = await ensureNamedShell();
    if (!n) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/setup/property-os?phase=property' as any);
  };

  const goImport = async () => {
    const n = await ensureNamedShell();
    if (!n) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/upload' as any);
  };

  const needName = !name.trim() && !state.property?.name;

  return (
    <View style={{ marginBottom: spacing.md }} testID={testID}>
      <Pressable onPress={toggle} style={[styles.head, ar && styles.rowRtl]} testID={`${testID}-toggle`}>
        <Feather name="database" size={16} color={colors.gold} />
        <Text style={[styles.headText, ar && styles.rtl]}>
          {ar ? 'إدخال بيانات العقار' : 'Enter property data'}
        </Text>
        <Feather name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
      </Pressable>

      {open ? (
        <GlassCard padding={16} radiusToken="md" edge="gold" style={{ marginTop: 8 }}>
          <Text style={[styles.label, ar && styles.rtl]}>{ar ? 'اسم العقار' : 'Property name'}</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={ar ? 'مثال: برج النخيل' : 'e.g. Palm Tower'}
            placeholderTextColor={colors.textSubtle}
            style={[styles.input, ar && styles.rtl]}
            testID={`${testID}-name`}
          />
          <Text style={[styles.hint, ar && styles.rtl]}>
            {ar
              ? 'اختر الطريقة — البيانات تُحفظ تحت اسم العقار وتظهر في مركز البيانات.'
              : 'Choose a method — data saves under this name and appears in Database center.'}
          </Text>
          <View style={[styles.actions, ar && styles.rowRtl]}>
            <Pressable
              style={[styles.cta, styles.ctaPrimary, needName && styles.ctaDisabled]}
              disabled={needName}
              onPress={goManual}
              testID={`${testID}-manual`}
            >
              <Feather name="edit-3" size={14} color={colors.bg} />
              <Text style={styles.ctaPrimaryText}>{ar ? 'يدوي' : 'Manual'}</Text>
            </Pressable>
            <Pressable
              style={[styles.cta, styles.ctaSecondary, needName && styles.ctaDisabled]}
              disabled={needName}
              onPress={goImport}
              testID={`${testID}-import`}
            >
              <Feather name="upload-cloud" size={14} color={colors.gold} />
              <Text style={styles.ctaSecondaryText}>{ar ? 'استيراد' : 'Import'}</Text>
            </Pressable>
          </View>
          {state.property ? (
            <Pressable style={{ marginTop: 12 }} onPress={() => router.push('/operational/base?tab=registry' as any)}>
              <Text style={[styles.link, ar && styles.rtl]}>
                {ar ? 'فتح مركز البيانات والعمليات ←' : 'Open Data & operations →'}
              </Text>
            </Pressable>
          ) : null}
        </GlassCard>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.goldEdge,
    backgroundColor: colors.goldSoft,
  },
  rowRtl: { flexDirection: 'row-reverse' },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  headText: { flex: 1, color: colors.gold, fontSize: 14, fontWeight: typography.weight.semibold },
  label: { color: colors.textMuted, fontSize: 12, marginBottom: 6 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  hint: { color: colors.textDim, fontSize: 12, marginTop: 10, lineHeight: 18 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  cta: {
    flexGrow: 1,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: radius.md,
  },
  ctaPrimary: { backgroundColor: colors.emerald },
  ctaSecondary: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.goldEdge },
  ctaDisabled: { opacity: 0.45 },
  ctaPrimaryText: { color: colors.bg, fontWeight: typography.weight.semibold, fontSize: 13 },
  ctaSecondaryText: { color: colors.gold, fontWeight: typography.weight.semibold, fontSize: 13 },
  link: { color: colors.gold, fontSize: 12, fontWeight: typography.weight.semibold },
});
