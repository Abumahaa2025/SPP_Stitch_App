/**
 * PortalInstallHint — additive banner for portal recipients (tenant/tech/agent/guard).
 * Explains how to save the portal link as a phone home-screen app.
 * Hidden when already running as an installed standalone web app.
 * Reuses GlassCard / theme tokens — no identity redesign.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { GlassCard } from '@/src/components/GlassCard';
import { colors, spacing, typography } from '@/src/theme';
import { useI18n } from '@/src/i18n';
import { storage } from '@/src/utils/storage';

const DISMISS_KEY = 'spp.portalInstallHintDismissed';

function isStandaloneDisplay(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  try {
    const mq = window.matchMedia?.('(display-mode: standalone)');
    if (mq?.matches) return true;
    // iOS Safari home-screen
    return Boolean((window.navigator as { standalone?: boolean }).standalone);
  } catch {
    return false;
  }
}

type Props = {
  role: 'tenant' | 'tech' | 'agent' | 'guard';
};

export function PortalInstallHint({ role }: Props) {
  const { t, isRTL, lang } = useI18n();
  const ar = lang === 'ar' || !!isRTL;
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (isStandaloneDisplay()) return;
      // Native Expo Go / installed app already is an app — still show brief tip on web only.
      if (Platform.OS !== 'web') {
        // On native portal deep-link, a short tip is still useful once.
        const dismissed = await storage.getItem<boolean>(DISMISS_KEY, false);
        if (alive && !dismissed) setVisible(true);
        return;
      }
      const dismissed = await storage.getItem<boolean>(DISMISS_KEY, false);
      if (alive && !dismissed) setVisible(true);
    })();
    return () => { alive = false; };
  }, []);

  const steps = useMemo(() => {
    if (Platform.OS === 'ios') {
      return ar
        ? [
          'افتح الرابط في Safari',
          'اضغط مشاركة □↑',
          'اختر «إضافة إلى الشاشة الرئيسية»',
        ]
        : [
          'Open this link in Safari',
          'Tap Share □↑',
          'Choose “Add to Home Screen”',
        ];
    }
    if (Platform.OS === 'android' || Platform.OS === 'web') {
      return ar
        ? [
          'افتح الرابط في Chrome',
          'القائمة ⋮ ← تثبيت التطبيق / إضافة إلى الشاشة الرئيسية',
          'افتح الأيقونة من الشاشة الرئيسية لاحقاً',
        ]
        : [
          'Open this link in Chrome',
          'Menu ⋮ → Install app / Add to Home screen',
          'Open the icon from your home screen anytime',
        ];
    }
    return ar
      ? ['من المتصفح: أضف إلى الشاشة الرئيسية لتثبيت البوابة كتطبيق']
      : ['In your browser: Add to Home Screen to keep this portal as an app'];
  }, [ar]);

  if (!visible) return null;

  const roleLabel = t(`opsv2.portalInstall.role.${role}` as any);

  return (
    <GlassCard padding={14} radiusToken="md" edge="emerald" style={styles.wrap} testID="portal-install-hint">
      <View style={[styles.head, isRTL && styles.rowRtl]}>
        <Feather name="smartphone" size={16} color={colors.emerald} />
        <Text style={[styles.title, isRTL && styles.rtl]}>
          {t('opsv2.portalInstall.title' as any)}
        </Text>
        <Pressable
          onPress={async () => {
            setVisible(false);
            await storage.setItem(DISMISS_KEY, true);
          }}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t('common.cancel')}
        >
          <Feather name="x" size={16} color={colors.textMuted} />
        </Pressable>
      </View>
      <Text style={[styles.body, isRTL && styles.rtl]}>
        {t('opsv2.portalInstall.body' as any).replace('{role}', roleLabel)}
      </Text>
      <Pressable onPress={() => setExpanded((v) => !v)} style={[styles.toggle, isRTL && styles.rowRtl]}>
        <Text style={styles.toggleText}>
          {expanded
            ? t('opsv2.portalInstall.hideSteps' as any)
            : t('opsv2.portalInstall.showSteps' as any)}
        </Text>
        <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={colors.gold} />
      </Pressable>
      {expanded ? (
        <View style={styles.steps}>
          {steps.map((s, i) => (
            <Text key={i} style={[styles.step, isRTL && styles.rtl]}>
              {i + 1}. {s}
            </Text>
          ))}
        </View>
      ) : null}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  rowRtl: { flexDirection: 'row-reverse' },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  title: {
    flex: 1, color: colors.emerald, fontSize: 13,
    fontWeight: typography.weight.semibold,
  },
  body: { color: colors.textDim, fontSize: 12.5, lineHeight: 19, marginBottom: 8 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  toggleText: { color: colors.gold, fontSize: 12, fontWeight: typography.weight.medium },
  steps: { gap: 4, marginTop: 4 },
  step: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
});
