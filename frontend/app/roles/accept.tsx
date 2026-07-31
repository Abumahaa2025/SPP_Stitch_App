/**
 * Stitch: قبول التخويل — accept a role invite token.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { ScreenScaffold } from '@/src/components/ScreenScaffold';
import { StoryScreenHeader } from '@/src/components/StoryScreenHeader';
import { GlassCard } from '@/src/components/GlassCard';
import { KeyboardAwareTextInput } from '@/src/components/KeyboardAwareTextInput';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';
import { storage } from '@/src/utils/storage';
import { useRoles, type RoleKey } from '@/src/hooks/useRoles';

type Invite = {
  token: string;
  memberId: string;
  name: string;
  email: string;
  role: RoleKey;
  createdAt: string;
  status: 'pending' | 'accepted' | 'declined';
};

export default function RoleAcceptScreen() {
  const { t, isRTL } = useI18n();
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string }>();
  const { updateMember } = useRoles();
  const [token, setToken] = useState(String(params.token || ''));
  const [invite, setInvite] = useState<Invite | null>(null);

  const load = useCallback(async () => {
    const raw = await storage.getItem<string>('spp.roleInvites', '[]');
    let list: Invite[] = [];
    try { list = JSON.parse(raw || '[]'); } catch { list = []; }
    const found = list.find((x) => x.token === token.trim());
    setInvite(found || null);
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      if (token.trim()) void load();
    }, [load, token]),
  );

  const decide = async (status: 'accepted' | 'declined') => {
    if (!invite) return;
    const raw = await storage.getItem<string>('spp.roleInvites', '[]');
    let list: Invite[] = [];
    try { list = JSON.parse(raw || '[]'); } catch { list = []; }
    list = list.map((x) => (x.token === invite.token ? { ...x, status } : x));
    await storage.setItem('spp.roleInvites', JSON.stringify(list));
    if (status === 'accepted') {
      updateMember(invite.memberId, { active: true });
      await storage.setItem('spp.actingRole', invite.role);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(t('roles.accept.done' as any), t('roles.accept.doneBody' as any).replace('{role}', t(`roles.role.${invite.role}` as 'roles.role.owner')));
      router.replace('/' as any);
    } else {
      Haptics.selectionAsync();
      Alert.alert(t('roles.accept.declined' as any));
      router.back();
    }
  };

  return (
    <ScreenScaffold testID="roles-accept">
      <StoryScreenHeader
        question={t('roles.accept.title' as any)}
        hint={t('roles.accept.hint' as any)}
        showBack
      />

      <GlassCard padding={18} radiusToken="lg" edge="gold">
        <KeyboardAwareTextInput
          testID="roles-accept-token"
          value={token}
          onChangeText={setToken}
          placeholder={t('roles.accept.token' as any)}
          placeholderTextColor={colors.textSubtle}
          autoCapitalize="none"
          style={[styles.input, isRTL && styles.rtl]}
        />
        <Pressable
          testID="roles-accept-lookup"
          style={styles.lookup}
          onPress={() => { Haptics.selectionAsync(); void load(); }}
        >
          <Text style={styles.lookupText}>{t('roles.accept.lookup' as any)}</Text>
        </Pressable>
      </GlassCard>

      {invite ? (
        <GlassCard padding={18} radiusToken="lg" style={{ marginTop: spacing.md }} edge="emerald">
          <Text style={[styles.name, isRTL && styles.rtl]}>{invite.name}</Text>
          <Text style={[styles.dim, isRTL && styles.rtl]}>
            {invite.email} · {t(`roles.role.${invite.role}` as 'roles.role.owner')}
          </Text>
          <Text style={[styles.dim, isRTL && styles.rtl, { marginTop: 8 }]}>
            {t(`roles.accept.status.${invite.status}` as any)}
          </Text>
          {invite.status === 'pending' ? (
            <View style={[styles.row, isRTL && styles.rowRtl]}>
              <Pressable testID="roles-accept-yes" style={[styles.btn, styles.ok]} onPress={() => decide('accepted')}>
                <Text style={styles.okText}>{t('roles.accept.yes' as any)}</Text>
              </Pressable>
              <Pressable testID="roles-accept-no" style={[styles.btn, styles.no]} onPress={() => decide('declined')}>
                <Text style={styles.noText}>{t('roles.accept.no' as any)}</Text>
              </Pressable>
            </View>
          ) : null}
        </GlassCard>
      ) : token.trim() ? (
        <Text style={[styles.dim, isRTL && styles.rtl, { marginTop: spacing.lg }]}>
          {t('roles.accept.notFound' as any)}
        </Text>
      ) : null}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  lookup: {
    marginTop: 12,
    backgroundColor: colors.emerald,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  lookupText: { color: colors.bg, fontWeight: typography.weight.semibold },
  name: { color: colors.text, fontSize: 18, fontWeight: typography.weight.semibold },
  dim: { color: colors.textDim, fontSize: 13 },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  row: { flexDirection: 'row', gap: 10, marginTop: 16 },
  rowRtl: { flexDirection: 'row-reverse' },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  ok: { backgroundColor: colors.emeraldSoft, borderColor: colors.emeraldEdge },
  no: { backgroundColor: 'rgba(233,107,107,0.12)', borderColor: 'rgba(233,107,107,0.35)' },
  okText: { color: colors.emerald, fontWeight: typography.weight.semibold },
  noText: { color: colors.danger, fontWeight: typography.weight.semibold },
});
