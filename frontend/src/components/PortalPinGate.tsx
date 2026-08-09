/**
 * PortalPinGate — password/PIN screen so the tenant link opens like an app login.
 * Preserves SPP glass/theme identity.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';

import { GlassCard } from '@/src/components/GlassCard';
import { KeyboardAwareTextInput } from '@/src/components/KeyboardAwareTextInput';
import { PortalInstallHint } from '@/src/components/PortalInstallHint';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';
import { storage } from '@/src/utils/storage';

type Props = {
  role: 'tenant' | 'tech';
  subjectId: string;
  /** Expected PIN (portalPin or derived from token). */
  expectedPin: string;
  displayName?: string;
  onUnlocked: () => void;
};

function authKey(role: string, subjectId: string) {
  return `spp.portalAuth.${role}.${subjectId}`;
}

export function PortalPinGate({
  role,
  subjectId,
  expectedPin,
  displayName,
  onUnlocked,
}: Props) {
  const { isRTL, lang } = useI18n();
  const ar = lang === 'ar' || !!isRTL;
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const ok = await storage.getItem<boolean>(authKey(role, subjectId), false);
      if (!alive) return;
      if (ok) onUnlocked();
      else setChecking(false);
    })();
    return () => { alive = false; };
  }, [role, subjectId, onUnlocked]);

  if (checking) {
    return (
      <View style={styles.wrap} testID="portal-pin-checking">
        <Text style={[styles.hint, isRTL && styles.rtl]}>
          {ar ? 'جاري تجهيز الدخول…' : 'Preparing sign-in…'}
        </Text>
      </View>
    );
  }

  const submit = async () => {
    const typed = pin.trim();
    if (!expectedPin) {
      // No PIN configured — allow through and persist session.
      await storage.setItem(authKey(role, subjectId), true);
      onUnlocked();
      return;
    }
    if (typed !== String(expectedPin).trim()) {
      setError(ar ? 'كلمة السر غير صحيحة' : 'Incorrect password');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    await storage.setItem(authKey(role, subjectId), true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onUnlocked();
  };

  return (
    <View style={styles.wrap} testID="portal-pin-gate">
      <Text style={[styles.brand, isRTL && styles.rtl]}>Smart Property Platform</Text>
      <Text style={[styles.title, isRTL && styles.rtl]}>
        {role === 'tech'
          ? (ar ? 'دخول بوابة الفني' : 'Technician portal login')
          : (ar ? 'دخول بوابة المستأجر' : 'Tenant portal login')}
      </Text>
      {displayName ? (
        <Text style={[styles.hint, isRTL && styles.rtl]}>
          {ar ? `مرحباً، ${displayName}` : `Welcome, ${displayName}`}
        </Text>
      ) : null}

      <PortalInstallHint role={role} />

      <GlassCard padding={18} radiusToken="md" edge="gold" style={styles.card}>
        <Text style={[styles.label, isRTL && styles.rtl]}>
          {ar ? 'كلمة السر / رمز الدخول' : 'Password / PIN'}
        </Text>
        <KeyboardAwareTextInput
          value={pin}
          onChangeText={(v) => { setPin(v); setError(''); }}
          placeholder={ar ? 'أدخل كلمة السر المرسلة مع الرابط' : 'Enter the password sent with the link'}
          placeholderTextColor={colors.textSubtle}
          secureTextEntry
          keyboardType="number-pad"
          style={[styles.input, isRTL && styles.rtl]}
          testID="portal-pin-input"
        />
        {error ? <Text style={[styles.error, isRTL && styles.rtl]}>{error}</Text> : null}
        <Pressable style={styles.btn} onPress={submit} testID="portal-pin-submit">
          <Text style={styles.btnText}>{ar ? 'دخول البوابة' : 'Enter portal'}</Text>
        </Pressable>
        <Text style={[styles.tip, isRTL && styles.rtl]}>
          {ar
            ? 'ثبّت الرابط كتطبيق من الشاشة الرئيسية بعد الدخول ليظهر كأيقونة على جوالك.'
            : 'After login, install this link to your home screen so it opens like an app.'}
        </Text>
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm, marginBottom: spacing.md },
  brand: { color: colors.gold, fontSize: 11, letterSpacing: 1 },
  title: {
    color: colors.text, fontSize: 20, fontWeight: typography.weight.semibold, marginBottom: 4,
  },
  hint: { color: colors.textDim, fontSize: 13, marginBottom: 8 },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  card: { marginTop: spacing.sm },
  label: {
    color: colors.textMuted, fontSize: 11, letterSpacing: 0.8,
    textTransform: 'uppercase', marginBottom: 8,
  },
  input: {
    borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    padding: 12, color: colors.text, minHeight: 48,
  },
  error: { color: '#F87171', fontSize: 12, marginTop: 8 },
  btn: {
    marginTop: 14, padding: 14, borderRadius: radius.md,
    backgroundColor: colors.emerald, alignItems: 'center',
  },
  btnText: { color: colors.bg, fontWeight: typography.weight.semibold, fontSize: 15 },
  tip: { color: colors.textSubtle, fontSize: 11, lineHeight: 16, marginTop: 12 },
});
