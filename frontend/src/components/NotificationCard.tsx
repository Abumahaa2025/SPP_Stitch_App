import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { GlassCard } from '@/src/components/GlassCard';
import { ActionButton } from '@/src/components/ActionButton';
import type { FormattedNotification } from '@/src/utils/format-notification';
import { colors, spacing, typography } from '@/src/theme';
import { useI18n } from '@/src/i18n';
import { formatTime } from '@/src/utils/locale';
import { storage } from '@/src/utils/storage';

type Props = {
  formatted: FormattedNotification;
  at: string;
  priority: string;
  notifId?: string;
  testID?: string;
  onDismissed?: () => void;
};

const DISMISS_KEY = 'spp.notif.dismissed';

/** Spec §5.17 — process / defer / dismiss with source action. */
export function NotificationCard({ formatted, at, priority, notifId, testID, onDismissed }: Props) {
  const { t, isRTL } = useI18n();
  const router = useRouter();
  const accent = priority === 'critical' || priority === 'high' ? colors.gold : colors.emerald;
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const openSource = async () => {
    setStatus('loading');
    try {
      Haptics.selectionAsync();
      router.push(formatted.actionRoute as any);
      setStatus('success');
      setTimeout(() => setStatus('idle'), 1200);
    } catch {
      setStatus('error');
    }
  };

  const defer = async () => {
    Haptics.selectionAsync();
    if (!notifId) return;
    const raw = await storage.getItem<string>(DISMISS_KEY, '[]');
    let list: string[] = [];
    try { list = JSON.parse(raw || '[]'); } catch { list = []; }
    const until = Date.now() + 4 * 60 * 60 * 1000;
    list = [...list.filter((x) => !x.startsWith(`${notifId}:`)), `${notifId}:snooze:${until}`];
    await storage.setItem(DISMISS_KEY, JSON.stringify(list));
    onDismissed?.();
  };

  const dismiss = async () => {
    Haptics.selectionAsync();
    if (!notifId) {
      onDismissed?.();
      return;
    }
    const raw = await storage.getItem<string>(DISMISS_KEY, '[]');
    let list: string[] = [];
    try { list = JSON.parse(raw || '[]'); } catch { list = []; }
    list = [...list.filter((x) => !x.startsWith(`${notifId}:`)), `${notifId}:dismiss`];
    await storage.setItem(DISMISS_KEY, JSON.stringify(list));
    onDismissed?.();
  };

  return (
    <GlassCard
      padding={20}
      radiusToken="lg"
      edge={priority === 'critical' || priority === 'high' ? 'gold' : 'neutral'}
      testID={testID}
    >
      <View style={[styles.top, isRTL && styles.rtlRow]}>
        <View style={[styles.iconWrap, { borderColor: `${accent}44` }]}>
          <Feather name="bell" size={14} color={accent} />
        </View>
        <Text style={styles.time}>{formatTime(at)}</Text>
      </View>

      <Text style={[styles.headline, isRTL && styles.rtl]}>{formatted.headline}</Text>

      <Text style={[styles.recLabel, isRTL && styles.rtl]}>{t('notif.recommendedAction')}</Text>
      <Text style={[styles.recBody, isRTL && styles.rtl]}>{formatted.recommendation}</Text>

      <ActionButton
        testID={`${testID}-action`}
        label={t(formatted.actionLabelKey as 'notif.action.review')}
        loadingLabel={t('notif.action.loading' as any)}
        successLabel={t('notif.action.opened' as any)}
        errorLabel={t('notif.action.retry' as any)}
        status={status}
        onPress={openSource}
        onRetry={openSource}
        style={{ marginTop: spacing.md }}
      />

      <View style={[styles.secondary, isRTL && styles.rtlRow]}>
        <Pressable testID={`${testID}-defer`} onPress={defer} hitSlop={8}>
          <Text style={styles.secondaryText}>{t('notif.action.defer' as any)}</Text>
        </Pressable>
        <Pressable testID={`${testID}-dismiss`} onPress={dismiss} hitSlop={8}>
          <Text style={styles.secondaryText}>{t('notif.action.dismiss' as any)}</Text>
        </Pressable>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  rtlRow: { flexDirection: 'row-reverse' },
  iconWrap: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  time: { color: colors.textSubtle, fontSize: 11, fontVariant: ['tabular-nums'] },
  headline: {
    color: colors.text, fontSize: 16, lineHeight: 24,
    fontWeight: typography.weight.semibold, letterSpacing: typography.letter.tight,
  },
  recLabel: {
    color: colors.textMuted, fontSize: 10, letterSpacing: 1.2,
    textTransform: 'uppercase', fontWeight: typography.weight.medium,
    marginTop: spacing.md,
  },
  recBody: {
    color: colors.textDim, fontSize: 14, lineHeight: 21, marginTop: 6,
  },
  secondary: {
    flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md,
    paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
  },
  secondaryText: { color: colors.textMuted, fontSize: 13 },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
});
