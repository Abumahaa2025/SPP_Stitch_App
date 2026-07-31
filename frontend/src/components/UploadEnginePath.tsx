import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { GlassCard } from '@/src/components/GlassCard';
import type { PortfolioAnalysis } from '@/src/api/portfolio-analysis';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';

type Props = {
  analysis: PortfolioAnalysis;
  applied?: boolean;
  delay?: number;
};

type StepRow = {
  id: string;
  title: string;
  detail: string;
  ok: boolean;
};

/** Live engine path — derived only from the API response the app just received. */
export function UploadEnginePath({ analysis, applied = false, delay = 0 }: Props) {
  const { isRTL } = useI18n();
  const ar = isRTL;

  const steps = useMemo(() => buildSteps(analysis, applied, ar), [analysis, applied, ar]);

  return (
    <Animated.View entering={FadeInDown.duration(500).delay(delay)} style={styles.wrap} testID="upload-engine-path">
      <GlassCard padding={16} radiusToken="md" edge="gold">
        <Text style={[styles.title, isRTL && styles.rtl]}>
          {ar ? 'مسار كويل (من بيانات هذا الرفع)' : 'Koil path (from this upload)'}
        </Text>
        <Text style={[styles.sub, isRTL && styles.rtl]} numberOfLines={2}>
          {ar
            ? 'الأرقام أدناه من رد الخادم بعد رفع ملفاتك — ليست واجهة ثابتة.'
            : 'Figures below come from the server response after your upload — not a static UI.'}
        </Text>
        <View style={styles.list}>
          {steps.map((s) => (
            <View key={s.id} style={[styles.row, isRTL && styles.rowRtl]} testID={`engine-step-${s.id}`}>
              <View style={[styles.dot, s.ok ? styles.dotOk : styles.dotMiss]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.stepTitle, isRTL && styles.rtl]}>{s.title}</Text>
                <Text style={[styles.stepDetail, isRTL && styles.rtl]} numberOfLines={3}>
                  {s.detail}
                </Text>
              </View>
            </View>
          ))}
        </View>
        <Text style={[styles.analysisId, isRTL && styles.rtl]} selectable>
          analysis_id: {analysis.analysis_id}
        </Text>
      </GlassCard>
    </Animated.View>
  );
}

function buildSteps(analysis: PortfolioAnalysis, applied: boolean, ar: boolean): StepRow[] {
  const m = analysis.metrics || ({} as PortfolioAnalysis['metrics']);
  const brief = analysis.executive_brief;
  const eng = brief?.engines;
  const keys = new Set((analysis.executive_report?.sections || []).map((s) => s.key));
  const pk = analysis.property_knowledge;
  const pkTenants = pk?.tenants?.length ?? eng?.tenant_cards?.count ?? 0;
  const pkActive = pk?.lifecycle?.active?.length ?? 0;
  const months = m.months_linked ?? pk?.meta?.month_count ?? pk?.lifecycle?.month_count;
  const period =
    brief?.period ||
    (pk?.meta?.period_from && pk?.meta?.period_to
      ? `${pk.meta.period_from} → ${pk.meta.period_to}`
      : '—');
  const koilBrief = (analysis.success_message || '').trim();
  const koilOk =
    keys.has('koil_brief') &&
    keys.has('koil_what') &&
    (koilBrief.startsWith('كويل') || koilBrief.toLowerCase().startsWith('koil'));

  const departed =
    eng?.lifecycle?.departed_count ?? m.departed_count ?? pk?.lifecycle?.departed?.length;
  const newcomers =
    eng?.lifecycle?.newcomers_count ?? m.newcomers_count ?? pk?.lifecycle?.newcomers?.length;

  return [
    {
      id: 'import',
      title: ar ? '1. Import' : '1. Import',
      detail: ar
        ? `ملفات ${m.files_analyzed ?? '—'} · وحدات ${m.units ?? '—'} · مستأجرون ${m.tenants ?? '—'}${months != null ? ` · أشهر ${months}` : ''}`
        : `files ${m.files_analyzed ?? '—'} · units ${m.units ?? '—'} · tenants ${m.tenants ?? '—'}${months != null ? ` · months ${months}` : ''}`,
      ok: Number(m.files_analyzed || 0) > 0 && Number(m.units || 0) > 0,
    },
    {
      id: 'property_knowledge',
      title: ar ? '2. Property Knowledge' : '2. Property Knowledge',
      detail: ar
        ? `بطاقات ${pkTenants} · نشط من Lifecycle ${pkActive} · فترة ${period}`
        : `cards ${pkTenants} · lifecycle active ${pkActive} · period ${period}`,
      ok: pkTenants > 0 || pkActive > 0 || Number(m.tenants || 0) > 0,
    },
    {
      id: 'lifecycle',
      title: ar ? '3. Lifecycle' : '3. Lifecycle',
      detail: ar
        ? `نشط ${pkActive || '—'} · خرج ${departed ?? '—'} · دخل ${newcomers ?? '—'} · تغيّرات ${eng?.lifecycle?.confirmed_moves ?? pk?.lifecycle?.tenant_changes?.length ?? '—'}`
        : `active ${pkActive || '—'} · departed ${departed ?? '—'} · newcomers ${newcomers ?? '—'} · moves ${eng?.lifecycle?.confirmed_moves ?? pk?.lifecycle?.tenant_changes?.length ?? '—'}`,
      ok:
        pkActive > 0 ||
        departed != null ||
        newcomers != null ||
        keys.has('departed') ||
        keys.has('moved_in') ||
        keys.has('months'),
    },
    {
      id: 'reasoning',
      title: ar ? '4. Reasoning (كويل)' : '4. Reasoning (Koil)',
      detail: koilBrief.slice(0, 140) || (ar ? 'لا ملخص' : 'no brief'),
      ok: koilOk,
    },
    {
      id: 'executive_report',
      title: ar ? '5. Executive Report' : '5. Executive Report',
      detail: ar
        ? `أقسام ${keys.size} · عنوان: ${brief?.title || analysis.executive_report?.title || '—'} · متأخرون ${m.late_tenants ?? eng?.late?.tenant_count ?? '—'}`
        : `sections ${keys.size} · title: ${brief?.title || analysis.executive_report?.title || '—'} · late ${m.late_tenants ?? eng?.late?.tenant_count ?? '—'}`,
      ok: keys.size >= 5 && (keys.has('koil_brief') || Boolean(brief?.property_status)),
    },
    {
      id: 'apply',
      title: ar ? '6. Apply' : '6. Apply',
      detail: applied
        ? ar
          ? 'تمت الموافقة وتحديث المحفظة من هذا التحليل'
          : 'Approved — portfolio updated from this analysis'
        : ar
          ? 'بانتظار موافقتك على «تحديث المحفظة»'
          : 'Waiting for your «Update portfolio» approval',
      ok: applied,
    },
  ];
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.md },
  title: {
    color: colors.gold,
    fontSize: typography.cardTitle,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing.xs,
  },
  sub: {
    color: colors.textMuted,
    fontSize: typography.small,
    marginBottom: spacing.md,
  },
  list: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  rowRtl: { flexDirection: 'row-reverse' },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  dotOk: { backgroundColor: colors.emerald },
  dotMiss: { backgroundColor: colors.textMuted },
  stepTitle: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: typography.weight.semibold,
  },
  stepDetail: {
    color: colors.textMuted,
    fontSize: typography.small,
    marginTop: 2,
  },
  analysisId: {
    color: colors.textMuted,
    fontSize: typography.micro,
    marginTop: spacing.md,
    fontFamily: 'monospace',
  },
  rtl: { textAlign: 'right', writingDirection: 'rtl' },
});
