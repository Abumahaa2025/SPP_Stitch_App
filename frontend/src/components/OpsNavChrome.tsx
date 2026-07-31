/**
 * WP-6 — Consistent ops navigation: back + breadcrumb + property + result count.
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

import { colors, spacing, typography } from '@/src/theme';

type Props = {
  crumbs: string[];
  propertyName?: string;
  resultCount?: number;
  resultLabel?: string;
  onBack?: () => void;
  rtl?: boolean;
  testID?: string;
};

export function OpsNavChrome({
  crumbs,
  propertyName,
  resultCount,
  resultLabel,
  onBack,
  rtl,
  testID = 'ops-nav',
}: Props) {
  const router = useRouter();
  return (
    <View style={styles.wrap} testID={testID}>
      <View style={[styles.top, rtl && styles.rowRtl]}>
        <Pressable
          testID={`${testID}-back`}
          onPress={() => {
            Haptics.selectionAsync();
            if (onBack) onBack();
            else if (router.canGoBack()) router.back();
            else router.push('/owner' as any);
          }}
          style={styles.backBtn}
          hitSlop={8}
        >
          <Feather name={rtl ? 'chevron-right' : 'chevron-left'} size={18} color={colors.gold} />
          <Text style={styles.backText}>{rtl ? 'رجوع' : 'Back'}</Text>
        </Pressable>
        {propertyName ? (
          <Text style={[styles.prop, rtl && styles.rtl]} numberOfLines={1}>
            {propertyName}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.crumbs, rtl && styles.rtl]} numberOfLines={2}>
        {crumbs.filter(Boolean).join(rtl ? ' ← ' : ' → ')}
      </Text>
      {resultCount != null ? (
        <Text style={[styles.count, rtl && styles.rtl]} testID={`${testID}-count`}>
          {resultCount} {resultLabel || (rtl ? 'نتيجة' : 'results')}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  rowRtl: { flexDirection: 'row-reverse' },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backText: { color: colors.gold, fontSize: 13, fontWeight: typography.weight.medium },
  prop: { color: colors.text, fontSize: 13, fontWeight: typography.weight.semibold, flexShrink: 1 },
  crumbs: { color: colors.textMuted, fontSize: 11, marginTop: 6, letterSpacing: 0.2 },
  count: { color: colors.gold, fontSize: 11, marginTop: 4, fontWeight: typography.weight.semibold },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
});
