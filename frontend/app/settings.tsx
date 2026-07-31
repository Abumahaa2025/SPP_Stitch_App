import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Switch, I18nManager, Alert, DevSettings } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

import { ScreenScaffold } from '@/src/components/ScreenScaffold';
import { StoryScreenHeader } from '@/src/components/StoryScreenHeader';
import { GlassCard } from '@/src/components/GlassCard';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';
import { storage } from '@/src/utils/storage';
import { useNotificationPrefs } from '@/src/hooks/usePreferences';
import { useDemoMode } from '@/src/hooks/useDemoMode';
import { signOutSession } from '@/src/services/beta-auth';

export default function Settings() {
  const { t, lang, setLang, isRTL } = useI18n();
  const router = useRouter();
  const { prefs, update, countEnabled } = useNotificationPrefs();
  const { demoMode, setDemoMode } = useDemoMode();
  const [pendingRTL, setPendingRTL] = useState(false);
  const [allowDemoToggle, setAllowDemoToggle] = useState(false);

  useEffect(() => {
    storage.getItem<string>('spp.betaEmail', '').then((email) => {
      const isDemoCred = (email || '').toLowerCase().endsWith('@spp.beta');
      setAllowDemoToggle(isDemoCred || demoMode);
    });
  }, [demoMode]);

  // Language change — RTL requires a native reload to fully mirror the layout.
  const changeLang = async (l: 'en' | 'ar') => {
    Haptics.selectionAsync();
    await storage.setItem('spp.lang', l);
    setLang(l);
    // If the device layout direction still disagrees with the chosen language,
    // surface a soft banner (the layout will finalize on next app launch).
    setPendingRTL(I18nManager.isRTL !== (l === 'ar'));
  };

  const promptRestart = () => {
    Haptics.selectionAsync();
    Alert.alert(
      t('settings.rtl.reload'),
      t('settings.rtl.hint'),
      [
        { text: t('settings.rtl.later'), style: 'cancel' },
        {
          text: t('settings.rtl.reload'),
          style: 'destructive',
          onPress: () => {
            try {
              if (__DEV__ && DevSettings?.reload) DevSettings.reload();
            } catch { /* app will need manual restart */ }
          },
        },
      ]
    );
  };

  const openSetup = (path: string) => {
    Haptics.selectionAsync();
    router.push(path as any);
  };

  const signOut = () => {
    Haptics.selectionAsync();
    Alert.alert(
      t('settings.action.signout'),
      t('settings.action.signout.hint'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.action.signout'),
          style: 'destructive',
          onPress: async () => {
            await signOutSession();
            router.replace('/beta-login' as never);
          },
        },
      ]
    );
  };

  const dir = isRTL ? 'rtl' : 'ltr';

  return (
    <ScreenScaffold testID="settings-screen">
      <StoryScreenHeader question={t('page.q.settings')} hint={t('settings.sub')} showBack testID="settings-header" />

      {/* Account */}
      <Section title={t('settings.section.account')} delay={0} dir={dir}>
        <NavRow icon="user" label={t('profile.title')} hint={t('settings.demo.profile')}
                onPress={() => router.push('/profile')} testID="s-profile" dir={dir} />
      </Section>

      {/* Preferences · Language */}
      <Section title={t('settings.language')} delay={60} dir={dir}>
        <View style={styles.langRow}>
          <LangBtn active={lang === 'en'} label={t('settings.lang.en')} hint={t('settings.lang.enHint')}
                   onPress={() => changeLang('en')} testID="lang-en" />
          <LangBtn active={lang === 'ar'} label={t('settings.lang.ar')} hint={t('settings.lang.arHint')}
                   onPress={() => changeLang('ar')} testID="lang-ar" />
        </View>
        {(pendingRTL || (lang === 'ar' && I18nManager.isRTL === false)) ? (
          <Pressable
            testID="rtl-restart-banner"
            onPress={promptRestart}
            style={styles.rtlBanner}
          >
            <Feather name="refresh-cw" size={12} color={colors.gold} />
            <Text style={styles.rtlBannerText}>{t('settings.rtl.hint')}</Text>
            <Feather name="chevron-right" size={12} color={colors.gold} />
          </Pressable>
        ) : null}
      </Section>

      {/* Notifications */}
      <Section title={t('settings.section.notifications')} delay={120} accent="emerald" dir={dir}>
        <ToggleRow icon="target" label={t('settings.notif.priorities')} hint={t('settings.notif.priorities.hint')}
                   value={prefs.priorities} onChange={(v) => update('priorities', v)} dir={dir} />
        <Divider />
        <ToggleRow icon="calendar" label={t('settings.notif.weekly')} hint={t('settings.notif.weekly.hint')}
                   value={prefs.weeklyBrief} onChange={(v) => update('weeklyBrief', v)} dir={dir} />
        <Divider />
        <ToggleRow icon="activity" label={t('settings.notif.sensors')} hint={t('settings.notif.sensors.hint')}
                   value={prefs.sensorAlerts} onChange={(v) => update('sensorAlerts', v)} dir={dir} />
        <Divider />
        <ToggleRow icon="file-text" label={t('settings.notif.renewals')} hint={t('settings.notif.renewals.hint')}
                   value={prefs.contractRenewals} onChange={(v) => update('contractRenewals', v)} dir={dir} />
        <Divider />
        <ToggleRow icon="tool" label={t('settings.notif.maintenance')} hint={t('settings.notif.maintenance.hint')}
                   value={prefs.maintenance} onChange={(v) => update('maintenance', v)} dir={dir} />
        <Divider />
        <ToggleRow icon="moon" label={t('settings.notif.quiet')} hint={t('settings.notif.quiet.hint')}
                   value={prefs.quietHours} onChange={(v) => update('quietHours', v)} dir={dir} />
        <View style={styles.countRow}>
          <View style={styles.countDot} />
          <Text style={styles.countText}>{t('settings.notifCounter').replace('{count}', String(countEnabled))}</Text>
        </View>
      </Section>

      {/* Appearance */}
      <Section title={t('settings.appearance')} delay={180} dir={dir}>
        <ReadRow icon="moon" label={t('profile.field.theme')} value={t('settings.theme.value')} dir={dir} />
        <Divider />
        <ReadRow icon="type" label={t('settings.font')} value={t('settings.font.value')} dir={dir} />
        <Divider />
        <ReadRow icon="wind" label={t('settings.reduceMotion')} value={t('settings.reduceMotion.value')} dir={dir} />
      </Section>

      {/* Connections live on their own screen — Spec §5.18 / §5.19 */}
      <Section title={t('settings.section.services')} delay={240} dir={dir}>
        <NavRow
          icon="link"
          label={t('settings.services.openHub')}
          hint={t('settings.services.openHub.hint')}
          onPress={() => openSetup('/operational/services')}
          testID="svc-hub"
          dir={dir}
        />
      </Section>

      {/* Backup & data */}
      <Section title={t('settings.section.data')} delay={300} accent="gold" dir={dir}>
        <NavRow icon="hard-drive" label={t('settings.backup')} hint={t('settings.backup.hint')}
                onPress={() => openSetup('/setup/backup')} testID="s-backup" dir={dir} />
        <Divider />
        <NavRow icon="download" label={t('settings.importExport')} hint={t('settings.importExport.hint')}
                onPress={() => openSetup('/setup/import')} testID="s-import" dir={dir} />
        {allowDemoToggle ? (
          <>
            <Divider />
            <ToggleRow
              icon="database"
              label={t('settings.demoMode')}
              hint={t('settings.demoMode.hint')}
              value={demoMode}
              onChange={(v) => { void setDemoMode(v); }}
              dir={dir}
            />
            <View style={styles.countRow}>
              <View style={[styles.countDot, { backgroundColor: demoMode ? colors.gold : colors.emerald }]} />
              <Text style={styles.countText}>
                {demoMode ? t('settings.demoMode.on') : t('settings.demoMode.off')}
              </Text>
            </View>
          </>
        ) : null}
      </Section>

      {/* Brain */}
      <Section title={t('settings.brain')} delay={390} accent="emerald" dir={dir}>
        <ReadRow icon="cpu" label={t('settings.manager.model')} value="GPT-5.2" accent dir={dir} />
        <Divider />
        <ReadRow icon="shield" label={t('settings.brain.memory')} value={t('settings.brain.memory.value')} dir={dir} />
        <Divider />
        <ReadRow icon="link" label={t('settings.brain.key')} value={t('settings.brain.key.value')} accent dir={dir} />
      </Section>

      {/* Privacy & security */}
      <Section title={t('settings.section.privacy')} delay={450} dir={dir}>
        <NavRow icon="user" label={t('settings.accountMgmt')} hint={t('settings.accountMgmt.hint')}
                onPress={() => openSetup('/setup/account')} testID="s-account" dir={dir} />
        <Divider />
        <NavRow icon="shield" label={t('settings.security')} hint={t('settings.security.hint')}
                onPress={() => openSetup('/setup/security')} testID="s-security" dir={dir} accent="gold" />
        <Divider />
        <NavRow icon="lock" label={t('profile.field.password')} hint={t('settings.passwordAge')}
                onPress={() => openSetup('/setup/security')} testID="s-password" dir={dir} />
        <Divider />
        <NavRow icon="shield" label={t('profile.field.twofa')} hint={t('settings.twofa.hint')}
                onPress={() => openSetup('/setup/security')} testID="s-2fa" dir={dir} />
        <Divider />
        <NavRow icon="download" label={t('profile.field.dataExport')} hint={t('profile.field.dataExport.hint')}
                onPress={() => openSetup('/setup/import')} testID="s-export" dir={dir} />
        <Divider />
        <NavRow icon="file-text" label={t('settings.privacyPolicy')} onPress={() => router.push('/privacy')} testID="s-privacy" dir={dir} />
        <Divider />
        <NavRow icon="file-text" label={t('settings.termsOfService')} onPress={() => router.push('/terms')} testID="s-terms" dir={dir} />
      </Section>

      {/* Help & About */}
      <Section title={t('settings.section.help')} delay={510} dir={dir}>
        <NavRow icon="play-circle" label={t('settings.learnCenter')} hint={t('settings.learnCenter.hint')}
                onPress={() => router.push('/guides')} testID="s-guides" dir={dir} accent="gold" />
        <Divider />
        <NavRow icon="life-buoy" label={t('settings.contactSupport')} hint={t('settings.contactSupport.hint')}
                onPress={() => router.push('/support')} testID="s-support" dir={dir} />
        <Divider />
        <NavRow icon="info" label={t('settings.aboutSpp')} hint={t('settings.aboutSpp.hint')}
                onPress={() => router.push('/about')} testID="s-about" dir={dir} />
      </Section>

      {/* Sign out */}
      <Animated.View entering={FadeInDown.duration(600).delay(480)} style={{ marginBottom: spacing.md }}>
        <Pressable testID="s-signout" onPress={signOut}>
          <GlassCard padding={18} radiusToken="lg">
            <View style={[styles.row, { justifyContent: 'center' }]}>
              <Feather name="log-out" size={14} color={colors.danger} />
              <Text style={styles.signout}>{t('settings.action.signout')}</Text>
            </View>
          </GlassCard>
        </Pressable>
      </Animated.View>

      <View style={styles.footer}>
        <View style={styles.footerLine} />
        <Text style={styles.footerText}>SPP · 1.0.0-beta.2 · {t('settings.footerLabel')}</Text>
        <Text style={styles.footerSub}>{t('settings.footerMotto')}</Text>
      </View>
    </ScreenScaffold>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────

function Section({ title, children, delay = 0, accent, dir }: { title: string; children: React.ReactNode; delay?: number; accent?: 'emerald' | 'gold'; dir: 'rtl' | 'ltr' }) {
  return (
    <Animated.View entering={FadeInDown.duration(600).delay(delay)} style={{ marginBottom: spacing.md }}>
      <GlassCard padding={22} radiusToken="lg" edge={accent ?? 'neutral'}>
        <Text style={[styles.section, dir === 'rtl' && { textAlign: 'right' }]}>{title.toUpperCase()}</Text>
        <View style={{ marginTop: 8 }}>{children}</View>
      </GlassCard>
    </Animated.View>
  );
}

function NavRow({ icon, label, hint, onPress, accent, testID, dir }: { icon: keyof typeof Feather.glyphMap; label: string; hint?: string; onPress: () => void; accent?: 'gold'; testID: string; dir: 'rtl' | 'ltr' }) {
  return (
    <Pressable testID={testID} onPress={() => { Haptics.selectionAsync(); onPress(); }}
               style={[styles.row, dir === 'rtl' && styles.rowRTL]}>
      <Feather name={icon} size={14} color={accent === 'gold' ? colors.gold : colors.textMuted} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, dir === 'rtl' && { textAlign: 'right' }]}>{label}</Text>
        {hint ? <Text style={[styles.rowHint, dir === 'rtl' && { textAlign: 'right' }]}>{hint}</Text> : null}
      </View>
      <Feather name={dir === 'rtl' ? 'chevron-left' : 'chevron-right'} size={14} color={colors.textSubtle} />
    </Pressable>
  );
}

function ReadRow({ icon, label, value, accent, dir }: { icon: keyof typeof Feather.glyphMap; label: string; value: string; accent?: boolean; dir: 'rtl' | 'ltr' }) {
  return (
    <View style={[styles.row, dir === 'rtl' && styles.rowRTL]}>
      <Feather name={icon} size={14} color={accent ? colors.gold : colors.textMuted} />
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={{ flex: 1 }} />
      <Text style={[styles.rowValue, accent && { color: colors.gold }]}>{value}</Text>
    </View>
  );
}

function ToggleRow({ icon, label, hint, value, onChange, dir }: { icon: keyof typeof Feather.glyphMap; label: string; hint?: string; value: boolean; onChange: (v: boolean) => void; dir: 'rtl' | 'ltr' }) {
  return (
    <View style={[styles.row, dir === 'rtl' && styles.rowRTL]}>
      <Feather name={icon} size={14} color={value ? colors.emerald : colors.textMuted} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, dir === 'rtl' && { textAlign: 'right' }]}>{label}</Text>
        {hint ? <Text style={[styles.rowHint, dir === 'rtl' && { textAlign: 'right' }]}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={(v) => { Haptics.selectionAsync(); onChange(v); }}
        trackColor={{ false: 'rgba(255,255,255,0.1)', true: colors.emeraldEdge }}
        thumbColor={value ? colors.emerald : '#8B95A5'}
        ios_backgroundColor="rgba(255,255,255,0.1)"
      />
    </View>
  );
}

function ServiceRow({ icon, label, hint, connected, summary, statusLabel, onPress, testID, dir, t }: {
  icon: keyof typeof Feather.glyphMap; label: string; hint: string;
  connected?: boolean; summary?: string; statusLabel?: string;
  onPress: () => void; testID: string; dir: 'rtl' | 'ltr'; t: (k: any) => string;
}) {
  const isActive = connected || !!statusLabel;
  const chipText = statusLabel
    ?? (connected ? (summary ? `··${summary}` : t('settings.services.status.connected')) : t('settings.services.status.setup'));
  return (
    <Pressable testID={testID} onPress={onPress} style={[styles.row, dir === 'rtl' && styles.rowRTL]}>
      <Feather name={icon} size={14} color={isActive ? colors.emerald : colors.textMuted} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, dir === 'rtl' && { textAlign: 'right' }]}>{label}</Text>
        <Text style={[styles.rowHint, dir === 'rtl' && { textAlign: 'right' }]}>{hint}</Text>
      </View>
      <View style={[styles.chip, isActive ? styles.chipActive : styles.chipPhase]}>
        <View style={[styles.chipDot, { backgroundColor: isActive ? colors.emerald : colors.gold }]} />
        <Text style={[styles.chipText, { color: isActive ? colors.emerald : colors.gold }]}>{chipText}</Text>
      </View>
    </Pressable>
  );
}

function LangBtn({ active, label, hint, onPress, testID }: { active: boolean; label: string; hint: string; onPress: () => void; testID: string }) {
  return (
    <Pressable testID={testID} onPress={onPress} style={[styles.langBtn, active && styles.langBtnActive]}>
      <Text style={[styles.langBtnLabel, active && { color: colors.gold }]}>{label}</Text>
      <Text style={styles.langBtnHint}>{hint}</Text>
      {active ? <View style={styles.langActiveDot} /> : null}
    </Pressable>
  );
}

function Divider() { return <View style={styles.divider} />; }

const styles = StyleSheet.create({
  section: {
    color: colors.textMuted, fontSize: 10.5, letterSpacing: 2,
    textTransform: 'uppercase', fontWeight: typography.weight.medium,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rowRTL: { flexDirection: 'row-reverse' },
  rowLabel: { color: colors.text, fontSize: 14, letterSpacing: -0.1 },
  rowHint: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
  rowValue: { color: colors.textDim, fontSize: 13, letterSpacing: -0.1 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.divider },
  langRow: { flexDirection: 'row', gap: spacing.md, marginTop: 4 },
  langBtn: {
    flex: 1, padding: 18, borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.02)',
    position: 'relative',
  },
  langBtnActive: { borderColor: colors.goldEdge, backgroundColor: colors.goldSoft },
  langBtnLabel: { color: colors.text, fontSize: 16, fontWeight: typography.weight.semibold },
  langBtnHint: { color: colors.textSubtle, fontSize: 11, marginTop: 4, letterSpacing: 0.8 },
  langActiveDot: {
    position: 'absolute', top: 12, right: 12,
    width: 6, height: 6, borderRadius: 3, backgroundColor: colors.gold,
  },
  rtlBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14,
    paddingVertical: 12, paddingHorizontal: 14, borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.goldEdge,
    backgroundColor: colors.goldSoft,
  },
  rtlBannerText: { color: colors.gold, fontSize: 11.5, lineHeight: 17, flex: 1, letterSpacing: 0.1 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipActive: { backgroundColor: colors.emeraldSoft, borderColor: colors.emeraldEdge },
  chipPhase: { backgroundColor: colors.goldSoft, borderColor: colors.goldEdge },
  chipDot: { width: 5, height: 5, borderRadius: 3 },
  chipText: { fontSize: 9.5, letterSpacing: 1.1, fontWeight: typography.weight.medium },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider },
  countDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.emerald },
  countText: { color: colors.textMuted, fontSize: 11, letterSpacing: 0.4 },
  signout: { color: colors.danger, fontSize: 14, fontWeight: typography.weight.semibold, letterSpacing: -0.1 },
  footer: { alignItems: 'center', marginTop: spacing.xl, gap: 8 },
  footerLine: { width: 28, height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginBottom: 4 },
  footerText: { color: colors.textDim, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', fontWeight: typography.weight.medium },
  footerSub: { color: colors.textSubtle, fontSize: 10.5, letterSpacing: 0.3 },
});
