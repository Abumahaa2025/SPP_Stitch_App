import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { KeyboardAwareTextInput } from '@/src/components/KeyboardAwareTextInput';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { AmbientBackground } from '@/src/components/AmbientBackground';
import { BrandAnchor } from '@/src/components/BrandAnchor';
import { JourneyGuide } from '@/src/components/JourneyGuide';
import { api } from '@/src/api/client';
import { GlassCard } from '@/src/components/GlassCard';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';
import { storage } from '@/src/utils/storage';

const STEPS = 4;

const BENEFITS = [
  'onboarding.benefit.1',
  'onboarding.benefit.2',
  'onboarding.benefit.3',
] as const;

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, isRTL } = useI18n();
  const [step, setStep] = useState(0);
  const [ownerName, setOwnerName] = useState('');
  const [loadDemoOnFinish, setLoadDemoOnFinish] = useState(false);
  const [betaAuthed, setBetaAuthed] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    storage.getItem<boolean>('spp.betaAuthed', false).then((v) => setBetaAuthed(Boolean(v)));
  }, []);

  const scrollToInput = () => {
    setTimeout(() => scrollRef.current?.scrollTo({ y: 160, animated: true }), 100);
  };

  const q = (n: number, part: 'where' | 'now' | 'benefit' | 'next') =>
    t(`onboarding.q${n}.${part}` as any);

  const finish = async (target: '/' | '/setup/property-os' | '/upload') => {
    const betaAuthed = await storage.getItem<boolean>('spp.betaAuthed', false);
    const demoMode = await storage.getItem<boolean>('spp.demoMode', false);
    // Spec §2 — demo only when user explicitly chose it and session is not a real portfolio.
    if (!betaAuthed && loadDemoOnFinish) {
      try { await api.loadDemo(); await storage.setItem('spp.demoMode', true); } catch { /* empty ok */ }
    } else if (betaAuthed && !demoMode) {
      await storage.setItem('spp.demoMode', false);
    }
    await storage.setItem('spp.onboarded', true);
    const persona = await storage.getItem<string>('spp.betaPersona', '');
    if (persona === 'tenant') router.replace('/notifications');
    else if (persona === 'technician') router.replace('/maintenance');
    else router.replace(target as any);
  };

  const next = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (step === 1 && ownerName.trim()) {
      await storage.setItem('spp.ownerName', ownerName.trim());
    }
    if (step < STEPS - 1) {
      setStep((s) => s + 1);
      return;
    }
    // Spec §4 — owner continues into property setup, not an empty home.
    await finish('/setup/property-os');
  };

  const skip = async () => {
    await storage.setItem('spp.onboarded', true);
    const persona = await storage.getItem<string>('spp.betaPersona', '');
    if (persona === 'technician') router.replace('/maintenance' as any);
    else if (persona === 'tenant') router.replace('/notifications' as any);
    else router.replace('/setup/property-os' as any);
  };

  const ctaLabel =
    step === 0 ? t('onboarding.startNow')
      : step === STEPS - 1 ? t('onboarding.cta')
        : t('onboarding.continue');

  return (
    <View style={styles.root} testID="onboarding-screen">
      <StatusBar style="light" />
      <AmbientBackground />

      <View style={[styles.brandBar, { paddingTop: insets.top + spacing.sm }]}>
        <BrandAnchor testID="onboarding-brand" />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={insets.top + 64}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + 72, paddingBottom: insets.bottom + 140 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View style={styles.progressRow}>
            {Array.from({ length: STEPS }).map((_, i) => (
              <View key={i} style={[styles.progressDot, i <= step && styles.progressDotActive]} />
            ))}
          </View>
          <Text style={[styles.stepLabel, isRTL && styles.rtl]}>
            {t('onboarding.stepOf').replace('{n}', String(step + 1)).replace('{total}', String(STEPS))}
          </Text>

          <Animated.Text key={`t-${step}`} entering={FadeInDown.duration(500)} style={[styles.title, isRTL && styles.rtl]}>
            {t(`onboarding.step${step + 1}.title` as any)}
          </Animated.Text>
          <Animated.Text key={`b-${step}`} entering={FadeInDown.duration(500).delay(60)} style={[styles.body, isRTL && styles.rtl]}>
            {t(`onboarding.step${step + 1}.body` as any)}
          </Animated.Text>

          <JourneyGuide
            where={q(step + 1, 'where')}
            now={q(step + 1, 'now')}
            benefit={q(step + 1, 'benefit')}
            next={q(step + 1, 'next')}
            testID={`onboarding-guide-${step}`}
          />

          {step === 0 ? (
            <Animated.View entering={FadeIn.duration(400)} style={styles.benefits}>
              {BENEFITS.map((key, i) => (
                <GlassCard key={key} padding={14} radiusToken="md" edge={i === 2 ? 'emerald' : 'neutral'}>
                  <View style={[styles.benefitRow, isRTL && styles.rowRtl]}>
                    <View style={styles.benefitDot} />
                    <Text style={[styles.benefitText, isRTL && styles.rtl]}>{t(key as any)}</Text>
                  </View>
                </GlassCard>
              ))}
            </Animated.View>
          ) : null}

          {step === 1 ? (
            <Animated.View entering={FadeIn.duration(400)} style={styles.fieldWrap}>
              <GlassCard padding={18} radiusToken="md">
                <Text style={[styles.fieldLabel, isRTL && styles.rtl]}>{t('onboarding.ownerLabel')}</Text>
                <KeyboardAwareTextInput
                  testID="onboarding-owner-name"
                  value={ownerName}
                  onChangeText={setOwnerName}
                  placeholder={t('onboarding.ownerPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  style={[styles.input, isRTL && styles.rtlInput]}
                  textAlign={isRTL ? 'right' : 'left'}
                  onFocus={scrollToInput}
                />
              </GlassCard>
            </Animated.View>
          ) : null}

          {step === 2 ? (
            <Animated.View entering={FadeIn.duration(400)} style={{ gap: spacing.sm }}>
              <GlassCard padding={18} radiusToken="md">
                <Text style={[styles.hint, isRTL && styles.rtl]}>{t('onboarding.importHint')}</Text>
                <Pressable
                  style={styles.linkRow}
                  onPress={async () => {
                    Haptics.selectionAsync();
                    if (ownerName.trim()) await storage.setItem('spp.ownerName', ownerName.trim());
                    await finish('/upload');
                  }}
                >
                  <Feather name="upload-cloud" size={16} color={colors.gold} />
                  <Text style={styles.linkText}>{t('onboarding.openUpload')}</Text>
                </Pressable>
              </GlassCard>
              <GlassCard padding={18} radiusToken="md" edge={!loadDemoOnFinish ? 'emerald' : 'neutral'}>
                <Pressable onPress={() => setLoadDemoOnFinish(false)}>
                  <Text style={[styles.choiceTitle, isRTL && styles.rtl]}>{t('onboarding.startEmpty')}</Text>
                  <Text style={[styles.hint, isRTL && styles.rtl]}>{t('onboarding.startEmptyHint')}</Text>
                </Pressable>
              </GlassCard>
              {/* Spec §2 — no sample portfolio for real authenticated accounts. */}
              {!betaAuthed ? (
                <GlassCard padding={18} radiusToken="md" edge={loadDemoOnFinish ? 'gold' : 'neutral'}>
                  <Pressable onPress={() => setLoadDemoOnFinish(true)}>
                    <Text style={[styles.choiceTitle, isRTL && styles.rtl]}>{t('onboarding.loadDemo')}</Text>
                    <Text style={[styles.hint, isRTL && styles.rtl]}>{t('onboarding.loadDemoHint')}</Text>
                  </Pressable>
                </GlassCard>
              ) : null}
            </Animated.View>
          ) : null}

          {step === 3 ? (
            <Animated.View entering={FadeIn.duration(400)} style={{ gap: spacing.sm }}>
              <GlassCard padding={18} radiusToken="md" edge="emerald">
                <Text style={[styles.ready, isRTL && styles.rtl]}>{t('onboarding.readyLead')}</Text>
                <Text style={[styles.nextLine, isRTL && styles.rtl]}>{t('onboarding.nextSetup')}</Text>
              </GlassCard>
              <Pressable
                onPress={async () => {
                  Haptics.selectionAsync();
                  await finish('/setup/property-os');
                }}
                style={styles.learnLink}
              >
                <Feather name="home" size={16} color={colors.emerald} />
                <Text style={[styles.linkText, { color: colors.emerald }]}>{t('onboarding.openSetup')}</Text>
              </Pressable>
            </Animated.View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.footer, { bottom: insets.bottom + spacing.lg }]}>
        <Pressable onPress={skip} hitSlop={8}>
          <Text style={styles.skip}>{t('onboarding.skip')}</Text>
        </Pressable>
        <Pressable
          testID="onboarding-cta"
          onPress={next}
          style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.ctaText}>{ctaLabel}</Text>
          <Feather name={isRTL ? 'arrow-left' : 'arrow-right'} size={16} color={colors.bg} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  brandBar: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: 'rgba(6,11,20,0.92)',
  },
  content: { paddingHorizontal: spacing.xl },
  progressRow: { flexDirection: 'row', gap: 6, marginBottom: spacing.md },
  progressDot: {
    flex: 1, height: 3, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  progressDotActive: { backgroundColor: colors.gold },
  stepLabel: {
    color: colors.textMuted, fontSize: 11, letterSpacing: 1.4,
    textTransform: 'uppercase', marginBottom: spacing.sm,
  },
  title: {
    color: colors.text, fontSize: 28, lineHeight: 36,
    fontWeight: typography.weight.semibold, letterSpacing: -0.5,
  },
  body: {
    color: colors.textMuted, fontSize: 15, lineHeight: 24,
    marginTop: spacing.md, marginBottom: spacing.lg,
  },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  rowRtl: { flexDirection: 'row-reverse' },
  benefits: { gap: spacing.sm, marginBottom: spacing.md },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  benefitDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: colors.gold,
  },
  benefitText: { flex: 1, color: colors.text, fontSize: 15, fontWeight: typography.weight.medium, lineHeight: 22 },
  fieldWrap: { marginTop: spacing.sm },
  fieldLabel: { color: colors.textDim, fontSize: 12, marginBottom: 8 },
  input: {
    color: colors.text, fontSize: 16, paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  rtlInput: { writingDirection: 'rtl' },
  hint: { color: colors.textDim, fontSize: 14, lineHeight: 22 },
  choiceTitle: { color: colors.text, fontSize: 15, fontWeight: typography.weight.semibold, marginBottom: 6 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: spacing.md },
  linkText: { color: colors.gold, fontSize: 14, fontWeight: typography.weight.medium },
  ready: { color: colors.emerald, fontSize: 15, lineHeight: 22, fontWeight: typography.weight.medium },
  nextLine: { color: colors.textDim, fontSize: 14, lineHeight: 21, marginTop: 8 },
  learnLink: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  footer: {
    position: 'absolute', left: spacing.lg, right: spacing.lg,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md,
  },
  skip: { color: colors.textMuted, fontSize: 13 },
  cta: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, backgroundColor: colors.gold,
    height: 52, borderRadius: radius.pill,
    maxWidth: 260,
  },
  ctaText: { color: colors.bg, fontSize: 15, fontWeight: typography.weight.semibold },
});
