import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { ScreenScaffold } from '@/src/components/ScreenScaffold';
import { StoryScreenHeader } from '@/src/components/StoryScreenHeader';
import { GlassCard } from '@/src/components/GlassCard';
import { useOperational } from '@/src/hooks/useOperational';
import { usePropertyOS } from '@/src/hooks/usePropertyOS';
import { useNotificationPrefs } from '@/src/hooks/usePreferences';
import { colors, spacing, typography } from '@/src/theme';
import { useI18n } from '@/src/i18n';
import { formatDate } from '@/src/utils/locale';

export default function MaintenanceArchiveScreen() {
  const { t, isRTL } = useI18n();
  const { unitId } = useLocalSearchParams<{ unitId: string }>();
  const { countEnabled } = useNotificationPrefs();
  const { state } = usePropertyOS(countEnabled);
  const { ticketsForUnit } = useOperational();

  const unit = state.units.find((u) => u.id === unitId);
  const archive = unitId ? ticketsForUnit(unitId) : [];

  const techNames = [...new Set(archive.map((t) => t.technicianName).filter(Boolean))];

  return (
    <ScreenScaffold testID="maintenance-archive">
      <StoryScreenHeader
        question={t('maint.archive' as any)}
        hint={unit ? `${t('op.tenant.unit')} ${unit.number}` : t('maint.archiveSub' as any)}
        showBack
      />

      <GlassCard padding={14} radiusToken="md" edge="gold">
        <Text style={[styles.meta, isRTL && styles.rtl]}>
          {archive.length} {t('opsv2.maint.step.create' as any)}
        </Text>
        <Text style={[styles.meta, isRTL && styles.rtl]}>
          {techNames.length} {t('maint.selectTech' as any)}
        </Text>
      </GlassCard>

      {archive.map((tk) => (
        <GlassCard key={tk.id} padding={14} radiusToken="md" style={styles.card}>
          <Text style={[styles.title, isRTL && styles.rtl]}>{tk.title}</Text>
          <Text style={styles.dim}>
            {tk.status} · {tk.progressPercent ?? 0}% · {formatDate(tk.createdAt)}
          </Text>
          <Text style={styles.dim}>
            {(tk.media?.length ?? 0) + (tk.beforeMedia?.length ?? 0) + (tk.afterMedia?.length ?? 0)} ملف
            {tk.technicianName ? ` · ${tk.technicianName}` : ''}
          </Text>
        </GlassCard>
      ))}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  meta: { color: colors.textDim, fontSize: 13, marginBottom: 4 },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  card: { marginTop: spacing.sm },
  title: { color: colors.text, fontWeight: typography.weight.semibold },
  dim: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
});
