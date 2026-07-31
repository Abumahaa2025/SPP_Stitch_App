import { getLang } from '../i18n';
import { api } from './client';
import { apiUrl } from '../constants/backend';

export type PortfolioMetrics = {
  properties: number;
  units: number;
  tenants: number;
  occupancy_pct: number;
  occupied_units: number;
  vacant_units: number;
  total_revenue_annual: number;
  collected: number;
  remaining: number;
  total_expenses: number;
  contracts_expired: number;
  contracts_expiring_soon: number;
  late_tenants: number;
  late_value: number;
  maintenance_open: number;
  maintenance_done: number;
  net_profit: number;
  balance: number;
  files_analyzed: number;
  collection_rate_pct?: number;
  months_linked?: number;
  departed_count?: number;
  newcomers_count?: number;
  /** Additive unified-summary fields (backend ≥ summary payload). */
  contracts?: number;
  contracts_count?: number;
  rents?: number;
  missing_phone?: number;
  missing_contract?: number;
  gaps?: number;
};

/** Unified owner summary — same numbers the analysis screen and Apply should share. */
export type UnifiedPortfolioSummary = {
  properties: number;
  units: number;
  tenants: number;
  contracts: number;
  rents: number;
  collected: number;
  remaining: number;
  late_tenants: number;
  late_value: number;
  contracts_expired: number;
  contracts_expiring_soon: number;
  missing_phone: number;
  missing_contract: number;
  gaps: number;
  occupancy_pct?: number;
  collection_rate_pct?: number;
  period?: string;
  files_analyzed?: number;
  months_linked?: number;
  maintenance_count?: number;
  maintenance_total?: number;
  maintenance_open?: number;
  paid_month_count?: number;
  payment_month_rows?: number;
  payments?: {
    collected: number;
    remaining: number;
    expected: number;
    collection_rate_pct: number;
    months_linked: number;
    paid_month_count: number;
    payment_month_rows: number;
    confirmed_late_month_count: number;
  };
  arrears?: {
    late_tenants: number;
    late_value: number;
    confirmed_late_month_count: number;
  };
  maintenance?: {
    count: number;
    total: number;
    open: number;
  };
  reports?: {
    files_analyzed: number;
    months_linked: number;
    executive_ready: boolean;
    section_count: number;
    count: number;
  };
  gaps_detail?: {
    total: number;
    missing_phone: number;
    missing_contract: number;
    unknown_month_count: number;
  };
  data_status?: {
    overall: 'confirmed' | 'needs_review' | 'incomplete' | 'conflicting' | string;
    decision_status: string;
    ledger_trust: string;
    confirmed: number;
    needs_review: number;
    incomplete: number;
    conflicting: number;
    conflict_count: number;
    unknown_month_count: number;
    units_needs_review: number;
    parse_errors: number;
    files_without_content: number;
    quality_warnings: number;
    collection_recs_allowed: boolean;
  };
};

export type LatePaymentTenantEntry = {
  tenant: string;
  unit: string;
  contract: string;
  phone: string;
  due: number;
  paid: number;
  remaining: number;
  status: string;
  status_label: string;
};

export type LatePaymentMonth = {
  key: string;
  label: string;
  year: number;
  month: number;
  tenant_count: number;
  month_total: number;
  tenants: LatePaymentTenantEntry[];
};

export type LatePaymentTenantTotal = {
  tenant: string;
  unit: string;
  contract: string;
  phone: string;
  late_month_count: number;
  total_unpaid: number;
  months: { label: string; amount: number; year?: number; month?: number }[];
};

export type LatePaymentsReport = {
  summary: {
    total_unpaid: number;
    late_tenant_count: number;
    top_tenant?: {
      tenant: string;
      unit: string;
      total_unpaid: number;
      late_month_count?: number;
    } | null;
    oldest_tenant?: {
      tenant: string;
      unit: string;
      month_label: string;
      total_unpaid?: number;
    } | null;
  };
  months: LatePaymentMonth[];
  tenant_totals: LatePaymentTenantTotal[];
};

export type ReportSection = {
  key: string;
  title: string;
  summary?: string;
  items: { label: string; value: string; evidence?: string[] }[];
};

export type TenantMonthStatus = {
  month?: number;
  year?: number;
  label: string;
  status: string;
  status_label?: string;
  due?: number;
  paid?: number;
  remaining?: number;
};

export type TenantKnowledgeCard = {
  id?: string;
  tenant: string;
  unit: string;
  phone?: string;
  contract?: string;
  rent?: number;
  contract_start?: string;
  contract_end?: string;
  contract_start_label?: string;
  contract_end_label?: string;
  first_seen_label?: string;
  last_seen_label?: string;
  dates_note?: string;
  months?: TenantMonthStatus[];
  confirmed_arrears?: number;
  confirmed_late_months?: number;
  last_important_change?: string;
};

export type LifecycleActiveRow = {
  tenant?: string;
  unit?: string;
  phone?: string;
  rent?: number;
};

export type PropertyKnowledge = {
  tenants?: TenantKnowledgeCard[];
  meta?: {
    period_from?: string;
    period_to?: string;
    files_count?: number;
    month_count?: number;
    source?: string;
  };
  lifecycle?: {
    active?: LifecycleActiveRow[];
    departed?: LifecycleActiveRow[];
    newcomers?: LifecycleActiveRow[];
    tenant_changes?: { unit?: string; type?: string; confirmed?: boolean }[];
    month_count?: number;
  };
  ledger_quality?: {
    unknown_month_count?: number;
    collection_recs_allowed?: boolean;
    ledger_trust?: string;
  };
};

export type ExecutiveBrief = {
  title?: string;
  status_label?: string;
  property_status: string;
  /** Operational story lines (confirmed facts) */
  story?: string[];
  what_happened?: string;
  what_changed?: string;
  who_left?: string;
  who_entered?: string;
  biggest_problem?: string;
  top_decision?: string;
  decisions_today?: string[];
  actions_today?: string[];
  arrears?: {
    count?: number;
    total?: number;
    critical_names?: string[];
    label?: string;
  };
  critical_cases?: string[];
  engines?: {
    collection?: { rate_pct?: number; collected?: number; expected?: number };
    late?: { tenant_count?: number; total_unpaid?: number; critical_names?: string[] };
    lifecycle?: {
      departed_count?: number;
      newcomers_count?: number;
      confirmed_moves?: number;
      who_left?: string;
      who_entered?: string;
      replacements?: string[];
    };
    maintenance?: { count?: number; total?: number };
    contracts?: {
      expired?: number;
      expiring_soon?: number;
      missing_phone?: number;
      missing_contract?: number;
    };
    quality?: { warning_count?: number };
    tenant_cards?: { count?: number };
    ledger_quality?: { unknown_month_count?: number; collection_recs_allowed?: boolean };
  };
  key_numbers: { label: string; value: string }[];
  needs_review: string[];
  confidence: number;
  confidence_level: string;
  decision_status?: string;
  collection_recs_allowed?: boolean;
  period?: string;
  /** @deprecated kept for older clients */
  top_risk?: string;
  /** @deprecated kept for older clients */
  top_action?: string;
};

export type SmartDecision = {
  id: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  action: string;
};

export type NextAction = {
  key: string;
  icon: string;
  route: string;
};

export type PortfolioAnalysis = {
  analysis_id: string;
  success_message: string;
  prompt_message: string;
  what_now_message: string;
  prompt_options: { key: string; label: string }[];
  metrics: PortfolioMetrics;
  /** Additive unified numbers for summary screen — mirrors metrics + brief.engines. */
  summary?: UnifiedPortfolioSummary | null;
  executive_brief?: ExecutiveBrief | null;
  executive_report: { title: string; year: number; sections: ReportSection[] };
  late_payments?: LatePaymentsReport | null;
  property_knowledge?: PropertyKnowledge | null;
  month_comparison: { month: string; revenue: number; expenses: number }[];
  expense_by_type: { type: string; amount: number }[];
  smart_decisions: SmartDecision[];
  next_actions: NextAction[];
  /** Set by client — which engine produced this result */
  _source?: 'render' | 'fallback';
};

export type UploadFileMeta = {
  name: string;
  mimeType?: string;
  size?: number;
  textSnippet?: string;
  parsedFromExcel?: boolean;
};

// Render free tier cold start (~60s) + full analysis (~30-60s) can exceed 90s.
const ANALYSIS_TIMEOUT_MS = 240_000;

export async function fetchPortfolioAnalysis(files: UploadFileMeta[]): Promise<PortfolioAnalysis> {
  const lang = getLang();
  const url = apiUrl('/upload/portfolio-analysis');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ANALYSIS_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept-Language': lang },
      body: JSON.stringify({ files, lang }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`portfolio-analysis ${res.status}: ${text}`);
    }
    const data = (await res.json()) as PortfolioAnalysis;
    return { ...data, _source: 'render' };
  } finally {
    clearTimeout(timer);
  }
}

export async function applyPortfolioAnalysis(
  analysisId: string,
  files?: UploadFileMeta[],
): Promise<{ ok: boolean; gas?: boolean; commit?: unknown }> {
  const res = await fetch(apiUrl('/upload/apply-analysis'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ analysis_id: analysisId, ...(files?.length ? { files } : {}) }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`apply-analysis ${res.status}: ${text}`);
  }
  return (await res.json()) as { ok: boolean; gas?: boolean; commit?: unknown };
}

export async function createPortfolioPdf(
  analysisId?: string,
): Promise<{ ok: boolean; url?: string }> {
  const res = await fetch(apiUrl('/upload/create-pdf'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ analysis_id: analysisId }),
  });
  if (!res.ok) throw new Error(`create-pdf ${res.status}`);
  return (await res.json()) as { ok: boolean; url?: string };
}

/** Client fallback when API unreachable — uses existing portfolio endpoints. */
export async function fetchPortfolioAnalysisFallback(
  files: UploadFileMeta[],
  lang: 'en' | 'ar',
): Promise<PortfolioAnalysis> {
  const [props, tenants, contracts, decisions] = await Promise.all([
    api.properties(),
    api.tenants(),
    api.contracts(),
    api.decisions(),
  ]);

  const totalUnits = props.reduce((s, p) => s + (p.units ?? 0), 0);
  const occupied = props.reduce((s, p) => s + Math.round((p.units ?? 0) * (p.occupancy ?? 0)), 0);
  const monthly = props.reduce((s, p) => s + (p.monthly_revenue ?? 0), 0);
  const annual = monthly * 12;
  const expenses = Math.round(annual * 0.32);
  const collected = Math.round(annual * 0.91);
  const expiring = contracts.filter((c) => c.status === 'expiring' || c.status === 'expiring soon').length;
  const late = decisions.filter((d) => d.kind === 'financial').length;
  const maint = decisions.filter((d) => d.kind === 'maintenance').length;
  const occ = totalUnits ? Math.round((occupied / totalUnits) * 1000) / 10 : 0;

  const ar = lang === 'ar';
  return {
    analysis_id: `local-${Date.now()}`,
    success_message: ar ? 'تم تحليل البيانات بنجاح (وضع محلي).' : 'Data analyzed (local mode).',
    prompt_message: ar ? 'هل ترغب في:' : 'Would you like to:',
    what_now_message: ar ? 'ماذا تريد أن أفعل الآن؟' : 'What should I do now?',
    prompt_options: [
      { key: 'update', label: ar ? 'تحديث المحفظة' : 'Update portfolio' },
      { key: 'review', label: ar ? 'مراجعة النتائج أولًا' : 'Review results first' },
      { key: 'cancel', label: ar ? 'إلغاء العملية' : 'Cancel' },
    ],
    metrics: {
      properties: props.length,
      units: totalUnits,
      tenants: tenants.length,
      occupancy_pct: occ,
      occupied_units: occupied,
      vacant_units: Math.max(0, totalUnits - occupied),
      total_revenue_annual: annual,
      collected,
      remaining: annual - collected,
      total_expenses: expenses,
      contracts_expired: 0,
      contracts_expiring_soon: expiring,
      late_tenants: late,
      late_value: late * 22000,
      maintenance_open: maint,
      maintenance_done: Math.max(0, maint - 1),
      net_profit: collected - expenses,
      balance: Math.round((collected - expenses) * 0.4),
      files_analyzed: files.length,
    },
    executive_report: {
      title: ar ? `تقرير أداء العقارات 2026` : 'Property Performance Report 2026',
      year: 2026,
      sections: [
        {
          key: 'summary',
          title: ar ? 'الملخص التنفيذي' : 'Executive summary',
          items: [
            { label: ar ? 'الوحدات' : 'Units', value: String(totalUnits) },
            { label: ar ? 'الإشغال' : 'Occupancy', value: `${occ}%` },
          ],
        },
        {
          key: 'revenue',
          title: ar ? 'الإيرادات' : 'Revenue',
          items: [
            { label: ar ? 'الإجمالي' : 'Total', value: annual.toLocaleString() },
            { label: ar ? 'المحصل' : 'Collected', value: collected.toLocaleString() },
          ],
        },
      ],
    },
    month_comparison: [],
    expense_by_type: [],
    smart_decisions: decisions.slice(0, 4).map((d) => ({
      id: d.id,
      priority: d.priority,
      title: d.title,
      action: d.recommended_action,
    })),
    next_actions: [
      { key: 'update_portfolio', icon: 'database', route: '/portfolio' },
      { key: 'send_alerts', icon: 'bell', route: '/notifications' },
      { key: 'create_pdf', icon: 'file-text', route: '/reports' },
      { key: 'compare_months', icon: 'bar-chart-2', route: '/insights' },
    ],
    _source: 'fallback',
  };
}
