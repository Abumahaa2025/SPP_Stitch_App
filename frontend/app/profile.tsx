import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

import { ScreenScaffold } from '@/src/components/ScreenScaffold';
import { StoryScreenHeader } from '@/src/components/StoryScreenHeader';
import { GlassCard } from '@/src/components/GlassCard';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';
import { useNotificationPrefs, useAccountPrefs } from '@/src/hooks/usePreferences';
import { api, type OwnerT } from '@/src/api/client';
import { storage } from '@/src/utils/storage';

export default function Profile() {
  const router = useRouter();
  const { t, lang, isRTL } = useI18n();
  const { countEnabled } = useNotificationPrefs();
  const { prefs } = useAccountPrefs();
  const [owner, setOwner] = useState<OwnerT | null>(null);
  const [storedName, setStoredName] = useState('');

  useEffect(() => {
    api.owner().then(setOwner).catch(() => {});
    storage.getItem<string>('spp.ownerName', '').then((v) => setStoredName(v ?? ''));
  }, []);

  const displayName = owner?.name?.trim() || storedName.trim() || t('profile.emptyName');
  const initial = displayName.charAt(0).toUpperCase() || '·';
  const propertyCount = owner?.properties ?? 0;

  const notImpl = (label: string) => {
    Haptics.selectionAsync();
    Alert.alert(label, t('common.phase4'), [{ text: t('common.done') }]);
  };

  const dir = isRTL ? 'rtl' : 'ltr';

  return (
    <ScreenScaffold testID="profile-screen">
      <StoryScreenHeader question={t('page.q.profile')} hint={t('profile.sub')} showBack testID="profile-header" />

      {/* Identity card */}
      <Animated.View entering={FadeInDown.duration(650)}>
        <GlassCard padding={24} radiusToken="lg" edge="gold" bright>
          <View style={[styles.identityRow, dir === 'rtl' && { flexDirection: 'row-reverse' }]}>
            <Pressable
              testID="profile-avatar"
              onPress={() => notImpl(t('profile.field.avatar'))}
              style={styles.avatarWrap}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarInitial}>{initial}</Text>
              </View>
              <View style={styles.avatarEdit}>
                <Feather name="camera" size={9} color={colors.bg} />
              </View>
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, dir === 'rtl' && { textAlign: 'right' }]}>{displayName}</Text>
              <Text style={[styles.email, dir === 'rtl' && { textAlign: 'right' }]}>{t('profile.emptyEmail')}</Text>
              <View style={[styles.orgRow, dir === 'rtl' && { flexDirection: 'row-reverse' }]}>
                <Feather name="briefcase" size={11} color={colors.textMuted} />
                <Text style={styles.org}>{t('profile.ownerRole')}</Text>
              </View>
            </View>
          </View>
          <Pressable
            testID="profile-edit"
            onPress={() => notImpl('Edit profile')}
            style={styles.editBtn}
          >
            <Feather name="edit-2" size={11} color={colors.gold} />
            <Text style={styles.editBtnText}>Edit identity</Text>
          </Pressable>
        </GlassCard>
      </Animated.View>

      {/* Personal */}
      <SectionCard delay={80} title={t('profile.section.personal')}>
        <FieldRow icon="user" label={t('profile.field.name')} value={displayName} onPress={() => notImpl(t('profile.field.name'))} testID="f-name" dir={dir} />
        <Divider />
        <FieldRow icon="mail" label={t('profile.field.email')} value={t('profile.emptyEmail')} onPress={() => notImpl(t('profile.field.email'))} testID="f-email" dir={dir} />
        <Divider />
        <FieldRow icon="phone" label={t('profile.field.phone')} value={t('profile.emptyPhone')} onPress={() => notImpl(t('profile.field.phone'))} testID="f-phone" dir={dir} />
        <Divider />
        <FieldRow icon="briefcase" label={t('profile.field.company')} value={t('profile.emptyCompany')} onPress={() => notImpl(t('profile.field.company'))} testID="f-company" dir={dir} />
      </SectionCard>

      {/* Regional & appearance */}
      <SectionCard delay={140} title={t('profile.section.preferences')}>
        <FieldRow
          icon="globe" label={t('profile.field.language')}
          value={lang === 'ar' ? 'العربية · RTL' : 'English · LTR'}
          onPress={() => { Haptics.selectionAsync(); router.push('/settings'); }}
          testID="f-lang" dir={dir}
        />
        <Divider />
        <FieldRow icon="dollar-sign" label={t('profile.field.currency')} value={prefs.currency} onPress={() => notImpl(t('profile.field.currency'))} testID="f-currency" dir={dir} />
        <Divider />
        <FieldRow icon="clock" label={t('profile.field.timezone')} value={prefs.timezone.replace('_', ' ')} onPress={() => notImpl(t('profile.field.timezone'))} testID="f-tz" dir={dir} />
        <Divider />
        <FieldRow
          icon="moon" label={t('profile.field.theme')}
          value={themeLabel(prefs.theme, t)}
          onPress={() => notImpl(t('profile.field.theme'))}
          testID="f-theme" dir={dir}
        />
      </SectionCard>

      {/* Portfolio identity */}
      <SectionCard delay={200} title={t('profile.section.portfolio')} accent="gold">
        <FieldRow icon="grid" label={t('hub.tile.owner')} value={propertyCount > 0 ? t('profile.propertyCount').replace('{count}', String(propertyCount)) : t('profile.noProperties')} onPress={() => router.push('/owner')} testID="f-owner" dir={dir} accent="gold" />
        <Divider />
        <FieldRow icon="star" label={t('profile.field.defaultProperty')} value={prefs.defaultProperty === 'none' ? 'Not set' : prefs.defaultProperty} onPress={() => notImpl(t('profile.field.defaultProperty'))} testID="f-defprop" dir={dir} />
      </SectionCard>

      {/* Notifications summary */}
      <SectionCard delay={260} title={t('profile.section.notifications')} accent="emerald">
        <FieldRow
          icon="bell" label={t('profile.field.notifSummary')}
          value={`${countEnabled} active`}
          onPress={() => { Haptics.selectionAsync(); router.push('/settings'); }}
          testID="f-notif" dir={dir} accent="emerald"
        />
      </SectionCard>

      {/* Security */}
      <SectionCard delay={320} title={t('profile.section.security')}>
        <FieldRow icon="lock" label={t('profile.field.password')} value={t('settings.passwordAge')} onPress={() => notImpl(t('profile.field.password'))} testID="f-pw" dir={dir} />
        <Divider />
        <FieldRow icon="shield" label={t('profile.field.twofa')} value={t('common.comingSoon')} onPress={() => notImpl(t('profile.field.twofa'))} testID="f-2fa" dir={dir} muted />
        <Divider />
        <FieldRow icon="eye-off" label={t('profile.field.privacy')} value="Manage" onPress={() => router.push('/privacy')} testID="f-privacy" dir={dir} />
      </SectionCard>

      {/* Connected services */}
      <SectionCard delay={380} title={t('profile.section.services')}>
        <ServiceRow icon="database" label={t('settings.services.sheets')} status="phase4" dir={dir} t={t} onPress={() => notImpl(t('settings.services.sheets'))} testID="p-sheets" />
        <Divider />
        <ServiceRow icon="home" label={t('settings.services.homeAssistant')} status="phase4" dir={dir} t={t} onPress={() => notImpl(t('settings.services.homeAssistant'))} testID="p-ha" />
        <Divider />
        <ServiceRow icon="message-circle" label={t('settings.services.whatsapp')} status="phase4" dir={dir} t={t} onPress={() => notImpl(t('settings.services.whatsapp'))} testID="p-wa" />
        <Divider />
        <ServiceRow icon="cpu" label={t('settings.services.openai')} status="active" dir={dir} t={t} onPress={() => Haptics.selectionAsync()} testID="p-oai" />
      </SectionCard>

      {/* Subscription */}
      <SectionCard delay={440} title={t('profile.section.billing')} accent="gold">
        <FieldRow
          icon="credit-card" label={t('profile.field.subscription')}
          value={t('profile.noSubscription')}
          onPress={() => router.push('/billing')}
          testID="f-sub" dir={dir} accent="gold"
        />
      </SectionCard>

      {/* Data */}
      <SectionCard delay={500} title={t('profile.section.data')}>
        <FieldRow
          icon="download" label={t('profile.field.dataExport')}
          value={t('profile.field.dataExport.hint')}
          onPress={() => notImpl(t('profile.field.dataExport'))}
          testID="f-export" dir={dir}
        />
      </SectionCard>

      {/* Sign out */}
      <Animated.View entering={FadeInDown.duration(600).delay(560)}>
        <Pressable
          testID="profile-signout"
          onPress={() => router.push('/settings')}
        >
          <GlassCard padding={18} radiusToken="lg">
            <View style={[styles.signRow, dir === 'rtl' && { flexDirection: 'row-reverse' }]}>
              <Feather name="log-out" size={14} color={colors.danger} />
              <Text style={styles.signText}>{t('profile.field.signout')}</Text>
            </View>
          </GlassCard>
        </Pressable>
      </Animated.View>

      <View style={styles.editHint}>
        <Text style={styles.editHintText}>{t('profile.editHint')}</Text>
      </View>
    </ScreenScaffold>
  );
}

function themeLabel(v: string, t: (k: any) => string) {
  if (v === 'system') return t('profile.theme.system');
  if (v === 'light') return t('profile.theme.light');
  return t('profile.theme.dark');
}

// ─── Sub-components ─────────────────────────────────────────────────────

function SectionCard({ title, children, delay = 0, accent }: { title: string; children: React.ReactNode; delay?: number; accent?: 'gold' | 'emerald' }) {
  return (
    <Animated.View entering={FadeInDown.duration(600).delay(delay)} style={{ marginTop: spacing.md }}>
      <GlassCard padding={22} radiusToken="lg" edge={accent ?? 'neutral'}>
        <Text style={styles.section}>{title.toUpperCase()}</Text>
        <View style={{ marginTop: 8 }}>{children}</View>
      </GlassCard>
    </Animated.View>
  );
}

function FieldRow({ icon, label, value, onPress, testID, dir, accent, muted }: {
  icon: keyof typeof Feather.glyphMap; label: string; value: string;
  onPress?: () => void; testID: string; dir: 'rtl' | 'ltr';
  accent?: 'gold' | 'emerald'; muted?: boolean;
}) {
  const valColor =
    accent === 'gold' ? colors.gold :
    accent === 'emerald' ? colors.emerald :
    muted ? colors.textSubtle : colors.textDim;

  const iconColor =
    accent === 'gold' ? colors.gold :
    accent === 'emerald' ? colors.emerald :
    colors.textMuted;

  return (
    <Pressable testID={testID} onPress={onPress ? () => { Haptics.selectionAsync(); onPress(); } : undefined}
               style={[styles.row, dir === 'rtl' && styles.rowRTL]}>
      <Feather name={icon} size={14} color={iconColor} />
      <Text style={[styles.rowLabel, dir === 'rtl' && { textAlign: 'right' }]}>{label}</Text>
      <View style={{ flex: 1 }} />
      <Text style={[styles.rowValue, { color: valColor }]} numberOfLines={1}>{value}</Text>
      {onPress ? <Feather name={dir === 'rtl' ? 'chevron-left' : 'chevron-right'} size={13} color={colors.textSubtle} /> : null}
    </Pressable>
  );
}

function ServiceRow({ icon, label, status, dir, t, onPress, testID }: {
  icon: keyof typeof Feather.glyphMap; label: string; status: 'phase4' | 'active';
  dir: 'rtl' | 'ltr'; t: (k: any) => string; onPress: () => void; testID: string;
}) {
  const isActive = status === 'active';
  return (
    <Pressable testID={testID} onPress={onPress} style={[styles.row, dir === 'rtl' && styles.rowRTL]}>
      <Feather name={icon} size={14} color={isActive ? colors.emerald : colors.textMuted} />
      <Text style={[styles.rowLabel, dir === 'rtl' && { textAlign: 'right' }]}>{label}</Text>
      <View style={{ flex: 1 }} />
      <View style={[styles.chip, isActive ? styles.chipActive : styles.chipPhase]}>
        <View style={[styles.chipDot, { backgroundColor: isActive ? colors.emerald : colors.gold }]} />
        <Text style={[styles.chipText, { color: isActive ? colors.emerald : colors.gold }]}>
          {isActive ? t('settings.services.status.active') : t('settings.services.status.notConnected')}
        </Text>
      </View>
    </Pressable>
  );
}

function Divider() { return <View style={styles.divider} />; }

const styles = StyleSheet.create({
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 62, height: 62, borderRadius: 31,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.goldEdge,
    backgroundColor: colors.goldSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { color: colors.gold, fontSize: 24, fontWeight: typography.weight.semibold, letterSpacing: -0.4 },
  avatarEdit: {
    position: 'absolute', bottom: -2, right: -2,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: colors.gold,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.bg,
  },
  name: { color: colors.text, fontSize: 19, fontWeight: typography.weight.semibold, letterSpacing: -0.3 },
  email: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
  orgRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  org: { color: colors.textDim, fontSize: 12, letterSpacing: 0.2 },
  editBtn: {
    marginTop: 18, alignSelf: 'flex-start',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.goldEdge,
    backgroundColor: colors.goldSoft,
  },
  editBtnText: { color: colors.gold, fontSize: 11, letterSpacing: 1, fontWeight: typography.weight.medium, textTransform: 'uppercase' },

  section: {
    color: colors.textMuted, fontSize: 10.5, letterSpacing: 2,
    textTransform: 'uppercase', fontWeight: typography.weight.medium,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rowRTL: { flexDirection: 'row-reverse' },
  rowLabel: { color: colors.text, fontSize: 13.5, letterSpacing: -0.1 },
  rowValue: { fontSize: 13, letterSpacing: -0.05, maxWidth: '55%' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.divider },

  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipActive: { backgroundColor: colors.emeraldSoft, borderColor: colors.emeraldEdge },
  chipPhase: { backgroundColor: colors.goldSoft, borderColor: colors.goldEdge },
  chipDot: { width: 5, height: 5, borderRadius: 3 },
  chipText: { fontSize: 9.5, letterSpacing: 1.1, fontWeight: typography.weight.medium },

  signRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  signText: { color: colors.danger, fontSize: 14, fontWeight: typography.weight.semibold, letterSpacing: -0.1 },

  editHint: { alignItems: 'center', marginTop: spacing.lg },
  editHintText: { color: colors.textSubtle, fontSize: 11, letterSpacing: 0.3, fontStyle: 'italic' },
});
