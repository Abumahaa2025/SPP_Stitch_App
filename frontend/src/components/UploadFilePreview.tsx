import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { GlassCard } from '@/src/components/GlassCard';
import type { FilePreview } from '@/src/utils/upload-analyze';
import type { ColumnMapping } from '@/src/utils/upload-parse';
import { UploadColumnMapper } from '@/src/components/UploadColumnMapper';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';

type Props = {
  preview: FilePreview;
  onConfirm: () => void;
  onCancel: () => void;
  onMappingChange?: (mapping: ColumnMapping) => void;
  testID?: string;
};

export function UploadFilePreview({ preview, onConfirm, onCancel, onMappingChange, testID = 'upload-preview' }: Props) {
  const { t, isRTL } = useI18n();

  return (
    <Animated.View entering={FadeInDown.duration(500)} testID={testID}>
      <GlassCard padding={20} radiusToken="lg" edge="gold">
        <Text style={[styles.title, isRTL && styles.rtl]}>{t('journey.upload.previewTitle')}</Text>

        <View style={styles.explainList}>
          {([
            'journey.upload.explain.contracts',
            'journey.upload.explain.units',
            'journey.upload.explain.tenants',
            'journey.upload.explain.review',
            'journey.upload.explain.approve',
          ] as const).map((key) => (
            <Text key={key} style={[styles.explainItem, isRTL && styles.rtl]}>· {t(key as any)}</Text>
          ))}
        </View>

        <Row label={t('journey.upload.fileName')} value={preview.fileName} isRTL={isRTL} />
        <Row label={t('journey.upload.rows')} value={String(preview.rowCount)} isRTL={isRTL} />
        <Row label={t('journey.upload.columns')} value={String(preview.columnCount)} isRTL={isRTL} />

        <Text style={[styles.section, isRTL && styles.rtl]}>{t('journey.upload.recognized')}</Text>
        <Text style={[styles.chips, isRTL && styles.rtl]}>
          {preview.recognizedColumns.length
            ? preview.recognizedColumns.join(' · ')
            : preview.columns.slice(0, 6).join(' · ')}
        </Text>

        {preview.previewRows.length > 0 ? (
          <>
            <Text style={[styles.section, isRTL && styles.rtl]}>{t('journey.upload.previewRows')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View>
                <View style={[styles.tableRow, styles.tableHead]}>
                  {preview.columns.map((c) => (
                    <Text key={c} style={styles.cellHead} numberOfLines={1}>{c}</Text>
                  ))}
                </View>
                {preview.previewRows.map((row, ri) => (
                  <View key={ri} style={styles.tableRow}>
                    {row.map((cell, ci) => (
                      <Text key={ci} style={styles.cell} numberOfLines={1}>{cell || '—'}</Text>
                    ))}
                  </View>
                ))}
              </View>
            </ScrollView>
          </>
        ) : (
          <Text style={[styles.dim, isRTL && styles.rtl]}>{t('journey.upload.noPreview')}</Text>
        )}

        {preview.columns.length > 0 && onMappingChange ? (
          <UploadColumnMapper
            columns={preview.columns}
            mapping={preview.mapping}
            onChange={onMappingChange}
          />
        ) : null}

        <Text style={[styles.dim, isRTL && styles.rtl, { marginTop: spacing.sm }]}>
          {t('opsv2.import.noInvent' as any)}
        </Text>

        <Text style={[styles.confirm, isRTL && styles.rtl]}>{t('journey.upload.confirm')}</Text>
        <View style={[styles.actions, isRTL && styles.rowRtl]}>
          <Pressable style={styles.secondary} onPress={onCancel} testID={`${testID}-cancel`}>
            <Text style={styles.secondaryText}>{t('journey.upload.confirmNo')}</Text>
          </Pressable>
          <Pressable
            style={styles.primary}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onConfirm(); }}
            testID={`${testID}-confirm`}
          >
            <Text style={styles.primaryText}>{t('journey.upload.confirmYes')}</Text>
          </Pressable>
        </View>
      </GlassCard>
    </Animated.View>
  );
}

function Row({ label, value, isRTL }: { label: string; value: string; isRTL: boolean }) {
  return (
    <View style={[styles.row, isRTL && styles.rowRtl]}>
      <Text style={[styles.rowLabel, isRTL && styles.rtl]}>{label}</Text>
      <Text style={[styles.rowValue, isRTL && styles.rtl]} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 18, fontWeight: typography.weight.semibold, marginBottom: spacing.md },
  explainList: { marginBottom: spacing.md, gap: 4 },
  explainItem: { color: colors.textDim, fontSize: 13, lineHeight: 20 },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 8 },
  rowRtl: { flexDirection: 'row-reverse' },
  rowLabel: { color: colors.textMuted, fontSize: 12, flex: 1 },
  rowValue: { color: colors.text, fontSize: 12, flex: 1, textAlign: 'right' },
  section: {
    color: colors.textMuted, fontSize: 10, letterSpacing: 0.8,
    textTransform: 'uppercase', marginTop: spacing.md, marginBottom: 6,
  },
  chips: { color: colors.gold, fontSize: 12, lineHeight: 18 },
  dim: { color: colors.textDim, fontSize: 12, marginTop: spacing.sm },
  tableRow: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  tableHead: { backgroundColor: 'rgba(255,255,255,0.04)' },
  cellHead: { width: 88, padding: 8, color: colors.textMuted, fontSize: 10, fontWeight: typography.weight.semibold },
  cell: { width: 88, padding: 8, color: colors.textDim, fontSize: 10 },
  confirm: { color: colors.text, fontSize: 14, marginTop: spacing.lg, fontWeight: typography.weight.medium },
  actions: { flexDirection: 'row', gap: 10, marginTop: spacing.md },
  secondary: {
    flex: 1, paddingVertical: 12, borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, alignItems: 'center',
  },
  secondaryText: { color: colors.textMuted, fontSize: 13 },
  primary: {
    flex: 1.5, paddingVertical: 12, borderRadius: radius.md,
    backgroundColor: colors.emerald, alignItems: 'center',
  },
  primaryText: { color: colors.bg, fontSize: 13, fontWeight: typography.weight.semibold },
});
