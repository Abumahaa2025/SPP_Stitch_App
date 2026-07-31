import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { GlassCard } from '@/src/components/GlassCard';
import { LatePaymentsSection } from '@/src/components/LatePaymentsSection';
import { AppIcon } from '@/src/components/ui/AppIcon';
import type {
  ExecutiveBrief,
  PortfolioAnalysis,
  ReportSection,
} from '@/src/api/portfolio-analysis';
import { colors, spacing, typography, radius } from '@/src/theme';
import { useI18n } from '@/src/i18n';
import { useRouter } from 'expo-router';
import { arrearsFromAnalysis } from '@/src/utils/ops-truth';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = { analysis: PortfolioAnalysis; delay?: number };

type DetailGroup = {
  id: string;
  title: string;
  summary: string;
  sections: ReportSection[];
  late?: boolean;
};

function primaryText(value: string): string {
  const lines = (value || '').split('\n');
  return lines[0]?.trim() || value;
}

function evidenceFromItem(item: { value: string; evidence?: string[] }): string[] {
  if (item.evidence?.length) return item.evidence;
  const lines = (item.value || '').split('\n').slice(1);
  return lines
    .map((l) => l.replace(/^(دليل|Evidence|المصدر|Source)\s*:\s*/i, '').trim())
    .filter(Boolean)
    .filter((l) => !/^(unit=|consecutive=|tenant=)/i.test(l));
}

function humanEvidenceLine(ev: string, ar: boolean): string {
  const cleaned = ev
    .replace(/\bunit=/gi, ar ? 'الوحدة ' : 'unit ')
    .replace(/\bconsecutive=\d+/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (/^(المصدر|Source)/i.test(cleaned)) return cleaned;
  return ar ? `المصدر: ${cleaned}` : `Source: ${cleaned}`;
}

function CollapsibleSection({
  title,
  summary,
  children,
}: {
  title: string;
  summary: string;
  children: React.ReactNode;
}) {
  const { isRTL } = useI18n();
  const [open, setOpen] = useState(false);

  const toggle = () => {
    Haptics.selectionAsync();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((v) => !v);
  };

  return (
    <GlassCard padding={16} radiusToken="md" style={styles.sectionCard}>
      <Pressable onPress={toggle} accessibilityRole="button">
        <View style={[styles.collapseHeader, isRTL && styles.rowRtl]}>
          <View style={styles.collapseText}>
            <Text style={[styles.sectionTitle, isRTL && styles.rtl]}>{title}</Text>
            <Text style={[styles.sectionSummary, isRTL && styles.rtl]} numberOfLines={open ? 4 : 2}>
              {summary}
            </Text>
          </View>
          <Feather name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
        </View>
      </Pressable>
      {open ? <View style={styles.collapseBody}>{children}</View> : null}
    </GlassCard>
  );
}

function SectionItems({ sec, isRTL, ar }: { sec: ReportSection; isRTL: boolean; ar: boolean }) {
  return (
    <View style={styles.itemsBlock}>
      {sec.title ? <Text style={[styles.innerTitle, isRTL && styles.rtl]}>{sec.title}</Text> : null}
      {sec.items.map((item, idx) => {
        const body = primaryText(item.value);
        const evidence = evidenceFromItem(item);
        return (
          <View key={`${sec.key}-${idx}`} style={[styles.finding, idx > 0 && styles.findingBorder]}>
            {item.label && item.label !== '—' && item.label !== 'كويل' && item.label !== 'Koil' ? (
              <Text style={[styles.findingBadge, isRTL && styles.rtl]}>{item.label}</Text>
            ) : null}
            <Text style={[styles.findingBody, isRTL && styles.rtl]}>{body}</Text>
            {evidence.map((ev) => (
              <Text key={ev} style={[styles.evidence, isRTL && styles.rtl]}>
                {humanEvidenceLine(ev, ar)}
              </Text>
            ))}
          </View>
        );
      })}
    </View>
  );
}

function statusTone(label?: string): 'good' | 'watch' | 'critical' {
  const s = label || '';
  if (s.includes('حرج') || s.toLowerCase().includes('critical')) return 'critical';
  if (s.includes('جيدة') || s.toLowerCase().includes('good')) return 'good';
  return 'watch';
}

function buildBriefFallback(analysis: PortfolioAnalysis, ar: boolean): ExecutiveBrief {
  const m = analysis.metrics;
  const arrears = arrearsFromAnalysis(analysis);
  return {
    title: ar ? 'تقرير كويل التنفيذي' : 'Koil executive report',
    status_label: ar ? 'تحتاج متابعة' : 'Needs follow-up',
    property_status: analysis.success_message || (ar ? 'التقرير جاهز.' : 'Report ready.'),
    decisions_today: [ar ? 'افتح الأقسام فقط عند الحاجة' : 'Open sections only if needed'],
    key_numbers: [
      { label: ar ? 'الوحدات' : 'Units', value: String(m.units) },
      { label: ar ? 'نسبة الإشغال' : 'Occupancy', value: `${m.occupancy_pct}%` },
      { label: ar ? 'التحصيل' : 'Collection', value: `${m.collection_rate_pct ?? '—'}%` },
      {
        label: ar ? 'المتأخرات المؤكدة' : 'Confirmed arrears',
        value: `${arrears.totalUnpaid.toLocaleString()}`,
      },
      { label: ar ? 'الصيانة' : 'Maintenance', value: String(m.total_expenses || 0) },
      { label: ar ? 'العقود المنتهية' : 'Expired contracts', value: String(m.contracts_expired || 0) },
    ],
    confidence: 70,
    confidence_level: ar ? 'مرجح' : 'Likely',
    needs_review: [ar ? 'حدّث التطبيق لعرض الملخص الكامل' : 'Update app for full brief'],
  };
}

function groupSections(
  sections: ReportSection[],
  analysis: PortfolioAnalysis,
  ar: boolean,
): DetailGroup[] {
  const byKey = Object.fromEntries(sections.map((s) => [s.key, s]));
  const take = (...keys: string[]) => keys.map((k) => byKey[k]).filter(Boolean) as ReportSection[];
  const m = analysis.metrics;
  const arrearsTruth = arrearsFromAnalysis(analysis);

  const summarize = (secs: ReportSection[], fallback: string) => {
    if (!secs.length) return fallback;
    const first = secs[0]?.items?.[0];
    if (first) return `${first.label}: ${primaryText(first.value)}`.replace(/^—:\s*/, '');
    return fallback;
  };

  const monthsSecs = take('months', 'revenue', 'portfolio', 'units_summary');
  const lateSecs = take('late_tenants', 'late');
  const contractSecs = take('contracts');
  const maintSecs = take('expenses');
  const moveSecs = take('departed', 'moved_in');
  const qualitySecs = take(
    'quality',
    'files',
    'koil_understanding_summary',
    'koil_understanding_files',
    'koil_understanding_relationships',
    'koil_understanding_ambiguities',
  );
  const techSecs = take('koil_why', 'koil_what', 'koil_risks', 'koil_recommendations', 'koil_brief');

  const groups: DetailGroup[] = [
    {
      id: 'collection',
      title: ar ? 'التحصيل' : 'Collection',
      summary: ar
        ? `تحصيل ${m.collection_rate_pct ?? '—'}% · محصل ${(m.collected || 0).toLocaleString()} ر.س`
        : `Collection ${m.collection_rate_pct ?? '—'}%`,
      sections: monthsSecs,
    },
    {
      id: 'late',
      title: ar ? 'المتأخرات' : 'Arrears',
      summary: ar
        ? `${arrearsTruth.lateTenantCount} مستأجر · ${arrearsTruth.totalUnpaid.toLocaleString()} ر.س`
        : `${arrearsTruth.lateTenantCount} · ${arrearsTruth.totalUnpaid.toLocaleString()}`,
      sections: lateSecs,
      late: true,
    },
    {
      id: 'contracts',
      title: ar ? 'العقود' : 'Contracts',
      summary: ar
        ? `منتهية ${m.contracts_expired || 0} · قريبة ${m.contracts_expiring_soon || 0}`
        : `Expired ${m.contracts_expired || 0}`,
      sections: contractSecs,
    },
    {
      id: 'maint',
      title: ar ? 'الصيانة' : 'Maintenance',
      summary: ar
        ? `إجمالي ${(m.total_expenses || 0).toLocaleString()} ر.س`
        : `Total ${(m.total_expenses || 0).toLocaleString()}`,
      sections: maintSecs,
    },
    {
      id: 'moves',
      title: ar ? 'حركة المستأجرين' : 'Tenant movement',
      summary: summarize(moveSecs, ar ? 'يحتمل تغييرات — راجع عند الحاجة' : 'Possible changes — review if needed'),
      sections: moveSecs,
    },
    {
      id: 'quality',
      title: ar ? 'جودة البيانات' : 'Data quality',
      summary: summarize(qualitySecs, ar ? 'جودة الملفات والاستيراد' : 'File and import quality'),
      sections: qualitySecs,
    },
    {
      id: 'evidence',
      title: ar ? 'الأدلة' : 'Evidence',
      summary: ar ? 'تفاصيل الاستنتاج عند الحاجة فقط' : 'Inference detail only if needed',
      sections: techSecs,
    },
  ];

  if (analysis.month_comparison?.length) {
    const lateByMonth = new Map<string, { late: number; unpaid: number }>();
    (analysis.late_payments?.months ?? []).forEach((mth) => {
      lateByMonth.set(mth.label, {
        late: mth.tenant_count || (mth.tenants?.length ?? 0),
        unpaid: mth.month_total || 0,
      });
    });
    const cmpSec: ReportSection = {
      key: 'month_comparison_inline',
      title: ar ? 'مقارنة الأشهر (من دفع / من تأخر)' : 'Month compare (paid / late)',
      items: analysis.month_comparison.slice(0, 8).map((row) => {
        const lateInfo = lateByMonth.get(row.month);
        const latePart = lateInfo
          ? ar
            ? ` · متأخرون ${lateInfo.late} · ${(lateInfo.unpaid || 0).toLocaleString()} ر.س`
            : ` · late ${lateInfo.late} · ${(lateInfo.unpaid || 0).toLocaleString()}`
          : '';
        return {
          label: row.month,
          value: ar
            ? `إيراد ${row.revenue.toLocaleString()} · مصروف ${row.expenses.toLocaleString()}${latePart}`
            : `rev ${row.revenue.toLocaleString()} · exp ${row.expenses.toLocaleString()}${latePart}`,
        };
      }),
    };
    const g = groups.find((x) => x.id === 'collection');
    if (g) g.sections = [...g.sections, cmpSec];
  }

  const eng = analysis.executive_brief?.engines;
  const movesG = groups.find((x) => x.id === 'moves');
  if (movesG && movesG.sections.length === 0 && eng?.lifecycle) {
    movesG.sections = [
      {
        key: 'lifecycle_engines',
        title: ar ? 'حركة المستأجرين' : 'Tenant movement',
        items: [
          {
            label: ar ? 'المغادرون' : 'Departed',
            value: String(eng.lifecycle.departed_count ?? 0),
          },
          {
            label: ar ? 'الداخلون' : 'Arrived',
            value: String(eng.lifecycle.newcomers_count ?? 0),
          },
          { label: ar ? 'خرج' : 'Left', value: eng.lifecycle.who_left || '—' },
          { label: ar ? 'دخل' : 'Entered', value: eng.lifecycle.who_entered || '—' },
        ],
      },
    ];
  }
  const maintG = groups.find((x) => x.id === 'maint');
  if (maintG && maintG.sections.length === 0 && (eng?.maintenance?.count || 0) > 0) {
    maintG.sections = [
      {
        key: 'maint_engines',
        title: ar ? 'الصيانة' : 'Maintenance',
        items: [
          {
            label: ar ? 'السجلات' : 'Rows',
            value: String(eng?.maintenance?.count ?? 0),
          },
          {
            label: ar ? 'الإجمالي' : 'Total',
            value: `${(eng?.maintenance?.total ?? 0).toLocaleString()}`,
          },
        ],
      },
    ];
  }
  const contractG = groups.find((x) => x.id === 'contracts');
  if (contractG && contractG.sections.length === 0 && eng?.contracts) {
    contractG.sections = [
      {
        key: 'contracts_engines',
        title: ar ? 'العقود' : 'Contracts',
        items: [
          {
            label: ar ? 'منتهية / قريبة' : 'Expired / soon',
            value: `${eng.contracts.expired ?? 0} / ${eng.contracts.expiring_soon ?? 0}`,
          },
          {
            label: ar ? 'فجوات جوال / عقد' : 'Phone / contract gaps',
            value: `${eng.contracts.missing_phone ?? 0} / ${eng.contracts.missing_contract ?? 0}`,
          },
        ],
      },
    ];
  }

  return groups.filter((g) => {
    if (g.sections.length > 0) return true;
    if (g.late && analysis.late_payments) return true;
    if (g.id === 'maint' && (m.total_expenses || 0) > 0) return true;
    if (g.id === 'contracts') return true;
    if (g.id === 'moves') return true;
    if (g.id === 'quality') return true;
    if (g.id === 'collection') return true;
    return false;
  });
}

/** Decision-first executive report — details stay folded. Numbers open ops records. */
export function UploadExecutiveReport({ analysis, delay = 0 }: Props) {
  const { isRTL } = useI18n();
  const ar = isRTL;
  const router = useRouter();
  const { executive_report: report, late_payments } = analysis;
  const arrearsTruth = useMemo(() => arrearsFromAnalysis(analysis), [analysis]);

  const openOps = (tab: string, filter?: string) => {
    Haptics.selectionAsync();
    const q = [`tab=${tab}`];
    if (filter) q.push(`filter=${filter}`);
    router.push(`/operational/property?${q.join('&')}` as any);
  };

  const routeForKeyNumber = (label: string) => {
    const l = label.toLowerCase();
    if (/متأخر|late|arrear|unpaid/.test(l)) return openOps('payments', 'arrears');
    if (/عقد|contract|منته|expir/.test(l)) return openOps('contracts', 'followup');
    if (/شاغر|vacant|وحد|unit/.test(l)) return openOps('units', /شاغر|vacant/.test(l) ? 'vacant' : undefined);
    if (/صيان|maint/.test(l)) return openOps('maintenance');
    if (/تحصيل|collect|إيراد|occup/.test(l)) return openOps('payments');
    return openOps('units');
  };

  const brief = useMemo(
    () => analysis.executive_brief || buildBriefFallback(analysis, ar),
    [analysis, ar],
  );

  const groups = useMemo(
    () => groupSections(report.sections || [], analysis, ar),
    [report.sections, analysis, ar],
  );

  const decisions =
    brief.decisions_today?.length
      ? brief.decisions_today
      : brief.top_action
        ? [brief.top_action]
        : [];

  const tone = statusTone(brief.status_label);
  const confTone =
    brief.confidence_level.includes('مؤكد') || brief.confidence_level.toLowerCase().includes('confirm')
      ? 'ok'
      : brief.confidence_level.includes('مراجعتك') || brief.confidence_level.toLowerCase().includes('review')
        ? 'review'
        : 'likely';

  return (
    <Animated.View entering={FadeInDown.duration(600).delay(delay)} style={styles.wrap}>
      <View style={[styles.header, isRTL && styles.rowRtl]}>
        <AppIcon name="cpu" size="md" accent="gold" />
        <Text style={[styles.title, isRTL && styles.rtl]}>
          {brief.title || (ar ? 'تقرير كويل التنفيذي' : 'Koil executive report')}
        </Text>
      </View>

      <GlassCard padding={20} radiusToken="lg" edge="gold">
        {brief.period ? <Text style={[styles.period, isRTL && styles.rtl]}>{brief.period}</Text> : null}

        <Text style={[styles.statusLabel, isRTL && styles.rtl]}>{ar ? 'حالة العقار' : 'Property status'}</Text>
        {brief.status_label ? (
          <Text
            style={[
              styles.statusBadge,
              tone === 'good' && styles.statusGood,
              tone === 'watch' && styles.statusWatch,
              tone === 'critical' && styles.statusCritical,
              isRTL && styles.rtl,
            ]}
          >
            {brief.status_label}
          </Text>
        ) : null}
        <Text style={[styles.statusText, isRTL && styles.rtl]}>{brief.property_status}</Text>

        {/* Confirmed arrears — same SoT as summary/late_payments (ops-truth) */}
        <Pressable
          onPress={() => openOps('payments', 'arrears')}
          style={[styles.arrearsBox, (brief.arrears?.count || arrearsTruth.lateTenantCount || 0) > 0 && styles.arrearsHot]}
          testID="exec-arrears-drill"
        >
          <Text style={[styles.statusLabel, isRTL && styles.rtl]}>
            {ar ? 'المتأخرات المؤكدة' : 'Confirmed arrears'}
          </Text>
          <Text style={[styles.arrearsTitle, isRTL && styles.rtl]}>
            {brief.arrears?.label ||
              (ar
                ? `${brief.arrears?.count ?? arrearsTruth.lateTenantCount} مستأجر · ${(brief.arrears?.total ?? arrearsTruth.totalUnpaid).toLocaleString()} ر.س`
                : `${brief.arrears?.count ?? arrearsTruth.lateTenantCount} · ${brief.arrears?.total ?? arrearsTruth.totalUnpaid}`)}
          </Text>
          {(brief.critical_cases || brief.arrears?.critical_names || []).length > 0 ? (
            <Text style={[styles.criticalLine, isRTL && styles.rtl]}>
              {(ar ? 'الحرجة: ' : 'Critical: ') +
                (brief.critical_cases || brief.arrears?.critical_names || []).join(' · ')}
            </Text>
          ) : null}
          {brief.collection_recs_allowed === false ? (
            <Text style={[styles.noteLine, isRTL && styles.rtl]}>
              {ar
                ? 'لا توصيات تحصيل آلية — يوجد أشهر سداد غير واضحة'
                : 'No auto collection advice — unclear payment months remain'}
            </Text>
          ) : null}
        </Pressable>

        <View style={styles.briefBlock}>
          <Text style={[styles.statusLabel, isRTL && styles.rtl]}>{ar ? 'ماذا حدث؟' : 'What happened?'}</Text>
          {(brief.story?.length
            ? brief.story
            : [brief.what_happened || brief.property_status]
          ).map((line) => (
            <Text key={line} style={[styles.storyLine, isRTL && styles.rtl]}>
              • {line}
            </Text>
          ))}
        </View>

        {brief.engines ? (
          <View style={styles.enginesBox}>
            <Text style={[styles.statusLabel, isRTL && styles.rtl]}>
              {ar ? 'ملخص التشغيل' : 'Operations summary'}
            </Text>
            <Text style={[styles.metaLine, isRTL && styles.rtl]}>
              {ar
                ? `تحصيل ${brief.engines.collection?.rate_pct ?? '—'}% · متأخرون ${brief.engines.late?.tenant_count ?? 0} · حركة ${brief.engines.lifecycle?.confirmed_moves ?? brief.engines.lifecycle?.departed_count ?? 0}`
                : `Collection ${brief.engines.collection?.rate_pct ?? '—'}% · late ${brief.engines.late?.tenant_count ?? 0}`}
            </Text>
            <Text style={[styles.metaLine, isRTL && styles.rtl]}>
              {ar
                ? `صيانة ${brief.engines.maintenance?.count ?? 0} · ${(brief.engines.maintenance?.total ?? 0).toLocaleString()} ر.س · عقود ${brief.engines.contracts?.expired ?? 0}/${brief.engines.contracts?.expiring_soon ?? 0} · بطاقات ${brief.engines.tenant_cards?.count ?? 0}`
                : `Maint ${brief.engines.maintenance?.count ?? 0} · contracts ${brief.engines.contracts?.expired ?? 0}`}
            </Text>
            <Text style={[styles.metaLine, isRTL && styles.rtl]}>
              {(ar ? 'خرج: ' : 'Left: ') + (brief.engines.lifecycle?.who_left || brief.who_left || '—')}
            </Text>
            <Text style={[styles.metaLine, isRTL && styles.rtl]}>
              {(ar ? 'دخل: ' : 'Entered: ') + (brief.engines.lifecycle?.who_entered || brief.who_entered || '—')}
            </Text>
          </View>
        ) : (
          <View style={styles.briefBlock}>
            <Text style={[styles.statusLabel, isRTL && styles.rtl]}>{ar ? 'ماذا تغيّر؟' : 'What changed?'}</Text>
            <Text style={[styles.storyLine, isRTL && styles.rtl]}>
              {brief.what_changed || (ar ? 'لا تغيّر مؤكد.' : 'No confirmed change.')}
            </Text>
            <Text style={[styles.metaLine, isRTL && styles.rtl]}>
              {(ar ? 'خرج: ' : 'Left: ') + (brief.who_left || '—')}
            </Text>
            <Text style={[styles.metaLine, isRTL && styles.rtl]}>
              {(ar ? 'دخل: ' : 'Entered: ') + (brief.who_entered || '—')}
            </Text>
          </View>
        )}

        <View style={styles.briefBlock}>
          <Text style={[styles.statusLabel, isRTL && styles.rtl]}>{ar ? 'ما الأخطر؟' : 'Biggest risk?'}</Text>
          <Text style={[styles.problemLine, isRTL && styles.rtl]}>
            {brief.biggest_problem || brief.top_risk || '—'}
          </Text>
        </View>

        <View style={styles.reviewBox}>
          <Text style={[styles.statusLabel, isRTL && styles.rtl]}>
            {ar ? 'ماذا أراجع اليوم؟' : 'What to review today?'}
          </Text>
          {brief.needs_review.map((line) => (
            <Text key={line} style={[styles.reviewLine, isRTL && styles.rtl]}>
              • {line}
            </Text>
          ))}
        </View>

        <View style={styles.briefBlock}>
          <Text style={[styles.statusLabel, isRTL && styles.rtl]}>
            {ar ? 'إجراءات اليوم' : 'Actions today'}
          </Text>
          {(brief.actions_today?.length ? brief.actions_today : decisions).slice(0, 5).map((d, i) => (
            <Text key={`${i}-${d}`} style={[styles.decisionLine, isRTL && styles.rtl]}>
              {i + 1}. {d}
            </Text>
          ))}
        </View>

        <Text style={[styles.statusLabel, isRTL && styles.rtl]}>{ar ? 'أهم الأرقام' : 'Key numbers'}</Text>
        <View style={styles.numRow}>
          {brief.key_numbers.map((n) => (
            <Pressable
              key={n.label}
              style={styles.numCell}
              onPress={() => routeForKeyNumber(n.label)}
              testID={`exec-num-${n.label}`}
            >
              <Text style={[styles.numLabel, isRTL && styles.rtl]}>{n.label}</Text>
              <Text style={styles.numValue}>{n.value}</Text>
              <Text style={[styles.numHint, isRTL && styles.rtl]}>{ar ? 'اضغط للفتح' : 'Tap to open'}</Text>
            </Pressable>
          ))}
        </View>

        <View style={[styles.confRow, isRTL && styles.rowRtl]}>
          <Text
            style={[
              styles.confBadge,
              confTone === 'ok' && styles.confOk,
              confTone === 'review' && styles.confReview,
              confTone === 'likely' && styles.confLikely,
              isRTL && styles.rtl,
            ]}
          >
            {brief.confidence_level}
          </Text>
          <Text style={[styles.confPct, isRTL && styles.rtl]}>{Math.round(brief.confidence)}%</Text>
        </View>
      </GlassCard>

      <Text style={[styles.detailsHint, isRTL && styles.rtl]}>
        {ar ? 'التفاصيل اختيارية — اضغط للفتح عند الحاجة' : 'Optional details — tap to expand'}
      </Text>

      {groups.map((g, i) => (
        <Animated.View key={g.id} entering={FadeInDown.duration(450).delay(delay + 40 + i * 35)}>
          {g.late && late_payments ? (
            <CollapsibleSection title={g.title} summary={g.summary}>
              <LatePaymentsSection
                data={late_payments}
                title={g.title}
                delay={0}
                embedded
                tenantCards={analysis.property_knowledge?.tenants || []}
              />
              <Pressable onPress={() => openOps('payments', 'arrears')} style={{ marginTop: 10 }}>
                <Text style={[styles.numHint, isRTL && styles.rtl]}>
                  {ar ? 'فتح دفتر المتأخرات ←' : 'Open arrears ledger →'}
                </Text>
              </Pressable>
            </CollapsibleSection>
          ) : (
            <CollapsibleSection title={g.title} summary={g.summary}>
              {g.sections.map((sec) => (
                <SectionItems key={sec.key} sec={sec} isRTL={isRTL} ar={ar} />
              ))}
              {g.id === 'contracts' || g.id === 'maint' || g.id === 'collection' ? (
                <Pressable
                  onPress={() => {
                    if (g.id === 'contracts') openOps('contracts', 'followup');
                    else if (g.id === 'maint') openOps('maintenance');
                    else openOps('payments');
                  }}
                  style={{ marginTop: 10 }}
                >
                  <Text style={[styles.numHint, isRTL && styles.rtl]}>
                    {ar ? 'فتح السجلات ←' : 'Open records →'}
                  </Text>
                </Pressable>
              ) : null}
            </CollapsibleSection>
          )}
        </Animated.View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.xl, gap: spacing.md, paddingBottom: 96 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  rowRtl: { flexDirection: 'row-reverse' },
  title: { color: colors.text, fontSize: 18, fontWeight: typography.weight.semibold, flex: 1 },
  period: { color: colors.textMuted, fontSize: 12, marginBottom: 12 },
  statusLabel: {
    color: colors.textMuted,
    fontSize: 11,
    marginBottom: 6,
    fontWeight: typography.weight.medium,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    fontSize: 13,
    fontWeight: typography.weight.semibold,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.sm,
    overflow: 'hidden',
    marginBottom: 8,
  },
  statusGood: { color: '#7dcea0', backgroundColor: 'rgba(125,206,160,0.14)' },
  statusWatch: { color: colors.gold, backgroundColor: 'rgba(212,175,55,0.14)' },
  statusCritical: { color: colors.danger, backgroundColor: 'rgba(220,80,80,0.14)' },
  statusText: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 24,
    fontWeight: typography.weight.medium,
    marginBottom: 16,
  },
  briefBlock: { marginBottom: 16, gap: 6 },
  decisionLine: {
    color: colors.gold,
    fontSize: 15,
    lineHeight: 24,
    fontWeight: typography.weight.semibold,
  },
  storyLine: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 4,
  },
  metaLine: {
    color: colors.textDim,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
  problemLine: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 24,
    fontWeight: typography.weight.semibold,
    marginBottom: 4,
  },
  arrearsBox: {
    marginBottom: 16,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: 4,
  },
  enginesBox: {
    marginBottom: 16,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: 4,
  },
  arrearsHot: {
    borderColor: 'rgba(220,80,80,0.45)',
    backgroundColor: 'rgba(220,80,80,0.10)',
  },
  arrearsTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: typography.weight.semibold,
    lineHeight: 22,
  },
  criticalLine: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 4,
  },
  noteLine: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  numRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  numCell: {
    width: '47%',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  numLabel: { color: colors.textMuted, fontSize: 10 },
  numValue: { color: colors.text, fontSize: 16, fontWeight: typography.weight.semibold, marginTop: 4 },
  numHint: { color: colors.gold, fontSize: 9, marginTop: 4 },
  confRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  confBadge: {
    fontSize: 12,
    fontWeight: typography.weight.semibold,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.sm,
    overflow: 'hidden',
    color: colors.text,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  confOk: { color: '#7dcea0', backgroundColor: 'rgba(125,206,160,0.12)' },
  confLikely: { color: colors.gold, backgroundColor: 'rgba(212,175,55,0.12)' },
  confReview: { color: colors.danger, backgroundColor: 'rgba(220,80,80,0.12)' },
  confPct: { color: colors.textDim, fontSize: 12 },
  reviewBox: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 12,
    gap: 4,
  },
  reviewLine: { color: colors.textDim, fontSize: 13, lineHeight: 20 },
  detailsHint: { color: colors.textMuted, fontSize: 12, marginTop: 8, marginBottom: 2 },
  sectionCard: { marginTop: 2 },
  collapseHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  collapseText: { flex: 1, gap: 4 },
  sectionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: typography.weight.semibold,
  },
  sectionSummary: { color: colors.textDim, fontSize: 12, lineHeight: 18 },
  collapseBody: { marginTop: 12, gap: 10 },
  itemsBlock: { gap: 2 },
  innerTitle: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: 6,
    fontWeight: typography.weight.medium,
  },
  finding: { paddingVertical: 8, gap: 4 },
  findingBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    marginTop: 2,
  },
  findingBadge: { color: colors.textMuted, fontSize: 11, fontWeight: typography.weight.medium },
  findingBody: { color: colors.text, fontSize: 14, lineHeight: 22, fontWeight: typography.weight.medium },
  evidence: { color: colors.textDim, fontSize: 12, lineHeight: 18 },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
});
