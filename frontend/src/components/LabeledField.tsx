import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography } from '@/src/theme';
import { useI18n } from '@/src/i18n';

type Props = {
  label: string;
  value: string;
  highlight?: boolean;
};

/** Labeled field row — mirrors Source web mob-label / mob-value cards. */
export function LabeledField({ label, value, highlight }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, highlight && styles.highlight]}>{value}</Text>
    </View>
  );
}

type DataProps = {
  children: React.ReactNode;
};

/** Wraps API-sourced content with Arabic framing in AR mode. */
export function PortfolioDataBlock({ children }: DataProps) {
  const { t, lang } = useI18n();
  return (
    <View>
      {lang === 'ar' ? (
        <Text style={styles.dataNote}>{t('clarity.portfolioData')}</Text>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  label: {
    color: colors.textMuted, fontSize: 11, letterSpacing: 1.4,
    textTransform: 'uppercase', fontWeight: typography.weight.medium,
  },
  value: {
    color: colors.text, fontSize: 15, lineHeight: 23, marginTop: 6,
  },
  highlight: { color: colors.gold, fontWeight: typography.weight.medium },
  dataNote: {
    color: colors.textSubtle, fontSize: 11, marginBottom: 8, lineHeight: 17,
  },
});
