import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { KeyboardAwareTextInput } from '@/src/components/KeyboardAwareTextInput';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  example?: string;
  keyboard?: 'default' | 'numeric' | 'email-address' | 'phone-pad';
  testID?: string;
  required?: boolean;
  hint?: string;
  error?: string;
};

function FieldLabel({ label, required, isRTL }: { label: string; required?: boolean; isRTL: boolean }) {
  const { t } = useI18n();
  return (
    <View style={[styles.labelRow, isRTL && styles.rowRtl]}>
      <Text style={[styles.label, isRTL && styles.rtl]}>{label}</Text>
      <Text style={[styles.badge, required ? styles.badgeReq : styles.badgeOpt]}>
        {required ? `🔴 ${t('pos.field.required')}` : `⚪ ${t('pos.field.optional')}`}
      </Text>
    </View>
  );
}

export function WizardTextField({
  label, value, onChangeText, placeholder, example, keyboard = 'default', testID,
  required = false, hint, error,
}: FieldProps) {
  const { t, isRTL } = useI18n();
  return (
    <View style={{ marginTop: spacing.md }}>
      <FieldLabel label={label} required={required} isRTL={isRTL} />
      {hint ? <Text style={[styles.hint, isRTL && styles.rtl]}>{hint}</Text> : null}
      <KeyboardAwareTextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSubtle}
        keyboardType={keyboard}
        style={[
          styles.input,
          isRTL && styles.inputRtl,
          error ? styles.inputError : null,
        ]}
      />
      {example ? (
        <Text style={[styles.example, isRTL && styles.rtl]}>
          {t('journey.field.example')}: {example}
        </Text>
      ) : null}
      {error ? <Text style={[styles.error, isRTL && styles.rtl]}>{error}</Text> : null}
    </View>
  );
}

type Option<T extends string> = { value: T; label: string };

type ChipProps<T extends string> = {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
  testID?: string;
  required?: boolean;
  hint?: string;
  error?: string;
};

export function WizardChipGroup<T extends string>({
  label, options, value, onChange, testID,
  required = false, hint, error,
}: ChipProps<T>) {
  const { isRTL } = useI18n();
  return (
    <View style={{ marginTop: spacing.md }}>
      <FieldLabel label={label} required={required} isRTL={isRTL} />
      {hint ? <Text style={[styles.hint, isRTL && styles.rtl]}>{hint}</Text> : null}
      <View style={[styles.chipRow, isRTL && styles.rowRtl]}>
        {options.map((o) => {
          const active = o.value === value;
          return (
            <Pressable
              key={o.value}
              testID={testID ? `${testID}-${o.value}` : undefined}
              onPress={() => onChange(o.value)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text style={[styles.error, isRTL && styles.rtl]}>{error}</Text> : null}
    </View>
  );
}

type ToggleProps = {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  testID?: string;
  hint?: string;
};

export function WizardToggle({ label, value, onChange, testID, hint }: ToggleProps) {
  const { isRTL } = useI18n();
  return (
    <View style={{ marginTop: spacing.sm }}>
      <Pressable
        testID={testID}
        onPress={() => onChange(!value)}
        style={[styles.toggleRow, isRTL && styles.rowRtl]}
      >
        <View style={[styles.checkbox, value && styles.checkboxOn]}>
          {value ? <Text style={styles.checkMark}>✓</Text> : null}
        </View>
        <View style={{ flex: 1 }}>
          <View style={[styles.labelRow, isRTL && styles.rowRtl]}>
            <Text style={[styles.toggleLabel, isRTL && styles.rtl]}>{label}</Text>
            <Text style={[styles.badge, styles.badgeOpt]}>⚪</Text>
          </View>
          {hint ? <Text style={[styles.hint, isRTL && styles.rtl, { marginTop: 2 }]}>{hint}</Text> : null}
        </View>
      </Pressable>
    </View>
  );
}

type InfoProps = { why: string; example: string };

export function WizardInfoBox({ why, example }: InfoProps) {
  const { t, isRTL } = useI18n();
  return (
    <View style={styles.infoBox}>
      <Text style={[styles.infoLabel, isRTL && styles.rtl]}>{t('pos.wizard.why')}</Text>
      <Text style={[styles.infoText, isRTL && styles.rtl]}>{why}</Text>
      <Text style={[styles.infoLabel, isRTL && styles.rtl, { marginTop: 10 }]}>{t('pos.wizard.example')}</Text>
      <Text style={[styles.infoExample, isRTL && styles.rtl]}>{example}</Text>
    </View>
  );
}

/** Short intro shown at the start of each wizard phase. */
export function WizardPhaseIntro({ text }: { text: string }) {
  const { isRTL } = useI18n();
  return (
    <View style={styles.introBox}>
      <Text style={[styles.introText, isRTL && styles.rtl]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 },
  label: { color: colors.textMuted, fontSize: 11, letterSpacing: 0.6, flex: 1 },
  badge: { fontSize: 9.5, letterSpacing: 0.2 },
  badgeReq: { color: colors.danger },
  badgeOpt: { color: colors.textSubtle },
  hint: { color: colors.textSubtle, fontSize: 11.5, lineHeight: 17, marginBottom: 6 },
  example: { color: colors.textMuted, fontSize: 11.5, marginTop: 6, lineHeight: 17 },
  error: { color: colors.danger, fontSize: 11.5, marginTop: 6, lineHeight: 17 },
  input: {
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: 14, paddingVertical: 12, color: colors.text, fontSize: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  inputError: { borderColor: colors.danger },
  inputRtl: { textAlign: 'right', writingDirection: 'rtl' },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  rowRtl: { flexDirection: 'row-reverse' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  chipActive: { borderColor: colors.goldEdge, backgroundColor: colors.goldSoft },
  chipText: { color: colors.textDim, fontSize: 12 },
  chipTextActive: { color: colors.gold },
  toggleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  checkbox: {
    width: 20, height: 20, borderRadius: 4, borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  checkboxOn: { backgroundColor: colors.emeraldSoft, borderColor: colors.emeraldEdge },
  checkMark: { color: colors.emerald, fontSize: 12, fontWeight: typography.weight.bold },
  toggleLabel: { color: colors.textDim, fontSize: 13 },
  infoBox: {
    marginTop: spacing.md, padding: 12, borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  infoLabel: {
    color: colors.textMuted, fontSize: 10, letterSpacing: 1.2,
    textTransform: 'uppercase', fontWeight: typography.weight.medium,
  },
  infoText: { color: colors.textDim, fontSize: 12.5, lineHeight: 19, marginTop: 4 },
  infoExample: { color: colors.gold, fontSize: 12, lineHeight: 18, marginTop: 4 },
  introBox: {
    padding: 12, borderRadius: radius.md, marginBottom: spacing.sm,
    backgroundColor: colors.goldSoft, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.goldEdge,
  },
  introText: { color: colors.text, fontSize: 13.5, lineHeight: 21, fontWeight: typography.weight.medium },
});
