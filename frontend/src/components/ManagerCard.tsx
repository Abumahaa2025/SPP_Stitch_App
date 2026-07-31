import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { GlassCard } from '@/src/components/GlassCard';
import type { ManagerDef } from '@/src/data/managers';
import { colors, spacing, typography } from '@/src/theme';
import { useI18n } from '@/src/i18n';

type Props = {
  manager: ManagerDef;
  proactive: string;
  delay?: number;
  compact?: boolean;
};

export function ManagerCard({ manager, proactive, delay = 0, compact }: Props) {
  const { t, isRTL } = useI18n();
  const router = useRouter();

  return (
    <Animated.View entering={FadeInDown.duration(500).delay(delay)}>
      <Pressable
        testID={`manager-${manager.key}`}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push(manager.route as any);
        }}
      >
        <GlassCard
          padding={compact ? 18 : 22}
          radiusToken="lg"
          edge={manager.featured ? 'gold' : 'neutral'}
        >
          <View style={styles.row}>
            <Text style={styles.emoji}>{manager.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, isRTL && styles.rtl]}>{t(manager.titleKey as 'os.manager.property')}</Text>
              {!compact ? (
                <Text style={[styles.role, isRTL && styles.rtl]}>{t(manager.roleKey as 'os.role.property')}</Text>
              ) : null}
              <Text style={[styles.proactive, isRTL && styles.rtl]} numberOfLines={2}>
                {proactive}
              </Text>
              {!compact ? (
                <View style={styles.actionRow}>
                  <Text style={[styles.actionLabel, isRTL && styles.rtl]}>
                    {t(manager.actionKey as 'os.action.property')}
                  </Text>
                  <Feather name={isRTL ? 'arrow-left' : 'arrow-right'} size={12} color={colors.gold} />
                </View>
              ) : null}
            </View>
            <Feather name={isRTL ? 'chevron-left' : 'chevron-right'} size={16} color={colors.textMuted} />
          </View>
        </GlassCard>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  emoji: { fontSize: 28, lineHeight: 34, marginTop: 2 },
  name: {
    color: colors.text,
    fontSize: 16,
    fontWeight: typography.weight.semibold,
    letterSpacing: typography.letter.tight,
  },
  role: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
    letterSpacing: 0.3,
  },
  proactive: {
    color: colors.gold,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
    fontWeight: typography.weight.medium,
  },
  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10,
  },
  actionLabel: {
    color: colors.gold, fontSize: 12, fontWeight: typography.weight.semibold,
  },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
});
