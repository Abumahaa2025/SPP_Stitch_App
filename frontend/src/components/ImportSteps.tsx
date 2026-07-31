import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';

const STEP_KEYS = [
  'upload.step.1',
  'upload.step.2',
  'upload.step.3',
  'upload.step.4',
  'upload.step.5',
  'upload.step.6',
  'upload.step.7',
] as const;

type Props = {
  activeStep: number;
};

/** Source web 7-step import wizard — ① رفع → … → ⑦ تقرير */
export function ImportSteps({ activeStep }: Props) {
  const { t } = useI18n();

  return (
    <View style={styles.wrap}>
      {STEP_KEYS.map((key, i) => {
        const step = i + 1;
        const active = step === activeStep;
        const done = step < activeStep;
        return (
          <View
            key={key}
            style={[styles.step, active && styles.stepActive, done && styles.stepDone]}
          >
            <Text style={[styles.stepText, (active || done) && styles.stepTextActive]} numberOfLines={1}>
              {t(key)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  step: {
    paddingHorizontal: 8, paddingVertical: 6, borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  stepActive: { borderColor: colors.goldEdge, backgroundColor: colors.goldSoft },
  stepDone: { borderColor: colors.emeraldEdge, backgroundColor: colors.emeraldSoft },
  stepText: { color: colors.textMuted, fontSize: 9.5, fontWeight: typography.weight.medium },
  stepTextActive: { color: colors.text },
});
