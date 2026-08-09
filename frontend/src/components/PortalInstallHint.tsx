/**
 * PortalInstallHint — additive banner for portal recipients (tenant/tech/agent/guard).
 * Primary CTA: تنزيل / تثبيت كتطبيق على الجوال.
 * Hidden when already running as an installed standalone web app.
 * Reuses GlassCard / theme tokens — no identity redesign.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { GlassCard } from '@/src/components/GlassCard';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';
import { storage } from '@/src/utils/storage';
import {
  ensurePortalInstallListener,
  hasNativeInstallPrompt,
  portalInstallSteps,
  promptPortalInstall,
  type PortalInstallRole,
} from '@/src/utils/portal-install';

const DISMISS_KEY = 'spp.portalInstallHintDismissed';

function isStandaloneDisplay(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  try {
    const mq = window.matchMedia?.('(display-mode: standalone)');
    if (mq?.matches) return true;
    return Boolean((window.navigator as { standalone?: boolean }).standalone);
  } catch {
    return false;
  }
}

type Props = {
  role: PortalInstallRole;
};

export function PortalInstallHint({ role }: Props) {
  const { t, isRTL, lang } = useI18n();
  const ar = lang === 'ar' || !!isRTL;
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [canPrompt, setCanPrompt] = useState(false);
  const [installedNote, setInstalledNote] = useState('');

  useEffect(() => {
    ensurePortalInstallListener();
    const tick = () => setCanPrompt(hasNativeInstallPrompt());
    tick();
    const id = setInterval(tick, 1200);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (isStandaloneDisplay()) return;
      const dismissed = await storage.getItem<boolean>(DISMISS_KEY, false);
      if (alive && !dismissed) setVisible(true);
    })();
    return () => { alive = false; };
  }, []);

  const steps = useMemo(() => portalInstallSteps(ar), [ar]);

  if (!visible) return null;

  const roleLabel = t(`opsv2.portalInstall.role.${role}` as any);

  const onDownload = async () => {
    Haptics.selectionAsync();
    const prompted = await promptPortalInstall();
    if (prompted) {
      setInstalledNote(ar ? 'تم فتح نافذة التثبيت — أكمل على جوالك.' : 'Install dialog opened — finish on your phone.');
      setCanPrompt(false);
      return;
    }
    setExpanded(true);
    setInstalledNote(
      ar
        ? 'اتبع الخطوات أدناه لتنزيل الرابط كتطبيق على الشاشة الرئيسية.'
        : 'Follow the steps below to save this link as a home-screen app.',
    );
  };

  return (
    <GlassCard padding={14} radiusToken="md" edge="emerald" style={styles.wrap} testID="portal-install-hint">
      <View style={[styles.head, isRTL && styles.rowRtl]}>
        <Feather name="download" size={16} color={colors.emerald} />
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

      <Pressable
        style={[styles.downloadBtn, isRTL && styles.rowRtl]}
        onPress={onDownload}
        testID="portal-install-download"
      >
        <Feather name="smartphone" size={15} color={colors.bg} />
        <Text style={styles.downloadText}>
          {canPrompt
            ? t('opsv2.portalInstall.installNow' as any)
            : t('opsv2.portalInstall.downloadBtn' as any)}
        </Text>
      </Pressable>

      {installedNote ? (
        <Text style={[styles.note, isRTL && styles.rtl]}>{installedNote}</Text>
      ) : null}

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
  body: { color: colors.textDim, fontSize: 12.5, lineHeight: 19, marginBottom: 10 },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.emerald,
    borderRadius: radius.md,
    paddingVertical: 11,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  downloadText: {
    color: colors.bg,
    fontSize: 13,
    fontWeight: typography.weight.semibold,
  },
  note: { color: colors.gold, fontSize: 12, lineHeight: 18, marginBottom: 6 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  toggleText: { color: colors.gold, fontSize: 12, fontWeight: typography.weight.medium },
  steps: { gap: 4, marginTop: 4 },
  step: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
});
