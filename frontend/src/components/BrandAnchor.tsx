import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Wordmark } from '@/src/components/BrandOrb';

type Props = { testID?: string; align?: 'start' | 'center' };

/** Calm SPP identity — wordmark fixed left in shell chrome. */
export function BrandAnchor({ testID = 'brand-anchor', align = 'start' }: Props) {
  return (
    <View style={[styles.col, align === 'center' && styles.center]} testID={testID}>
      <Wordmark size="sm" showBilingualTagline align={align} />
    </View>
  );
}

const styles = StyleSheet.create({
  col: { alignItems: 'flex-start', justifyContent: 'center' },
  center: { alignItems: 'center' },
});
