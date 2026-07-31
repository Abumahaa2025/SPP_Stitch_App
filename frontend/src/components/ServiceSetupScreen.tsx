import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Alert,
} from 'react-native';
import { KeyboardAwareTextInput } from '@/src/components/KeyboardAwareTextInput';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

import { ScreenScaffold } from '@/src/components/ScreenScaffold';
import { StoryScreenHeader } from '@/src/components/StoryScreenHeader';
import { GlassCard } from '@/src/components/GlassCard';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';
import { useConnections, type ServiceKey } from '@/src/hooks/useConnections';

type FieldDef = {
  key: string;
  labelKey: string;
  placeholderKey: string;
  secure?: boolean;
  keyboard?: 'default' | 'email-address' | 'url';
};

type SetupDef = {
  serviceKey: ServiceKey;
  icon: keyof typeof Feather.glyphMap;
  stepCount: number;
  fields: FieldDef[][];
};

export const SETUP_DEFS: Record<string, SetupDef> = {
  sheets: {
    serviceKey: 'sheets',
    icon: 'database',
    stepCount: 4,
    fields: [
      [{ key: 'googleAccount', labelKey: 'setup.sheets.field.account', placeholderKey: 'setup.sheets.field.accountPh' }],
      [{ key: 'spreadsheetId', labelKey: 'setup.sheets.field.sheetId', placeholderKey: 'setup.sheets.field.sheetIdPh' }],
      [{ key: 'tabName', labelKey: 'setup.sheets.field.tab', placeholderKey: 'setup.sheets.field.tabPh' }],
      [],
    ],
  },
  whatsapp: {
    serviceKey: 'whatsapp',
    icon: 'message-circle',
    stepCount: 4,
    fields: [
      [{ key: 'phone', labelKey: 'setup.whatsapp.field.phone', placeholderKey: 'setup.whatsapp.field.phonePh', keyboard: 'default' }],
      [{ key: 'businessName', labelKey: 'setup.whatsapp.field.business', placeholderKey: 'setup.whatsapp.field.businessPh' }],
      [{ key: 'webhookUrl', labelKey: 'setup.whatsapp.field.webhook', placeholderKey: 'setup.whatsapp.field.webhookPh', keyboard: 'url' }],
      [],
    ],
  },
  greenApi: {
    serviceKey: 'greenApi',
    icon: 'cpu',
    stepCount: 4,
    fields: [
      [{ key: 'instanceId', labelKey: 'setup.greenApi.field.instance', placeholderKey: 'setup.greenApi.field.instancePh' }],
      [{ key: 'apiToken', labelKey: 'setup.greenApi.field.token', placeholderKey: 'setup.greenApi.field.tokenPh', secure: true }],
      [{ key: 'phone', labelKey: 'setup.greenApi.field.phone', placeholderKey: 'setup.greenApi.field.phonePh' }],
      [],
    ],
  },
  email: {
    serviceKey: 'email',
    icon: 'mail',
    stepCount: 4,
    fields: [
      [{ key: 'fromEmail', labelKey: 'setup.email.field.from', placeholderKey: 'setup.email.field.fromPh', keyboard: 'email-address' }],
      [{ key: 'smtpHost', labelKey: 'setup.email.field.host', placeholderKey: 'setup.email.field.hostPh' }],
      [{ key: 'smtpUser', labelKey: 'setup.email.field.user', placeholderKey: 'setup.email.field.userPh' }],
      [{ key: 'smtpPass', labelKey: 'setup.email.field.pass', placeholderKey: 'setup.email.field.passPh', secure: true }],
    ],
  },
  homeAssistant: {
    serviceKey: 'homeAssistant',
    icon: 'home',
    stepCount: 4,
    fields: [
      [{ key: 'url', labelKey: 'setup.homeAssistant.field.url', placeholderKey: 'setup.homeAssistant.field.urlPh', keyboard: 'url' }],
      [{ key: 'token', labelKey: 'setup.homeAssistant.field.token', placeholderKey: 'setup.homeAssistant.field.tokenPh', secure: true }],
      [{ key: 'entityPrefix', labelKey: 'setup.homeAssistant.field.prefix', placeholderKey: 'setup.homeAssistant.field.prefixPh' }],
      [],
    ],
  },
  backup: {
    serviceKey: 'sheets',
    icon: 'hard-drive',
    stepCount: 3,
    fields: [[], [], []],
  },
  import: {
    serviceKey: 'sheets',
    icon: 'download',
    stepCount: 3,
    fields: [[], [], []],
  },
  security: {
    serviceKey: 'email',
    icon: 'shield',
    stepCount: 3,
    fields: [[], [], []],
  },
  account: {
    serviceKey: 'email',
    icon: 'user',
    stepCount: 3,
    fields: [[], [], []],
  },
};

type Props = { flowId: keyof typeof SETUP_DEFS };

export function ServiceSetupScreen({ flowId }: Props) {
  const { t, isRTL } = useI18n();
  const router = useRouter();
  const def = SETUP_DEFS[flowId];
  const { connections, completeStep, disconnect } = useConnections();
  const svc = connections[def.serviceKey];
  const prefix = `setup.${flowId}` as const;

  const [step, setStep] = useState(Math.max(1, svc.completedSteps + 1));
  const [draft, setDraft] = useState<Record<string, string>>({ ...svc.fields });

  const totalSteps = def.stepCount;
  const isInfoOnly = def.fields.every((f) => f.length === 0);

  const stepTitle = t(`${prefix}.step${step}.title` as 'setup.sheets.step1.title');
  const stepBody = t(`${prefix}.step${step}.body` as 'setup.sheets.step1.body');
  const fields = def.fields[step - 1] ?? [];

  const canContinue = fields.length === 0 || fields.every((f) => (draft[f.key]?.trim() ?? '').length > 0);

  const onContinue = () => {
    Haptics.selectionAsync();
    if (!canContinue) return;
    const fieldPatch: Record<string, string> = {};
    fields.forEach((f) => { if (draft[f.key]) fieldPatch[f.key] = draft[f.key]; });
    completeStep(def.serviceKey, step, fieldPatch);
    if (step >= totalSteps) {
      Alert.alert(t('setup.complete.title'), t('setup.complete.body'), [
        { text: t('common.done'), onPress: () => router.back() },
      ]);
      return;
    }
    setStep(step + 1);
  };

  const onDisconnect = () => {
    Alert.alert(t('setup.disconnect.title'), t('setup.disconnect.body'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('setup.disconnect.confirm'),
        style: 'destructive',
        onPress: () => { disconnect(def.serviceKey); router.back(); },
      },
    ]);
  };

  return (
    <ScreenScaffold testID={`setup-${flowId}`}>
      <StoryScreenHeader
        question={t(`${prefix}.title` as 'setup.sheets.title')}
        hint={t(`${prefix}.subtitle` as 'setup.sheets.subtitle')}
        showBack
        testID={`setup-${flowId}-header`}
      />

      <Animated.View entering={FadeInDown.duration(550)}>
        <GlassCard padding={20} radiusToken="lg" edge="gold">
          <View style={[styles.progressRow, isRTL && styles.rowRtl]}>
            <Feather name={def.icon} size={16} color={colors.gold} />
            <Text style={styles.progressText}>
              {t('setup.stepOf').replace('{n}', String(step)).replace('{total}', String(totalSteps))}
            </Text>
            {svc.connected ? (
              <View style={styles.connectedChip}>
                <View style={styles.connectedDot} />
                <Text style={styles.connectedText}>{t('settings.services.status.connected')}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${(step / totalSteps) * 100}%` }]} />
          </View>
        </GlassCard>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(600).delay(80)} style={{ marginTop: spacing.md }}>
        <GlassCard padding={22} radiusToken="lg" edge="emerald">
          <Text style={[styles.stepTitle, isRTL && styles.rtl]}>{stepTitle}</Text>
          <Text style={[styles.stepBody, isRTL && styles.rtl]}>{stepBody}</Text>
          {fields.map((f) => (
            <View key={f.key} style={{ marginTop: spacing.md }}>
              <Text style={[styles.fieldLabel, isRTL && styles.rtl]}>
                {t(f.labelKey as 'setup.sheets.field.account')}
              </Text>
              <KeyboardAwareTextInput
                testID={`setup-field-${f.key}`}
                value={draft[f.key] ?? ''}
                onChangeText={(v) => setDraft((d) => ({ ...d, [f.key]: v }))}
                placeholder={t(f.placeholderKey as 'setup.sheets.field.accountPh')}
                placeholderTextColor={colors.textSubtle}
                secureTextEntry={f.secure}
                keyboardType={f.keyboard ?? 'default'}
                autoCapitalize="none"
                style={[styles.input, isRTL && styles.inputRtl]}
              />
            </View>
          ))}
        </GlassCard>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(600).delay(140)} style={{ marginTop: spacing.md, gap: spacing.sm }}>
        <Pressable
          testID={`setup-${flowId}-continue`}
          onPress={onContinue}
          disabled={!canContinue}
          style={[styles.primaryBtn, !canContinue && styles.primaryBtnDisabled]}
        >
          <Text style={styles.primaryBtnText}>
            {step >= totalSteps ? t('setup.finish') : isInfoOnly ? t('setup.acknowledge') : t('setup.continue')}
          </Text>
          <Feather name="arrow-right" size={14} color={colors.bg} />
        </Pressable>
        {svc.connected ? (
          <Pressable onPress={onDisconnect} style={styles.secondaryBtn}>
            <Text style={styles.secondaryBtnText}>{t('setup.disconnect.confirm')}</Text>
          </Pressable>
        ) : null}
      </Animated.View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowRtl: { flexDirection: 'row-reverse' },
  progressText: { flex: 1, color: colors.textMuted, fontSize: 12, letterSpacing: 0.3 },
  progressBar: {
    height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)', marginTop: 14, overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: colors.gold, borderRadius: 2 },
  connectedChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill,
    backgroundColor: colors.emeraldSoft, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.emeraldEdge,
  },
  connectedDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.emerald },
  connectedText: { color: colors.emerald, fontSize: 9, letterSpacing: 0.8, fontWeight: typography.weight.medium },
  stepTitle: { color: colors.text, fontSize: 17, fontWeight: typography.weight.semibold, letterSpacing: -0.3 },
  stepBody: { color: colors.textDim, fontSize: 13.5, lineHeight: 21, marginTop: 8 },
  fieldLabel: { color: colors.textMuted, fontSize: 11, letterSpacing: 0.8, marginBottom: 6 },
  input: {
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: 14, paddingVertical: 12, color: colors.text, fontSize: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  inputRtl: { textAlign: 'right', writingDirection: 'rtl' },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.emerald, borderRadius: radius.md, paddingVertical: 16,
  },
  primaryBtnDisabled: { opacity: 0.45 },
  primaryBtnText: { color: colors.bg, fontSize: 14, fontWeight: typography.weight.semibold },
  secondaryBtn: { alignItems: 'center', paddingVertical: 12 },
  secondaryBtnText: { color: colors.danger, fontSize: 13 },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
});
