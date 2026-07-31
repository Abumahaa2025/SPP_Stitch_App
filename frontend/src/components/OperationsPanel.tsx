import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { GlassCard } from '@/src/components/GlassCard';
import { AppIcon } from '@/src/components/ui/AppIcon';
import { PressableScale } from '@/src/components/ui/PressableScale';
import { OPERATION_TOOLS } from '@/src/data/operations';
import { openSourcePortal } from '@/src/utils/source-web';
import { colors, spacing, typography } from '@/src/theme';
import { useI18n } from '@/src/i18n';

type Props = {
  delay?: number;
  compact?: boolean;
  testID?: string;
};

/** Visible operational capabilities — web power integrated into the OS. */
export function OperationsPanel({ delay = 120, compact, testID = 'operations-panel' }: Props) {
  const { t, isRTL } = useI18n();
  const router = useRouter();
  const tools = compact ? OPERATION_TOOLS.slice(0, 4) : OPERATION_TOOLS;

  return (
    <Animated.View entering={FadeInDown.duration(600).delay(delay)} style={styles.wrap} testID={testID}>
      <Text style={[styles.title, isRTL && styles.rtl]}>{t('ops.title')}</Text>
      <Text style={[styles.sub, isRTL && styles.rtl]} numberOfLines={2}>{t('ops.subShort')}</Text>
      <View style={styles.grid}>
        {tools.map((op) => (
          <PressableScale
            key={op.key}
            testID={`op-${op.key}`}
            onPress={async () => {
              Haptics.selectionAsync();
              if (op.sourceApp && await openSourcePortal(op.sourceApp)) return;
              if (op.route) router.push(op.route as any);
            }}
            style={styles.tileWrap}
          >
            <GlassCard padding={16} radiusToken="md" edge={op.accent ?? 'neutral'}>
              <View style={styles.tile}>
                <View style={styles.iconWrap}>
                  <AppIcon
                    name={op.icon}
                    size="md"
                    accent={op.accent === 'emerald' ? 'emerald' : 'gold'}
                  />
                </View>
                <Text style={[styles.tileLabel, isRTL && styles.rtl]} numberOfLines={2}>
                  {t(op.labelKey as 'ops.ownerPortal')}
                </Text>
              </View>
            </GlassCard>
          </PressableScale>
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing['2xl'] },
  title: {
    color: colors.text, fontSize: 18, fontWeight: typography.weight.semibold,
    letterSpacing: typography.letter.tight,
  },
  sub: { color: colors.textDim, fontSize: 12.5, lineHeight: 19, marginTop: 4, marginBottom: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tileWrap: { width: '48%' },
  tile: { gap: 12, minHeight: 68, justifyContent: 'center' },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  tileLabel: { color: colors.text, fontSize: 13, fontWeight: typography.weight.medium, lineHeight: 18 },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
});
