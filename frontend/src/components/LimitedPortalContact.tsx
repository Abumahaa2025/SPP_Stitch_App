/**
 * LimitedPortalContact — contact admin + notices for agent/tech/guard portals.
 * Keeps portal apps scoped (no full SPP navigation).
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';

import { GlassCard } from '@/src/components/GlassCard';
import { KeyboardAwareTextInput } from '@/src/components/KeyboardAwareTextInput';
import { usePortalDesk } from '@/src/hooks/usePortalDesk';
import type { PortalDeskActor, PortalMediaItem } from '@/src/types/portal-desk';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';

type Props = {
  actor: Exclude<PortalDeskActor, 'owner'>;
  actorId: string;
  actorName: string;
  threadId: string;
};

export function LimitedPortalContact({ actor, actorId, actorName, threadId }: Props) {
  const { t, isRTL, lang } = useI18n();
  const ar = lang === 'ar' || !!isRTL;
  const { postMessage, threadMessages, audienceNotices } = usePortalDesk();
  const [msg, setMsg] = useState('');
  const [media, setMedia] = useState<PortalMediaItem[]>([]);
  const messages = threadMessages(threadId);
  const notices = audienceNotices(actor, actorId);

  const pick = async (kind: 'photo' | 'video') => {
    const res = await DocumentPicker.getDocumentAsync({
      type: kind === 'photo' ? ['image/*'] : ['video/*'],
      copyToCacheDirectory: true,
    });
    if (res.canceled || !res.assets?.[0]) return;
    setMedia((prev) => [...prev, { uri: res.assets![0].uri, kind, name: res.assets![0].name }].slice(0, 6));
  };

  const send = async () => {
    if (!msg.trim() && !media.length) return;
    await postMessage({
      threadId,
      from: actor,
      fromName: actorName,
      text: msg.trim() || (ar ? 'مرفق وسائط' : 'Media attachment'),
      media: media.length ? media : undefined,
    });
    setMsg('');
    setMedia([]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  return (
    <View style={{ gap: spacing.sm, marginBottom: spacing.md }}>
      <GlassCard padding={14} radiusToken="md" edge="emerald">
        <Text style={[styles.section, isRTL && styles.rtl]}>
          {t('opsv2.portalDesk.limitedTitle' as any)}
        </Text>
        <Text style={[styles.hint, isRTL && styles.rtl]}>
          {t('opsv2.portalDesk.limitedBody' as any)}
        </Text>
      </GlassCard>

      {notices.length ? (
        <GlassCard padding={14} radiusToken="md">
          <Text style={[styles.section, isRTL && styles.rtl]}>
            {t('opsv2.portalDesk.taskNotices' as any)}
          </Text>
          {notices.slice(0, 6).map((n) => (
            <Text key={n.id} style={[styles.hint, isRTL && styles.rtl]}>
              · {n.title}: {n.body}
            </Text>
          ))}
        </GlassCard>
      ) : null}

      <GlassCard padding={14} radiusToken="md">
        <Text style={[styles.section, isRTL && styles.rtl]}>
          {t('opsv2.portalDesk.contactAdmin' as any)}
        </Text>
        <KeyboardAwareTextInput
          value={msg}
          onChangeText={setMsg}
          placeholder={t('opsv2.portalDesk.messagePh' as any)}
          placeholderTextColor={colors.textSubtle}
          style={[styles.input, isRTL && styles.rtl]}
          multiline
        />
        <View style={[styles.row, isRTL && styles.rowRtl]}>
          <Pressable style={styles.chip} onPress={() => pick('photo')}>
            <Feather name="camera" size={14} color={colors.gold} />
            <Text style={styles.chipText}>{t('opsv2.portalDesk.photo' as any)}</Text>
          </Pressable>
          <Pressable style={styles.chip} onPress={() => pick('video')}>
            <Feather name="video" size={14} color={colors.gold} />
            <Text style={styles.chipText}>{t('opsv2.portalDesk.video' as any)}</Text>
          </Pressable>
          <Pressable style={styles.primary} onPress={send}>
            <Text style={styles.primaryText}>{t('opsv2.portalDesk.send' as any)}</Text>
          </Pressable>
        </View>
        {messages.slice(0, 5).map((m) => (
          <Text key={m.id} style={[styles.hint, isRTL && styles.rtl, { marginTop: 8 }]}>
            {m.fromName}: {m.text}
          </Text>
        ))}
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    color: colors.textMuted, fontSize: 11, letterSpacing: 0.8,
    textTransform: 'uppercase', fontWeight: typography.weight.semibold,
  },
  hint: { color: colors.textDim, fontSize: 12.5, lineHeight: 18, marginTop: 6 },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  input: {
    borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    padding: 10, color: colors.text, marginTop: 8, fontSize: 14,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, alignItems: 'center' },
  rowRtl: { flexDirection: 'row-reverse' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 8, paddingHorizontal: 10, borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  chipText: { color: colors.textMuted, fontSize: 12 },
  primary: {
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.md, backgroundColor: colors.emerald,
  },
  primaryText: { color: colors.bg, fontWeight: typography.weight.semibold, fontSize: 13 },
});
