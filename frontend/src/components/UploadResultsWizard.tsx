/**
 * UploadResultsWizard — post-analysis owner journey on analysis.summary only.
 * Does not recompute metrics; does not invent Source-only fields.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';

import { GlassCard } from '@/src/components/GlassCard';
import { UploadEnginePath } from '@/src/components/UploadEnginePath';
import { UploadExecutiveReport } from '@/src/components/UploadExecutiveReport';
import {
  applyPortfolioAnalysis,
  type PortfolioAnalysis,
  type UnifiedPortfolioSummary,
  type UploadFileMeta,
} from '@/src/api/portfolio-analysis';
import { persistApplyFromAnalysis, type ApplyCommit } from '@/src/utils/apply-analysis-to-os';
import { storage } from '@/src/utils/storage';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';

export type WizardStage = 1 | 2 | 3 | 4 | 5;

type Props = {
  analysis: PortfolioAnalysis;
  fileMeta: UploadFileMeta[];
  lang: 'ar' | 'en';
  applied?: boolean;
  onApplied?: () => void;
  onReset?: () => void;
};

type ApplyBreakdown = {
  localOk: boolean;
  local: {
    properties: number;
    units: number;
    tenants: number;
    contracts: number;
    paidMonths: number;
    lateMonths: number;
    paymentsNoted: boolean;
    needsReview: number;
  };
  remoteOk: boolean;
  gas?: boolean;
  remoteCommit?: Record<string, unknown> | null;
  remoteError?: string;
  localError?: string;
  failed: { item: string; reason: string }[];
  needsReviewItems: string[];
};

const STAGE_KEY = 'spp.uploadWizardStage';

const UNAVAILABLE_SOURCE = [
  { ar: 'تواريخ العقود الدقيقة', en: 'Exact contract start/end dates' },
  { ar: 'صفوف المدفوعات الفردية', en: 'Individual payment rows' },
  { ar: 'هوية العقار الكاملة (عنوان / مدينة / مالك)', en: 'Full property identity (address / city / owner)' },
  { ar: 'تعدد العقارات من رفع واحد', en: 'Multi-property split from one upload' },
  { ar: 'أوامر الصيانة التفصيلية', en: 'Detailed maintenance work orders' },
] as const;

function summaryOf(analysis: PortfolioAnalysis): UnifiedPortfolioSummary {
  const s = analysis.summary;
  if (s) return s;
  return {
    properties: 0,
    units: 0,
    tenants: 0,
    contracts: 0,
    rents: 0,
    collected: 0,
    remaining: 0,
    late_tenants: 0,
    late_value: 0,
    contracts_expired: 0,
    contracts_expiring_soon: 0,
    missing_phone: 0,
    missing_contract: 0,
    gaps: 0,
  };
}

function MetricRow({ label, value, rtl }: { label: string; value: string; rtl: boolean }) {
  return (
    <View style={[styles.metricRow, rtl && styles.rowRtl]}>
      <Text style={[styles.metricLabel, rtl && styles.rtl]}>{label}</Text>
      <Text style={[styles.metricValue, rtl && styles.rtl]}>{value}</Text>
    </View>
  );
}

export function UploadResultsWizard({
  analysis,
  fileMeta,
  lang,
  applied = false,
  onApplied,
  onReset,
}: Props) {
  const { isRTL } = useI18n();
  const ar = lang === 'ar' || isRTL;
  const router = useRouter();
  const summary = useMemo(() => summaryOf(analysis), [analysis]);
  const [stage, setStage] = useState<WizardStage>(1);
  const [techOpen, setTechOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyDone, setApplyDone] = useState(applied);
  const [breakdown, setBreakdown] = useState<ApplyBreakdown | null>(null);
  const applyLock = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await storage.getItem<string>(STAGE_KEY, '');
        if (!raw || cancelled) return;
        const parsed = JSON.parse(raw) as { analysis_id?: string; stage?: number };
        if (parsed.analysis_id === analysis.analysis_id && parsed.stage && parsed.stage >= 1 && parsed.stage <= 5) {
          setStage(parsed.stage as WizardStage);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [analysis.analysis_id]);

  const persistStage = useCallback(
    async (next: WizardStage) => {
      setStage(next);
      await storage.setItem(
        STAGE_KEY,
        JSON.stringify({ analysis_id: analysis.analysis_id, stage: next, at: new Date().toISOString() }),
      );
    },
    [analysis.analysis_id],
  );

  const goBack = () => {
    if (stage <= 1 || applying) return;
    Haptics.selectionAsync();
    void persistStage((stage - 1) as WizardStage);
  };

  const goNext = () => {
    if (stage >= 5 || applying) return;
    Haptics.selectionAsync();
    void persistStage((stage + 1) as WizardStage);
  };

  const needsReviewCount = useMemo(() => {
    const ds = summary.data_status;
    if (!ds) return summary.gaps || 0;
    return (ds.needs_review || 0) + (ds.incomplete || 0) + (ds.conflicting || 0) || summary.gaps || 0;
  }, [summary]);

  const gapLines = useMemo(() => {
    const lines: string[] = [];
    if (summary.missing_phone > 0) {
      lines.push(ar ? `أرقام جوال ناقصة: ${summary.missing_phone}` : `Missing phones: ${summary.missing_phone}`);
    }
    if (summary.missing_contract > 0) {
      lines.push(ar ? `عقود ناقصة: ${summary.missing_contract}` : `Missing contracts: ${summary.missing_contract}`);
    }
    const unknown = summary.gaps_detail?.unknown_month_count ?? 0;
    if (unknown > 0) {
      lines.push(ar ? `أشهر دفع غير واضحة: ${unknown}` : `Unclear payment months: ${unknown}`);
    }
    if (summary.late_tenants > 0) {
      lines.push(
        ar
          ? `متأخرون يحتاجون متابعة: ${summary.late_tenants} · ${Number(summary.late_value || 0).toLocaleString()} ر.س`
          : `Late tenants to review: ${summary.late_tenants} · ${Number(summary.late_value || 0).toLocaleString()} SAR`,
      );
    }
    const ds = summary.data_status;
    if (ds?.overall && ds.overall !== 'confirmed') {
      lines.push(
        ar
          ? `حالة البيانات: ${ds.overall === 'conflicting' ? 'متعارضة' : ds.overall === 'incomplete' ? 'ناقصة' : 'تحتاج مراجعة'}`
          : `Data status: ${ds.overall}`,
      );
    }
    if (!lines.length) {
      lines.push(ar ? 'لا نواقص مؤكدة من الملخص الحالي.' : 'No confirmed gaps in the current summary.');
    }
    return lines;
  }, [summary, ar]);

  const proposedActions = useMemo(() => {
    const actions: string[] = [];
    actions.push(ar ? 'اعتماد الملخص وحفظه في نظام العقار' : 'Approve summary and save into Property OS');
    if (summary.gaps > 0) {
      actions.push(ar ? 'مراجعة النواقص قبل المتابعة التشغيلية' : 'Review gaps before operational follow-up');
    }
    if (summary.late_tenants > 0) {
      actions.push(ar ? 'متابعة المتأخرين من شاشة المستأجرين' : 'Follow up late tenants from Tenants screen');
    }
    if ((summary.maintenance_count || 0) > 0) {
      actions.push(ar ? 'مراجعة مصروفات الصيانة المسجّلة' : 'Review recorded maintenance amounts');
    }
    actions.push(ar ? 'فتح التقارير لمراجعة الملخص التنفيذي' : 'Open reports to review the executive summary');
    return actions;
  }, [summary, ar]);

  const runApply = async () => {
    if (applyLock.current || applying) return;
    applyLock.current = true;
    setApplying(true);
    setBreakdown(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const failed: ApplyBreakdown['failed'] = [];
    const needsReviewItems: string[] = [
      ...gapLines.filter((l) => !l.includes('لا نواقص') && !l.toLowerCase().includes('no confirmed')),
    ];
    let localCommit: ApplyCommit | null = null;
    let localOk = false;
    let localError: string | undefined;
    let remoteOk = false;
    let gas: boolean | undefined;
    let remoteCommit: Record<string, unknown> | null = null;
    let remoteError: string | undefined;

    try {
      localCommit = await persistApplyFromAnalysis(analysis, lang);
      localOk = true;
    } catch (err) {
      localError = err instanceof Error ? err.message : 'local apply failed';
      failed.push({
        item: ar ? 'حفظ PropertyOS المحلي' : 'Local PropertyOS save',
        reason: localError,
      });
    }

    try {
      const remote = await applyPortfolioAnalysis(analysis.analysis_id, fileMeta);
      remoteOk = !!remote?.ok;
      gas = remote?.gas;
      remoteCommit = (remote?.commit as Record<string, unknown>) || null;
      if (!remoteOk) {
        remoteError = ar ? 'الخادم لم يؤكد الاعتماد' : 'Backend did not confirm apply';
        failed.push({ item: ar ? 'تأكيد Backend / GAS' : 'Backend / GAS confirm', reason: remoteError });
      }
    } catch (err) {
      remoteError = err instanceof Error ? err.message : 'remote apply failed';
      failed.push({
        item: ar ? 'تأكيد Backend / GAS' : 'Backend / GAS confirm',
        reason: remoteError,
      });
    }

    const paidMonths = Number(
      localCommit?.paid_months
        ?? summary.paid_month_count
        ?? summary.payments?.paid_month_count
        ?? 0,
    );
    const lateMonths = Number(
      localCommit?.late_months
        ?? summary.payments?.confirmed_late_month_count
        ?? summary.arrears?.confirmed_late_month_count
        ?? 0,
    );
    const ledgerN = localCommit?.ledger_entries ?? 0;
    // Property count from materialised OS — never show 0 when units were saved.
    const propCount = localOk
      ? Math.max(
          1,
          Number(localCommit?.summary?.properties) || 0,
          localCommit?.property_id ? 1 : 0,
          Number(summary.properties) || 0,
        )
      : 0;
    const local = {
      properties: propCount,
      units: localCommit?.units ?? 0,
      tenants: localCommit?.tenants ?? 0,
      contracts: localCommit?.contracts ?? 0,
      paidMonths: paidMonths || (lateMonths > 0 ? Math.max(0, ledgerN - lateMonths) : ledgerN),
      lateMonths,
      paymentsNoted: !!(summary.payments || summary.collected || summary.paid_month_count || ledgerN),
      needsReview: needsReviewCount,
    };

    if (localOk && localCommit) {
      await storage.setItem(
        'spp.lastApplyProof',
        JSON.stringify({
          ...localCommit,
          applied_at: new Date().toISOString(),
          files: fileMeta.map((f) => f.name),
          source: 'property_knowledge',
          remote: { ok: remoteOk, gas, commit: remoteCommit, error: remoteError },
        }),
      );
      setApplyDone(true);
      onApplied?.();
    }

    setBreakdown({
      localOk,
      local,
      remoteOk,
      gas,
      remoteCommit,
      remoteError,
      localError,
      failed,
      needsReviewItems,
    });
    setApplying(false);
    applyLock.current = false;
    await persistStage(5);
  };

  const runCloudSyncOnly = async () => {
    if (applyLock.current || applying || !applyDone) return;
    applyLock.current = true;
    setApplying(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    let remoteOk = false;
    let gas: boolean | undefined;
    let remoteCommit: Record<string, unknown> | null = null;
    let remoteError: string | undefined;
    const failed: ApplyBreakdown['failed'] = [];
    try {
      const remote = await applyPortfolioAnalysis(analysis.analysis_id, fileMeta);
      remoteOk = !!remote?.ok;
      gas = remote?.gas;
      remoteCommit = (remote?.commit as Record<string, unknown>) || null;
      if (!remoteOk) {
        remoteError = ar ? 'الخادم لم يؤكد الاعتماد' : 'Backend did not confirm apply';
        failed.push({ item: ar ? 'مزامنة Backend / GAS' : 'Backend / GAS sync', reason: remoteError });
      }
    } catch (err) {
      remoteError = err instanceof Error ? err.message : 'remote sync failed';
      failed.push({
        item: ar ? 'مزامنة Backend / GAS' : 'Backend / GAS sync',
        reason: remoteError,
      });
    }
    setBreakdown((prev) =>
      prev
        ? {
            ...prev,
            remoteOk,
            gas,
            remoteCommit,
            remoteError,
            failed,
          }
        : prev,
    );
    setApplying(false);
    applyLock.current = false;
  };

  const stageTitle = useMemo(() => {
    const titles = ar
      ? ['اكتملت قراءة الملف', 'ملخص النتائج', 'النواقص التي تحتاج مراجعة', 'الإجراءات المقترحة', 'اعتماد البيانات وحفظها']
      : ['File reading complete', 'Results summary', 'Gaps needing review', 'Suggested actions', 'Approve and save'];
    return titles[stage - 1];
  }, [stage, ar]);

  const fmt = (n: number | undefined) => Number(n || 0).toLocaleString();

  return (
    <Animated.View entering={FadeInDown.duration(500)} style={styles.wrap} testID="upload-results-wizard">
      <GlassCard padding={18} radiusToken="lg" edge="gold">
        <Text style={[styles.kicker, ar && styles.rtl]}>{ar ? 'بعد الرفع' : 'After upload'}</Text>
        <Text style={[styles.title, ar && styles.rtl]}>{stageTitle}</Text>
        <View style={[styles.dots, ar && styles.rowRtl]}>
          {([1, 2, 3, 4, 5] as WizardStage[]).map((s) => (
            <View key={s} style={[styles.dot, s === stage && styles.dotActive, s < stage && styles.dotDone]} />
          ))}
        </View>
        <Text style={[styles.stageMeta, ar && styles.rtl]}>
          {ar ? `المرحلة ${stage} من 5` : `Step ${stage} of 5`}
        </Text>
      </GlassCard>

      {stage === 1 ? (
        <GlassCard padding={18} radiusToken="md" edge="emerald" style={styles.block}>
          <Text style={[styles.body, ar && styles.rtl]}>
            {ar
              ? `تمت قراءة ${summary.files_analyzed ?? fileMeta.length} ملفًا وربط ${summary.months_linked ?? '—'} شهرًا. الملخص جاهز للمراجعة.`
              : `Read ${summary.files_analyzed ?? fileMeta.length} file(s) and linked ${summary.months_linked ?? '—'} month(s). Summary is ready for review.`}
          </Text>
          <Text style={[styles.muted, ar && styles.rtl]} numberOfLines={2}>
            {fileMeta.map((f) => f.name).join(' · ') || '—'}
          </Text>
          {summary.period ? (
            <Text style={[styles.period, ar && styles.rtl]}>{summary.period}</Text>
          ) : null}
        </GlassCard>
      ) : null}

      {stage === 2 ? (
        <GlassCard padding={18} radiusToken="md" edge="gold" style={styles.block}>
          <MetricRow label={ar ? 'العقارات' : 'Properties'} value={fmt(summary.properties)} rtl={ar} />
          <MetricRow label={ar ? 'الوحدات' : 'Units'} value={fmt(summary.units)} rtl={ar} />
          <MetricRow label={ar ? 'المستأجرون' : 'Tenants'} value={fmt(summary.tenants)} rtl={ar} />
          <MetricRow label={ar ? 'العقود' : 'Contracts'} value={fmt(summary.contracts)} rtl={ar} />
          <MetricRow label={ar ? 'المحصل' : 'Collected'} value={fmt(summary.collected)} rtl={ar} />
          <MetricRow label={ar ? 'المتبقي' : 'Remaining'} value={fmt(summary.remaining)} rtl={ar} />
          <MetricRow label={ar ? 'المتأخرون' : 'Late tenants'} value={fmt(summary.late_tenants)} rtl={ar} />
          <MetricRow label={ar ? 'النواقص' : 'Gaps'} value={fmt(summary.gaps)} rtl={ar} />
          <MetricRow
            label={ar ? 'الصيانة' : 'Maintenance'}
            value={`${fmt(summary.maintenance_count)} · ${fmt(summary.maintenance_total)}`}
            rtl={ar}
          />
          <MetricRow
            label={ar ? 'حالة البيانات' : 'Data status'}
            value={summary.data_status?.overall || '—'}
            rtl={ar}
          />
          <Text style={[styles.sectionLabel, ar && styles.rtl, { marginTop: 12 }]}>
            {ar ? 'غير متوفر من التحليل (يحتاج مصدرًا إضافيًا)' : 'Unavailable from analysis (needs Source)'}
          </Text>
          {UNAVAILABLE_SOURCE.map((u) => (
            <Text key={u.en} style={[styles.unavailable, ar && styles.rtl]}>
              · {ar ? u.ar : u.en}
            </Text>
          ))}
        </GlassCard>
      ) : null}

      {stage === 3 ? (
        <GlassCard padding={18} radiusToken="md" edge="gold" style={styles.block}>
          {gapLines.map((line) => (
            <Text key={line} style={[styles.body, ar && styles.rtl, styles.gapLine]}>
              · {line}
            </Text>
          ))}
        </GlassCard>
      ) : null}

      {stage === 4 ? (
        <GlassCard padding={18} radiusToken="md" edge="emerald" style={styles.block}>
          {proposedActions.map((a) => (
            <Text key={a} style={[styles.body, ar && styles.rtl, styles.gapLine]}>
              · {a}
            </Text>
          ))}
        </GlassCard>
      ) : null}

      {stage === 5 ? (
        <GlassCard padding={18} radiusToken="md" edge="emerald" style={styles.block}>
          {!breakdown ? (
            <>
              <Text style={[styles.body, ar && styles.rtl]}>
                {ar
                  ? 'بالضغط على اعتماد وحفظ سيتم حفظ الملخص في PropertyOS ثم طلب تأكيد الخادم.'
                  : 'Approve & Save will persist the summary into PropertyOS, then request backend confirmation.'}
              </Text>
              <Pressable
                style={[styles.primaryBtn, (applying || applyDone) && styles.btnDisabled, { marginTop: 12 }]}
                onPress={runApply}
                disabled={applying || applyDone}
                testID="wizard-apply-btn"
              >
                {applying ? (
                  <ActivityIndicator color={colors.bg} />
                ) : (
                  <Text style={styles.primaryText}>{ar ? 'اعتماد وحفظ' : 'Approve & Save'}</Text>
                )}
              </Pressable>
            </>
          ) : (
            <>
              <Text style={[styles.sectionLabel, ar && styles.rtl]}>
                {ar ? 'ما حُفظ محليًا (PropertyOS)' : 'Saved locally (PropertyOS)'}
              </Text>
              {breakdown.localOk ? (
                <>
                  <Text style={[styles.okTitle, ar && styles.rtl, { marginBottom: 8 }]}>
                    {ar ? 'تم حفظ التشغيل على الجهاز' : 'Operations saved on device'}
                  </Text>
                  <Text style={[styles.title, ar && styles.rtl, { marginBottom: 8 }]}>
                    {ar ? 'تم بناء ملف العقار' : 'Property file built'}
                  </Text>
                  <Text style={[styles.body, ar && styles.rtl]}>
                    {ar ? `تم حفظ: ${breakdown.local.properties} عقارات` : `Saved: ${breakdown.local.properties} properties`}
                  </Text>
                  <Text style={[styles.body, ar && styles.rtl]}>
                    {ar ? `${breakdown.local.units} وحدات` : `${breakdown.local.units} units`}
                  </Text>
                  <Text style={[styles.body, ar && styles.rtl]}>
                    {ar ? `${breakdown.local.tenants} مستأجرين` : `${breakdown.local.tenants} tenants`}
                  </Text>
                  <Text style={[styles.body, ar && styles.rtl]}>
                    {ar ? `${breakdown.local.contracts} عقود` : `${breakdown.local.contracts} contracts`}
                  </Text>
                  <Text style={[styles.body, ar && styles.rtl]}>
                    {ar
                      ? `${breakdown.local.paidMonths} أشهر مدفوعة · ${breakdown.local.lateMonths} أشهر متأخرة`
                      : `${breakdown.local.paidMonths} paid months · ${breakdown.local.lateMonths} late months`}
                  </Text>
                  {breakdown.local.paidMonths + breakdown.local.lateMonths === 0 ? (
                    <Text style={[styles.warn, ar && styles.rtl]}>
                      {ar
                        ? 'دفتر الأشهر فارغ في هذا الاعتماد — راجع مصدر الأشهر في التحليل أو افتح المدفوعات بعد الاستيراد.'
                        : 'Month ledger empty in this apply — check analysis months source or open payments after import.'}
                    </Text>
                  ) : null}
                  <Text style={[styles.body, ar && styles.rtl]}>
                    {ar
                      ? `${breakdown.local.needsReview} عناصر تحتاج مراجعة`
                      : `${breakdown.local.needsReview} items need review`}
                  </Text>
                </>
              ) : (
                <Text style={[styles.fail, ar && styles.rtl]}>{breakdown.localError || '—'}</Text>
              )}

              <Text style={[styles.sectionLabel, ar && styles.rtl, { marginTop: 14 }]}>
                {ar ? 'المزامنة السحابية (Backend / GAS)' : 'Cloud sync (Backend / GAS)'}
              </Text>
              {breakdown.remoteOk ? (
                <Text style={[styles.body, ar && styles.rtl]}>
                  {ar
                    ? `تم التأكيد${breakdown.gas ? ' عبر GAS' : ' محليًا من الخادم'}.`
                    : `Confirmed${breakdown.gas ? ' via GAS' : ' by local backend'}.`}
                </Text>
              ) : breakdown.localOk ? (
                <Text style={[styles.warn, ar && styles.rtl]}>
                  {ar
                    ? `المزامنة السحابية فشلت — التشغيل محفوظ على الجهاز. أعد المحاولة لاحقًا على شبكة ثابتة.\n${breakdown.remoteError || ''}`
                    : `Cloud sync failed — operations remain on device. Retry later on a stable network.\n${breakdown.remoteError || ''}`}
                </Text>
              ) : (
                <Text style={[styles.fail, ar && styles.rtl]}>
                  {breakdown.remoteError || (ar ? 'لم يُؤكد' : 'Not confirmed')}
                </Text>
              )}

              {breakdown.failed.length && !breakdown.localOk ? (
                <>
                  <Text style={[styles.sectionLabel, ar && styles.rtl, { marginTop: 14 }]}>
                    {ar ? 'ما فشل حفظه' : 'What failed'}
                  </Text>
                  {breakdown.failed.map((f) => (
                    <Text key={f.item} style={[styles.fail, ar && styles.rtl]}>
                      · {f.item}: {f.reason}
                    </Text>
                  ))}
                </>
              ) : breakdown.failed.length && breakdown.localOk ? (
                <>
                  <Text style={[styles.sectionLabel, ar && styles.rtl, { marginTop: 14 }]}>
                    {ar ? 'تفاصيل المزامنة' : 'Sync details'}
                  </Text>
                  {breakdown.failed.map((f) => (
                    <Text key={f.item} style={[styles.warn, ar && styles.rtl]}>
                      · {f.item}: {f.reason}
                    </Text>
                  ))}
                </>
              ) : null}

              <Text style={[styles.sectionLabel, ar && styles.rtl, { marginTop: 14 }]}>
                {ar ? 'ما يحتاج مراجعة' : 'Needs review'}
              </Text>
              {breakdown.needsReviewItems.length ? (
                breakdown.needsReviewItems.slice(0, 6).map((item) => (
                  <Text key={item} style={[styles.body, ar && styles.rtl]}>
                    · {item}
                  </Text>
                ))
              ) : (
                <Text style={[styles.muted, ar && styles.rtl]}>{ar ? 'لا عناصر.' : 'None.'}</Text>
              )}

              {!breakdown.localOk ? (
                <Pressable
                  style={[styles.primaryBtn, applying && styles.btnDisabled, { marginTop: 14 }]}
                  onPress={() => {
                    void runApply();
                  }}
                  disabled={applying}
                  testID="wizard-retry-btn"
                >
                  {applying ? (
                    <ActivityIndicator color={colors.bg} />
                  ) : (
                    <Text style={styles.primaryText}>{ar ? 'إعادة المحاولة' : 'Retry'}</Text>
                  )}
                </Pressable>
              ) : !breakdown.remoteOk ? (
                <Pressable
                  style={[styles.secondaryBtn, applying && styles.btnDisabled, { marginTop: 14, justifyContent: 'center' }]}
                  onPress={() => {
                    void runCloudSyncOnly();
                  }}
                  disabled={applying}
                  testID="wizard-cloud-sync-btn"
                >
                  {applying ? (
                    <ActivityIndicator color={colors.text} />
                  ) : (
                    <Text style={styles.secondaryText}>
                      {ar ? 'إعادة المزامنة السحابية فقط' : 'Retry cloud sync only'}
                    </Text>
                  )}
                </Pressable>
              ) : null}
              {breakdown.localOk ? (
                <View style={styles.navGrid}>
                  <NavBtn
                    label={ar ? 'فتح تشغيل العقار' : 'Open property ops'}
                    onPress={() => router.push('/operational/base' as never)}
                  />
                  <NavBtn
                    label={ar ? 'فتح العقارات' : 'Open properties'}
                    onPress={() => router.push('/operational/base' as never)}
                  />
                  <NavBtn
                    label={ar ? 'فتح الوحدات' : 'Open units'}
                    onPress={() => router.push('/operational/property?tab=units' as never)}
                  />
                  <NavBtn label={ar ? 'فتح المستأجرين' : 'Open tenants'} onPress={() => router.push('/tenants' as never)} />
                  <NavBtn label={ar ? 'فتح العقود' : 'Open contracts'} onPress={() => router.push('/contracts' as never)} />
                  <NavBtn
                    label={ar ? 'فتح المدفوعات' : 'Open payments'}
                    onPress={() => router.push('/operational/payments' as never)}
                  />
                  <NavBtn
                    label={ar ? 'فتح سجل الاستيراد' : 'Open import log'}
                    onPress={() => router.push('/operational/property?tab=imports' as never)}
                  />
                  {onReset ? <NavBtn label={ar ? 'رفع جديد' : 'New upload'} onPress={onReset} /> : null}
                </View>
              ) : null}
            </>
          )}
        </GlassCard>
      ) : null}

      <View style={[styles.navRow, ar && styles.rowRtl]}>
        <Pressable
          style={[styles.secondaryBtn, (stage === 1 || applying) && styles.btnDisabled]}
          onPress={goBack}
          disabled={stage === 1 || applying}
          testID="wizard-back-btn"
        >
          <Feather name={ar ? 'chevron-right' : 'chevron-left'} size={16} color={colors.text} />
          <Text style={styles.secondaryText}>{ar ? 'رجوع' : 'Back'}</Text>
        </Pressable>
        {stage < 5 ? (
          <Pressable style={styles.primaryBtn} onPress={goNext} testID="wizard-next-btn">
            <Text style={styles.primaryText}>{ar ? 'التالي' : 'Next'}</Text>
            <Feather name={ar ? 'chevron-left' : 'chevron-right'} size={16} color={colors.bg} />
          </Pressable>
        ) : (
          <View style={{ flex: 1 }} />
        )}
      </View>

      <Pressable
        style={[styles.techToggle, ar && styles.rowRtl]}
        onPress={() => setTechOpen((v) => !v)}
        testID="wizard-tech-toggle"
      >
        <Feather name={techOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.gold} />
        <Text style={[styles.techToggleText, ar && styles.rtl]}>
          {ar ? 'عرض التفاصيل الفنية' : 'Show technical details'}
        </Text>
      </Pressable>
      {techOpen ? (
        <View style={styles.techBody}>
          <UploadEnginePath analysis={analysis} applied={applyDone} />
          <UploadExecutiveReport analysis={analysis} />
        </View>
      ) : null}
    </Animated.View>
  );
}

function NavBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.navBtn} onPress={onPress}>
      <Text style={styles.navBtnText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.lg, gap: spacing.md },
  block: { marginTop: 0 },
  kicker: { color: colors.gold, fontSize: 12, marginBottom: 4, fontWeight: typography.weight.medium },
  title: { color: colors.text, fontSize: 18, fontWeight: typography.weight.semibold, marginBottom: 12 },
  dots: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.borderStrong },
  dotActive: { backgroundColor: colors.gold, width: 18 },
  dotDone: { backgroundColor: colors.emerald },
  stageMeta: { color: colors.textMuted, fontSize: 12 },
  body: { color: colors.textDim, fontSize: 14, lineHeight: 22 },
  muted: { color: colors.textMuted, fontSize: 12, marginTop: 8, lineHeight: 18 },
  period: { color: colors.gold, fontSize: 13, marginTop: 10 },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  metricLabel: { color: colors.textMuted, fontSize: 13, flex: 1 },
  metricValue: { color: colors.text, fontSize: 14, fontWeight: typography.weight.semibold },
  sectionLabel: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: typography.weight.semibold,
    marginBottom: 6,
  },
  unavailable: { color: colors.textMuted, fontSize: 12, lineHeight: 20 },
  gapLine: { marginBottom: 6 },
  fail: { color: colors.danger, fontSize: 13, lineHeight: 20 },
  warn: { color: colors.gold, fontSize: 13, lineHeight: 20, marginTop: 4 },
  okTitle: { color: colors.emerald, fontSize: 16, fontWeight: typography.weight.semibold },
  navRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gold,
    paddingVertical: 14,
    borderRadius: radius.pill,
  },
  primaryText: { color: colors.bg, fontSize: 14, fontWeight: typography.weight.semibold },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    paddingVertical: 14,
    borderRadius: radius.pill,
  },
  secondaryText: { color: colors.text, fontSize: 14 },
  btnDisabled: { opacity: 0.45 },
  techToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  techToggleText: { color: colors.gold, fontSize: 13, fontWeight: typography.weight.medium },
  techBody: { gap: spacing.md },
  navGrid: { marginTop: 14, gap: 8 },
  navBtn: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.emeraldEdge,
    backgroundColor: colors.emeraldSoft,
    alignItems: 'center',
  },
  navBtnText: { color: colors.emerald, fontSize: 13, fontWeight: typography.weight.medium },
  rowRtl: { flexDirection: 'row-reverse' },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
});
