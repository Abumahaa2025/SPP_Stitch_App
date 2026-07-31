import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import type { ColumnField, ColumnMapping } from '@/src/utils/upload-parse';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';

const FIELDS: ColumnField[] = [
  'unit', 'tenant', 'rent', 'phone', 'contract',
  'contract_status', 'contract_end', 'arrears', 'skip',
];

const FIELD_KEYS: Record<ColumnField, string> = {
  unit: 'opsv2.import.mapUnit',
  tenant: 'opsv2.import.mapTenant',
  rent: 'opsv2.import.mapRent',
  phone: 'opsv2.import.mapPhone',
  contract: 'opsv2.import.mapContract',
  contract_status: 'opsv2.import.mapContractStatus',
  contract_end: 'opsv2.import.mapContractEnd',
  arrears: 'opsv2.import.mapArrears',
  skip: 'opsv2.import.mapSkip',
};

type Props = {
  columns: string[];
  mapping: ColumnMapping;
  onChange: (mapping: ColumnMapping) => void;
};

export function UploadColumnMapper({ columns, mapping, onChange }: Props) {
  const { t, isRTL } = useI18n();

  const cycleField = (col: string) => {
    const current = mapping[col] ?? 'skip';
    const idx = FIELDS.indexOf(current);
    const next = FIELDS[(idx + 1) % FIELDS.length];
    onChange({ ...mapping, [col]: next });
  };

  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, isRTL && styles.rtl]}>{t('opsv2.import.mapTitle' as any)}</Text>
      <Text style={[styles.sub, isRTL && styles.rtl]}>{t('opsv2.import.mapSub' as any)}</Text>
      {columns.map((col) => (
        <Pressable
          key={col}
          style={[styles.row, isRTL && styles.rowRtl]}
          onPress={() => cycleField(col)}
        >
          <Text style={[styles.col, isRTL && styles.rtl]} numberOfLines={1}>{col}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {t(FIELD_KEYS[mapping[col] ?? 'skip'] as any)}
            </Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.md },
  title: { color: colors.text, fontSize: 14, fontWeight: typography.weight.semibold },
  sub: { color: colors.textDim, fontSize: 12, marginTop: 4, lineHeight: 18 },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 8, paddingVertical: 8, paddingHorizontal: 10,
    borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  rowRtl: { flexDirection: 'row-reverse' },
  col: { color: colors.text, fontSize: 12, flex: 1 },
  badge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill,
    backgroundColor: colors.goldSoft, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.goldEdge,
  },
  badgeText: { color: colors.gold, fontSize: 11, fontWeight: typography.weight.medium },
});
