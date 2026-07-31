import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Alert, Switch, Share, Linking,
} from 'react-native';
import { KeyboardAwareTextInput } from '@/src/components/KeyboardAwareTextInput';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

import { ScreenScaffold } from '@/src/components/ScreenScaffold';
import { StoryScreenHeader } from '@/src/components/StoryScreenHeader';
import { GlassCard } from '@/src/components/GlassCard';
import { GuidedSetup } from '@/src/components/GuidedSetup';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';
import {
  useRoles, ROLE_PERMISSION_KEYS, type RoleKey, type RoleMember,
} from '@/src/hooks/useRoles';
import { storage } from '@/src/utils/storage';

const ROLES: RoleKey[] = [
  'owner', 'co_owner', 'property_manager', 'accountant', 'technician', 'tenant',
];

function inviteToken() {
  return `inv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function RolesScreen() {
  const { t, isRTL } = useI18n();
  const router = useRouter();
  const { members, addMember, updateMember, removeMember } = useRoles();
  const [selectedRole, setSelectedRole] = useState<RoleKey>('owner');
  const [showAdd, setShowAdd] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftEmail, setDraftEmail] = useState('');
  const [inviteChannel, setInviteChannel] = useState<'whatsapp' | 'sms' | 'link'>('whatsapp');

  const dir = isRTL ? 'rtl' : 'ltr';
  const perms = ROLE_PERMISSION_KEYS[selectedRole];

  const submitAdd = () => {
    if (!draftName.trim() || !draftEmail.trim()) return;
    addMember({ name: draftName.trim(), email: draftEmail.trim(), role: selectedRole, active: true });
    setDraftName('');
    setDraftEmail('');
    setShowAdd(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const confirmRemove = (m: RoleMember) => {
    if (m.role === 'owner') return;
    Alert.alert(t('roles.remove.title'), t('roles.remove.body').replace('{name}', m.name), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('roles.remove.confirm'), style: 'destructive', onPress: () => removeMember(m.id) },
    ]);
  };

  const sendInvite = async (m: RoleMember) => {
    Haptics.selectionAsync();
    const token = inviteToken();
    const pending = {
      token,
      memberId: m.id,
      name: m.name,
      email: m.email,
      role: m.role,
      createdAt: new Date().toISOString(),
      status: 'pending' as const,
    };
    const raw = await storage.getItem<string>('spp.roleInvites', '[]');
    let list: typeof pending[] = [];
    try { list = JSON.parse(raw || '[]'); } catch { list = []; }
    list = [pending, ...list].slice(0, 40);
    await storage.setItem('spp.roleInvites', JSON.stringify(list));

    const deepLink = `spp://roles/accept?token=${token}`;
    const msg = t('roles.invite.message' as any)
      .replace('{name}', m.name)
      .replace('{role}', t(`roles.role.${m.role}` as 'roles.role.owner'))
      .replace('{link}', deepLink);

    if (inviteChannel === 'whatsapp') {
      const wa = `https://wa.me/?text=${encodeURIComponent(msg)}`;
      Linking.openURL(wa).catch(() => Share.share({ message: msg }));
    } else if (inviteChannel === 'sms') {
      Linking.openURL(`sms:?body=${encodeURIComponent(msg)}`).catch(() => Share.share({ message: msg }));
    } else {
      await Share.share({ message: msg });
    }
  };

  return (
    <ScreenScaffold testID="roles-screen">
      <StoryScreenHeader
        question={t('roles.title')}
        hint={t('roles.sub')}
        showBack
        testID="roles-header"
      />

      <GuidedSetup flowId="tenant" defaultOpen={false} testID="roles-guided" />

      <Animated.View entering={FadeInDown.duration(550)}>
        <GlassCard padding={20} radiusToken="lg" edge="gold">
          <Text style={[styles.section, dir === 'rtl' && styles.rtl]}>{t('roles.selectRole').toUpperCase()}</Text>
          <View style={styles.roleGrid}>
            {ROLES.map((r) => (
              <Pressable
                key={r}
                testID={`role-${r}`}
                onPress={() => { Haptics.selectionAsync(); setSelectedRole(r); }}
                style={[styles.roleChip, selectedRole === r && styles.roleChipActive]}
              >
                <Text style={[styles.roleChipText, selectedRole === r && { color: colors.gold }]}>
                  {t(`roles.role.${r}` as 'roles.role.owner')}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={[styles.roleDesc, dir === 'rtl' && styles.rtl]}>
            {t(`roles.desc.${selectedRole}` as 'roles.desc.owner')}
          </Text>
        </GlassCard>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(600).delay(60)} style={{ marginTop: spacing.md }}>
        <GlassCard padding={20} radiusToken="lg" edge="emerald">
          <Text style={[styles.section, dir === 'rtl' && styles.rtl]}>{t('roles.permissions').toUpperCase()}</Text>
          <View style={{ marginTop: 10, gap: 8 }}>
            {perms.map((p) => (
              <View key={p} style={[styles.permRow, dir === 'rtl' && styles.rowRtl]}>
                <Feather name="check-circle" size={13} color={colors.emerald} />
                <Text style={[styles.permText, dir === 'rtl' && styles.rtl]}>
                  {t(`roles.perm.${p}` as 'roles.perm.all')}
                </Text>
              </View>
            ))}
          </View>
        </GlassCard>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(600).delay(90)} style={{ marginTop: spacing.md }}>
        <GlassCard padding={16} radiusToken="md">
          <Text style={[styles.section, dir === 'rtl' && styles.rtl]}>{t('roles.invite.channel' as any)}</Text>
          <View style={[styles.roleGrid, { marginTop: 10 }]}>
            {(['whatsapp', 'sms', 'link'] as const).map((ch) => (
              <Pressable
                key={ch}
                testID={`invite-ch-${ch}`}
                onPress={() => { Haptics.selectionAsync(); setInviteChannel(ch); }}
                style={[styles.roleChip, inviteChannel === ch && styles.roleChipActive]}
              >
                <Text style={[styles.roleChipText, inviteChannel === ch && { color: colors.gold }]}>
                  {t(`roles.invite.${ch}` as any)}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            testID="roles-open-accept"
            style={styles.acceptLink}
            onPress={() => router.push('/roles/accept' as any)}
          >
            <Feather name="shield" size={13} color={colors.emerald} />
            <Text style={styles.acceptLinkText}>{t('roles.invite.openAccept' as any)}</Text>
          </Pressable>
        </GlassCard>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(600).delay(120)} style={{ marginTop: spacing.md }}>
        <GlassCard padding={20} radiusToken="lg">
          <View style={[styles.memberHead, dir === 'rtl' && styles.rowRtl]}>
            <Text style={[styles.section, dir === 'rtl' && styles.rtl]}>{t('roles.team').toUpperCase()}</Text>
            <Pressable
              testID="roles-add"
              onPress={() => { Haptics.selectionAsync(); setShowAdd((v) => !v); }}
              style={styles.addBtn}
            >
              <Feather name="user-plus" size={12} color={colors.gold} />
              <Text style={styles.addBtnText}>{t('roles.addMember')}</Text>
            </Pressable>
          </View>

          {showAdd ? (
            <View style={styles.addForm}>
              <KeyboardAwareTextInput
                testID="roles-add-name"
                value={draftName}
                onChangeText={setDraftName}
                placeholder={t('roles.field.name')}
                placeholderTextColor={colors.textSubtle}
                style={[styles.input, dir === 'rtl' && styles.inputRtl]}
              />
              <KeyboardAwareTextInput
                testID="roles-add-email"
                value={draftEmail}
                onChangeText={setDraftEmail}
                placeholder={t('roles.field.email')}
                placeholderTextColor={colors.textSubtle}
                keyboardType="email-address"
                autoCapitalize="none"
                style={[styles.input, dir === 'rtl' && styles.inputRtl]}
              />
              <Pressable onPress={submitAdd} style={styles.submitAdd}>
                <Text style={styles.submitAddText}>{t('roles.saveMember')}</Text>
              </Pressable>
            </View>
          ) : null}

          {members.map((m, i) => (
            <View key={m.id}>
              {i > 0 ? <View style={styles.divider} /> : null}
              <View style={[styles.memberRow, dir === 'rtl' && styles.rowRtl]}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{(m.name || '?').charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.memberName, dir === 'rtl' && styles.rtl]}>
                    {m.name || t('roles.unnamed')}
                  </Text>
                  <Text style={[styles.memberEmail, dir === 'rtl' && styles.rtl]}>
                    {m.email || t('roles.noEmail')} · {t(`roles.role.${m.role}` as 'roles.role.owner')}
                  </Text>
                </View>
                {m.role !== 'owner' ? (
                  <Pressable testID={`roles-invite-${m.id}`} onPress={() => sendInvite(m)} hitSlop={8}>
                    <Feather name="send" size={14} color={colors.gold} />
                  </Pressable>
                ) : null}
                <Switch
                  value={m.active}
                  onValueChange={(v) => updateMember(m.id, { active: v })}
                  trackColor={{ false: 'rgba(255,255,255,0.1)', true: colors.emeraldEdge }}
                  thumbColor={m.active ? colors.emerald : '#8B95A5'}
                />
                {m.role !== 'owner' ? (
                  <Pressable onPress={() => confirmRemove(m)} hitSlop={8}>
                    <Feather name="trash-2" size={14} color={colors.textSubtle} />
                  </Pressable>
                ) : null}
              </View>
            </View>
          ))}
        </GlassCard>
      </Animated.View>

      <Pressable
        testID="roles-learn"
        onPress={() => router.push('/guides')}
        style={styles.learnLink}
      >
        <Feather name="book-open" size={13} color={colors.gold} />
        <Text style={styles.learnLinkText}>{t('roles.learnMore')}</Text>
      </Pressable>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  section: { color: colors.textMuted, fontSize: 10.5, letterSpacing: 2, fontWeight: typography.weight.medium },
  roleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  roleChip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  roleChipActive: { borderColor: colors.goldEdge, backgroundColor: colors.goldSoft },
  roleChipText: { color: colors.textDim, fontSize: 11.5, fontWeight: typography.weight.medium },
  roleDesc: { color: colors.textDim, fontSize: 13, lineHeight: 20, marginTop: 14 },
  permRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowRtl: { flexDirection: 'row-reverse' },
  permText: { color: colors.text, fontSize: 13.5, flex: 1 },
  memberHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  addBtnText: { color: colors.gold, fontSize: 12, fontWeight: typography.weight.medium },
  addForm: { marginTop: 14, gap: 10 },
  input: {
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: 14, paddingVertical: 12, color: colors.text, fontSize: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  inputRtl: { textAlign: 'right' },
  submitAdd: {
    backgroundColor: colors.emerald, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center',
  },
  submitAddText: { color: colors.bg, fontSize: 13, fontWeight: typography.weight.semibold },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  avatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.goldSoft,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.goldEdge,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: colors.gold, fontSize: 14, fontWeight: typography.weight.semibold },
  memberName: { color: colors.text, fontSize: 14, fontWeight: typography.weight.semibold },
  memberEmail: { color: colors.textMuted, fontSize: 11.5, marginTop: 2 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.divider },
  learnLink: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', marginTop: spacing.xl, marginBottom: spacing.md },
  learnLinkText: { color: colors.gold, fontSize: 12.5 },
  acceptLink: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  acceptLinkText: { color: colors.emerald, fontSize: 12.5, fontWeight: typography.weight.medium },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
});
