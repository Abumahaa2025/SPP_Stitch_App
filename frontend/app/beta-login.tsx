import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator,
  KeyboardAvoidingView, Platform, Keyboard, Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, SlideInRight, SlideOutLeft } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { AmbientBackground } from '@/src/components/AmbientBackground';
import { PremiumWelcomeHero } from '@/src/components/auth/PremiumWelcomeHero';
import { AuthField } from '@/src/components/auth/AuthField';
import { GlassCard } from '@/src/components/GlassCard';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';
import { storage } from '@/src/utils/storage';
import {
  type Persona,
  type SignInFailureCode,
  registerAccount,
  signInLocal,
  assignPersona,
  finalizeSession,
  resolvePostLoginRoute,
} from '@/src/services/beta-auth';

type Screen = 'welcome' | 'signup' | 'signin' | 'role';

const ROLES: { id: Persona; icon: keyof typeof Feather.glyphMap }[] = [
  { id: 'owner', icon: 'home' },
  { id: 'tenant', icon: 'user' },
  { id: 'technician', icon: 'tool' },
];

export default function BetaLogin() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, isRTL } = useI18n();
  const scrollRef = useRef<ScrollView>(null);

  const [screen, setScreen] = useState<Screen>('welcome');
  const [roleSource, setRoleSource] = useState<'signup' | 'signin'>('signup');
  const [signinMode, setSigninMode] = useState<'email' | 'phone'>('email');
  const [accountId, setAccountId] = useState<string | null>(null);
  const [pendingName, setPendingName] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const keyboardOffset = insets.top + 8;
  const scrollEnd = () => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);

  const go = (next: Screen) => {
    setError('');
    Haptics.selectionAsync();
    setScreen(next);
  };

  const finishAppEntry = async (
    persona: Persona,
    displayEmail: string,
    displayName?: string,
    useDemoData = false,
  ) => {
    setBusy(true);
    setError('');
    try {
      const result = await finalizeSession({ persona, displayEmail, displayName, useDemoData });

      if (!result.sessionSaved) {
        throw new Error(t('auth.error.session' as never));
      }

      const onboarded = (await storage.getItem<boolean>('spp.onboarded', false)) ?? false;
      const target = resolvePostLoginRoute(persona, onboarded);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Keyboard.dismiss();
      router.replace(target as never);

      if (!result.backendSynced && result.backendError) {
        setTimeout(() => {
          Alert.alert(
            t('auth.warn.backendTitle' as never),
            `${t('auth.warn.backendBody' as never)}\n\n${result.backendError}`,
          );
        }, 450);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg || t('auth.error.server' as never));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setBusy(false);
    }
  };

  const handleSignup = async () => {
    setBusy(true);
    setError('');
    const result = await registerAccount({ name, phone, email, password });
    setBusy(false);
    if (!result.ok) {
      setError(t(result.code === 'duplicate' ? 'auth.error.duplicate' : 'auth.error.invalid' as never));
      return;
    }
    setAccountId(result.account.id);
    setPendingName(result.account.name);
    setPendingEmail(result.account.email);
    setRoleSource('signup');
    go('role');
  };

  const signInErrorKey = (code: SignInFailureCode) => {
    const map: Record<SignInFailureCode, string> = {
      empty: 'auth.error.empty',
      not_found: 'auth.error.credentials',
      wrong_password: 'auth.error.wrong_password',
    };
    return map[code];
  };

  const handleSignin = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await signInLocal(identifier, password, signinMode);

      if (!result.ok) {
        setError(t(signInErrorKey(result.code) as never));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }

      if ('demoPersona' in result && result.demoPersona) {
        const emails = { owner: 'demo.owner@spp.beta', tenant: 'demo.tenant@spp.beta', technician: 'demo.tech@spp.beta' } as const;
        await finishAppEntry(result.demoPersona, emails[result.demoPersona], undefined, true);
        return;
      }

      if ('account' in result) {
        const { account, needsRole } = result;
        setPendingName(account.name);
        setPendingEmail(account.email);
        setAccountId(account.id);

        if (needsRole) {
          setRoleSource('signin');
          go('role');
          return;
        }

        await finishAppEntry(account.persona!, account.email, account.name);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg || t('auth.error.server' as never));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setBusy(false);
    }
  };

  const handleRole = async (persona: Persona) => {
    if (!accountId) {
      setError(t('auth.error.session' as never));
      return;
    }
    setBusy(true);
    setError('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const updated = await assignPersona(accountId, persona);
      if (!updated) throw new Error(t('auth.error.session' as never));
      await finishAppEntry(persona, updated.email, updated.name);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg || t('auth.error.server' as never));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setBusy(false);
    }
  };

  const DEMO_EMAIL: Record<Persona, string> = {
    owner: 'demo.owner@spp.beta',
    tenant: 'demo.tenant@spp.beta',
    technician: 'demo.tech@spp.beta',
  };

  return (
    <View style={styles.root} testID="beta-login-screen">
      <StatusBar style="light" />
      <AmbientBackground />

      {screen !== 'welcome' ? (
        <Pressable
          style={[styles.back, isRTL ? styles.backRtl : styles.backLtr, { top: insets.top + 8 }]}
          onPress={() => go(screen === 'role' ? roleSource : 'welcome')}
          hitSlop={16}
        >
          <Feather name={isRTL ? 'arrow-right' : 'arrow-left'} size={22} color={colors.text} />
        </Pressable>
      ) : null}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={keyboardOffset}
      >
        {screen === 'welcome' ? (
          <Animated.View key="welcome" entering={FadeIn.duration(400)} style={styles.flex}>
            <PremiumWelcomeHero />
            <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
              <Pressable
                testID="auth-create"
                onPress={() => go('signup')}
                style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
              >
                <Text style={styles.primaryText}>{t('auth.cta.create' as never)}</Text>
              </Pressable>
              <Pressable
                testID="auth-signin"
                onPress={() => go('signin')}
                style={({ pressed }) => [styles.ghostBtn, pressed && styles.pressed]}
              >
                <Text style={styles.ghostText}>{t('auth.cta.signin' as never)}</Text>
              </Pressable>
            </View>
          </Animated.View>
        ) : (
          <ScrollView
            ref={scrollRef}
            style={styles.flex}
            contentContainerStyle={[
              styles.formScroll,
              {
                paddingTop: insets.top + 56,
                paddingBottom: insets.bottom + spacing['2xl'],
              },
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            {screen === 'signup' ? (
              <Animated.View key="signup" entering={SlideInRight.duration(320)} exiting={SlideOutLeft.duration(220)}>
                <Text style={[styles.formTitle, isRTL && styles.rtl]}>{t('auth.signup.title' as never)}</Text>
                <Text style={[styles.formSub, isRTL && styles.rtl]}>{t('auth.signup.sub' as never)}</Text>
                <View style={styles.formBody}>
                  <AuthField label={t('auth.field.name' as never)} value={name} onChangeText={setName} isRTL={isRTL} onFocusExtra={scrollEnd} testID="auth-name" placeholder={t('auth.field.namePh' as never)} />
                  <AuthField label={t('auth.field.phone' as never)} value={phone} onChangeText={setPhone} isRTL={isRTL} keyboardType="phone-pad" onFocusExtra={scrollEnd} testID="auth-phone" placeholder="05XXXXXXXX" />
                  <AuthField label={t('auth.field.email' as never)} value={email} onChangeText={setEmail} isRTL={isRTL} keyboardType="email-address" autoCapitalize="none" onFocusExtra={scrollEnd} testID="auth-email" placeholder="you@company.com" />
                  <AuthField label={t('auth.field.password' as never)} value={password} onChangeText={setPassword} isRTL={isRTL} secureTextEntry onFocusExtra={scrollEnd} testID="auth-password" placeholder="••••••••" />
                  {error ? <Text style={styles.error}>{error}</Text> : null}
                  <Pressable disabled={busy} onPress={handleSignup} style={[styles.primaryBtn, busy && styles.disabled]}>
                    {busy ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.primaryText}>{t('auth.signup.continue' as never)}</Text>}
                  </Pressable>
                </View>
              </Animated.View>
            ) : null}

            {screen === 'signin' ? (
              <Animated.View key="signin" entering={SlideInRight.duration(320)} exiting={SlideOutLeft.duration(220)}>
                <Text style={[styles.formTitle, isRTL && styles.rtl]}>{t('auth.signin.title' as never)}</Text>
                <Text style={[styles.formSub, isRTL && styles.rtl]}>{t('auth.signin.sub' as never)}</Text>
                <View style={[styles.segment, isRTL && styles.segmentRtl]}>
                  {(['email', 'phone'] as const).map((mode) => (
                    <Pressable
                      key={mode}
                      onPress={() => { setSigninMode(mode); setError(''); }}
                      style={[styles.segmentBtn, signinMode === mode && styles.segmentActive]}
                    >
                      <Text style={[styles.segmentText, signinMode === mode && styles.segmentTextActive]}>
                        {t(mode === 'email' ? 'auth.signin.emailTab' : 'auth.signin.phoneTab' as never)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.formBody}>
                  <AuthField
                    label={signinMode === 'email' ? t('auth.field.email' as never) : t('auth.field.phone' as never)}
                    value={identifier}
                    onChangeText={setIdentifier}
                    isRTL={isRTL}
                    keyboardType={signinMode === 'email' ? 'email-address' : 'phone-pad'}
                    autoCapitalize="none"
                    onFocusExtra={scrollEnd}
                    testID="auth-identifier"
                    placeholder={signinMode === 'email' ? 'you@company.com' : '05XXXXXXXX'}
                  />
                  <AuthField label={t('auth.field.password' as never)} value={password} onChangeText={setPassword} isRTL={isRTL} secureTextEntry onFocusExtra={scrollEnd} testID="auth-signin-password" placeholder="••••••••" />
                  {error ? <Text style={styles.error}>{error}</Text> : null}
                  <Pressable disabled={busy} onPress={handleSignin} style={[styles.primaryBtn, busy && styles.disabled]}>
                    {busy ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.primaryText}>{t('auth.signin.submit' as never)}</Text>}
                  </Pressable>
                  <Pressable onPress={() => go('signup')} style={styles.linkWrap}>
                    <Text style={styles.link}>{t('auth.signin.createLink' as never)}</Text>
                  </Pressable>
                </View>
              </Animated.View>
            ) : null}

            {screen === 'role' ? (
              <Animated.View key="role" entering={SlideInRight.duration(320)} exiting={SlideOutLeft.duration(220)}>
                <Text style={[styles.formTitle, isRTL && styles.rtl]}>{t('auth.role.title' as never)}</Text>
                <Text style={[styles.formSub, isRTL && styles.rtl]}>
                  {pendingName ? t('auth.role.greeting' as never).replace('{name}', pendingName) : t('auth.role.sub' as never)}
                </Text>
                <View style={styles.roleStack}>
                  {ROLES.map((role) => (
                    <Pressable
                      key={role.id}
                      disabled={busy}
                      testID={`auth-role-${role.id}`}
                      onPress={() => handleRole(role.id)}
                      style={({ pressed }) => [pressed && styles.pressed]}
                    >
                      <GlassCard padding={20} radiusToken="lg" edge={role.id === 'owner' ? 'gold' : 'emerald'}>
                        <View style={[styles.roleRow, isRTL && styles.rowRtl]}>
                          <View style={styles.roleIcon}>
                            <Feather name={role.icon} size={20} color={colors.gold} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.roleTitle, isRTL && styles.rtl]}>{t(`auth.role.${role.id}` as never)}</Text>
                            <Text style={[styles.roleHint, isRTL && styles.rtl]}>{t(`auth.role.${role.id}.hint` as never)}</Text>
                          </View>
                          <Feather name={isRTL ? 'chevron-left' : 'chevron-right'} size={18} color={colors.textMuted} />
                        </View>
                      </GlassCard>
                    </Pressable>
                  ))}
                </View>
                {error ? <Text style={styles.error}>{error}</Text> : null}
                {busy ? <ActivityIndicator color={colors.gold} style={{ marginTop: 16 }} /> : null}
                <Text style={[styles.safeNote, isRTL && styles.rtl]}>{t('auth.role.safe' as never)}</Text>
              </Animated.View>
            ) : null}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  back: {
    position: 'absolute',
    zIndex: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  backLtr: { left: spacing.lg },
  backRtl: { right: spacing.lg },
  footer: {
    paddingHorizontal: spacing.lg,
    gap: 10,
  },
  primaryBtn: {
    backgroundColor: colors.gold,
    borderRadius: radius.pill,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  primaryText: {
    color: colors.bg,
    fontSize: 16,
    fontWeight: typography.weight.semibold,
    letterSpacing: 0.2,
  },
  ghostBtn: {
    borderRadius: radius.pill,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  ghostText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: typography.weight.medium,
  },
  pressed: { opacity: 0.88, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.65 },
  formScroll: { paddingHorizontal: spacing.lg },
  formTitle: {
    color: colors.text,
    fontSize: 30,
    fontWeight: typography.weight.semibold,
    letterSpacing: -0.6,
  },
  formSub: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 23,
    marginTop: 8,
    marginBottom: spacing.lg,
  },
  formBody: { marginTop: 4 },
  segment: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: radius.pill,
    padding: 4,
    marginBottom: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  segmentRtl: { flexDirection: 'row-reverse' },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  segmentActive: { backgroundColor: colors.goldSoft },
  segmentText: { color: colors.textMuted, fontSize: 13, fontWeight: typography.weight.medium },
  segmentTextActive: { color: colors.gold },
  error: { color: colors.danger, fontSize: 13, marginBottom: 10, marginTop: 4 },
  linkWrap: { alignItems: 'center', marginTop: spacing.md },
  link: { color: colors.gold, fontSize: 14, fontWeight: typography.weight.medium },
  roleStack: { gap: spacing.sm },
  roleRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  rowRtl: { flexDirection: 'row-reverse' },
  roleIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.goldEdge,
  },
  roleTitle: { color: colors.text, fontSize: 17, fontWeight: typography.weight.semibold },
  roleHint: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginTop: 4 },
  safeNote: {
    color: colors.textSubtle,
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
});
