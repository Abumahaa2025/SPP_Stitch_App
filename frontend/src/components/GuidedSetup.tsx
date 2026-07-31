import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { GlassCard } from '@/src/components/GlassCard';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';
import type { GuidedFlowId } from '@/src/data/guided-flows';
import { GUIDED_FLOWS } from '@/src/data/guided-flows';

type Props = {
  flowId: GuidedFlowId;
  delay?: number;
  defaultOpen?: boolean;
  testID?: string;
};

/** Built-in step-by-step guidance — no external docs required. */
export function GuidedSetup({ flowId, delay = 80, defaultOpen = true, testID }: Props) {
  const { t, isRTL } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const flow = GUIDED_FLOWS[flowId];
  const prefix = `guided.${flowId}` as const;

  const steps = Array.from({ length: flow.stepCount }, (_, i) =>
    t(`${prefix}.step${i + 1}` as 'guided.property.step1'),
  );

  const goNext = () => {
    Haptics.selectionAsync();
    if (flow.route) router.push(flow.route as any);
  };

  return (
    <Animated.View entering={FadeInDown.duration(550).delay(delay)} style={{ marginBottom: spacing.md }}>
      <Pressable onPress={() => setOpen((v) => !v)} testID={testID}>
        <GlassCard padding={18} radiusToken="lg" edge="emerald">
          <View style={[styles.head, isRTL && styles.rowRtl]}>
            <Feather name="compass" size={14} color={colors.emerald} />
            <Text style={[styles.title, isRTL && styles.rtl]}>
              {t(`${prefix}.title` as 'guided.property.title')}
            </Text>
            <Feather name={open ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textMuted} />
          </View>
          {open ? (
            <View style={styles.body}>
              <Text style={[styles.lead, isRTL && styles.rtl]}>
                {t(`${prefix}.lead` as 'guided.property.lead')}
              </Text>
              {steps.map((step, i) => (
                <View key={i} style={[styles.stepRow, isRTL && styles.rowRtl]}>
                  <View style={styles.stepNum}>
                    <Text style={styles.stepNumText}>{i + 1}</Text>
                  </View>
                  <Text style={[styles.stepText, isRTL && styles.rtl]}>{step}</Text>
                </View>
              ))}
              <Text style={[styles.nextLabel, isRTL && styles.rtl]}>{t('guided.nextStep')}</Text>
              <Text style={[styles.nextText, isRTL && styles.rtl]}>
                {t(`${prefix}.next` as 'guided.property.next')}
              </Text>
              {flow.route ? (
                <Pressable style={styles.action} onPress={goNext} testID={`${testID}-action`}>
                  <Text style={styles.actionText}>{t('guided.openAction')}</Text>
                  <Feather name="arrow-up-right" size={13} color={colors.emerald} />
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </GlassCard>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowRtl: { flexDirection: 'row-reverse' },
  title: {
    flex: 1, color: colors.text, fontSize: 13, fontWeight: typography.weight.semibold,
    letterSpacing: -0.1,
  },
  body: { marginTop: spacing.md, gap: 10 },
  lead: { color: colors.textDim, fontSize: 13, lineHeight: 20 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  stepNum: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: colors.emeraldSoft, borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.emeraldEdge, alignItems: 'center', justifyContent: 'center',
  },
  stepNumText: { color: colors.emerald, fontSize: 11, fontWeight: typography.weight.semibold },
  stepText: { flex: 1, color: colors.textDim, fontSize: 13, lineHeight: 19 },
  nextLabel: {
    color: colors.textMuted, fontSize: 10, letterSpacing: 1.4,
    textTransform: 'uppercase', fontWeight: typography.weight.medium, marginTop: 4,
  },
  nextText: { color: colors.text, fontSize: 13.5, lineHeight: 21 },
  action: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    marginTop: 4, paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.emeraldEdge,
    backgroundColor: colors.emeraldSoft,
  },
  actionText: { color: colors.emerald, fontSize: 12.5, fontWeight: typography.weight.medium },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
});
