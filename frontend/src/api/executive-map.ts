import type { Briefing, DecisionT, VerdictT } from './client';
import type { Executive, ExecutiveRankedItem } from './executive';

const KIND_MAP: Record<string, DecisionT['kind']> = {
  maintenance: 'maintenance',
  financial: 'financial',
  tenant: 'tenant',
  opportunity: 'opportunity',
  renewal: 'tenant',
  vacancy: 'opportunity',
  health: 'maintenance',
  rent_uplift: 'opportunity',
  maintenance_batch: 'maintenance',
  collection: 'financial',
};

const PRIORITY_SET = new Set<DecisionT['priority']>(['critical', 'high', 'medium', 'low']);

const SCREEN_ROUTES: Record<string, string> = {
  portfolio: '/portfolio',
  insights: '/insights',
  contracts: '/contracts',
  health: '/health',
  maintenance: '/maintenance',
  tenants: '/tenants',
  sensors: '/sensors',
  reports: '/reports',
  owner: '/owner',
  knowledge: '/knowledge',
  guides: '/guides',
  notifications: '/notifications',
};

function normalizeKind(kind: string): DecisionT['kind'] {
  return KIND_MAP[kind] ?? 'opportunity';
}

function normalizePriority(p: string): DecisionT['priority'] {
  return PRIORITY_SET.has(p as DecisionT['priority'])
    ? (p as DecisionT['priority'])
    : 'medium';
}

function fmtImpact(aed: number): string {
  if (aed >= 1_000_000) return `≈ ${(aed / 1_000_000).toFixed(1)}M AED`;
  if (aed >= 1_000) return `≈ ${Math.round(aed / 1_000)}K AED`;
  return `≈ ${aed} AED`;
}

export function rankedToDecision(item: ExecutiveRankedItem, index = 0): DecisionT {
  return {
    id: item.id || `exec_${index}`,
    priority: normalizePriority(item.priority),
    kind: normalizeKind(item.kind),
    title: item.title,
    reason: item.why,
    impact: fmtImpact(item.impact_aed ?? 0),
    recommended_action: item.action,
    confidence: Math.min(99, Math.max(50, Math.round(item.score ?? 70))),
    property_id: item.property_id,
    created_at: new Date().toISOString(),
  };
}

export function itemToVerdict(item: ExecutiveRankedItem, route?: string): VerdictT {
  return {
    headline: item.title,
    why: item.why,
    action: item.action,
    route: route || item.route || '/',
  };
}

function executivePool(exec: Executive): ExecutiveRankedItem[] {
  return [
    ...(exec.agenda?.now ?? []),
    ...(exec.agenda?.today ?? []),
    ...(exec.agenda?.this_week ?? []),
    ...(exec.agenda?.follow_up ?? []),
    ...(exec.ranked_decisions ?? []),
    ...((exec.opportunities ?? []) as ExecutiveRankedItem[]),
  ];
}

function pickVerdict(
  pool: ExecutiveRankedItem[],
  pred: (item: ExecutiveRankedItem) => boolean,
  route?: string,
): VerdictT | null {
  const hit = pool.find(pred);
  return hit ? itemToVerdict(hit, route) : null;
}

function briefVerdict(exec: Executive, route = '/'): VerdictT {
  const db = exec.daily_brief;
  const top = exec.agenda?.now?.[0] ?? exec.ranked_decisions?.[0];
  return {
    headline: top?.title || db.what,
    why: db.why,
    action: top?.action || db.what,
    route: top?.route || route,
  };
}

export function pickVerdictForProperty(exec: Executive, propertyId: string): VerdictT | null {
  const pool = executivePool(exec);
  return (
    pickVerdict(pool, (i) => i.property_id === propertyId)
    ?? briefVerdict(exec, `/property/${propertyId}`)
  );
}

/** Resolve one screen verdict purely from /api/executive payload. */
export function resolveExecutiveVerdict(exec: Executive, screen: string): VerdictT | null {
  if (screen.startsWith('property-')) {
    return pickVerdictForProperty(exec, screen.slice('property-'.length));
  }

  const pool = executivePool(exec);
  const ranked = exec.ranked_decisions ?? [];
  const opps = (exec.opportunities ?? []) as ExecutiveRankedItem[];
  const route = SCREEN_ROUTES[screen] ?? '/';

  const byScreen: Record<string, VerdictT | null> = {
    portfolio:
      pickVerdict(pool, (i) => i.kind === 'vacancy' || i.route === '/portfolio', route)
      ?? pickVerdict(ranked, () => true, route),
    insights:
      pickVerdict(opps, () => true, '/insights')
      ?? pickVerdict(pool, (i) => i.kind === 'rent_uplift' || i.kind === 'collection', '/insights')
      ?? pickVerdict(ranked, (i) => i.kind === 'financial', '/insights'),
    contracts:
      pickVerdict(pool, (i) => i.kind === 'renewal' || i.route === '/contracts', '/contracts')
      ?? pickVerdict(ranked, (i) => i.kind === 'tenant' || i.kind === 'renewal', '/contracts'),
    health:
      pickVerdict(pool, (i) => i.kind === 'health' || i.route === '/health', '/health')
      ?? pickVerdict(ranked, (i) => i.kind === 'maintenance', '/health'),
    maintenance:
      pickVerdict(pool, (i) => i.kind === 'maintenance' || i.kind === 'maintenance_batch', '/maintenance')
      ?? pickVerdict(ranked, (i) => i.kind === 'maintenance', '/maintenance'),
    tenants:
      pickVerdict(pool, (i) => i.kind === 'tenant' || i.kind === 'renewal', '/tenants')
      ?? pickVerdict(ranked, (i) => i.kind === 'financial', '/tenants'),
    sensors:
      pickVerdict(pool, (i) => i.route === '/sensors', '/sensors')
      ?? pickVerdict(ranked, (i) => i.kind === 'maintenance', '/sensors'),
    reports:
      pickVerdict(opps, (i) => i.kind === 'rent_uplift', '/reports')
      ?? pickVerdict(pool, (i) => i.route === '/reports', '/reports')
      ?? briefVerdict(exec, '/reports'),
    owner: briefVerdict(exec, '/owner'),
    knowledge:
      pickVerdict(exec.agenda?.follow_up ?? [], () => true, '/knowledge')
      ?? briefVerdict(exec, '/knowledge'),
    guides:
      pickVerdict(exec.agenda?.this_week ?? [], () => true, '/guides')
      ?? briefVerdict(exec, '/guides'),
    notifications:
      pickVerdict(exec.agenda?.now ?? [], () => true, '/notifications')
      ?? briefVerdict(exec, '/notifications'),
  };

  return byScreen[screen] ?? briefVerdict(exec, route);
}

/** Map executive payload to per-screen BrainVerdict cache keys. */
export function buildVerdictCache(exec: Executive): Record<string, VerdictT | null> {
  const screens = [
    'portfolio', 'insights', 'contracts', 'health', 'maintenance',
    'tenants', 'sensors', 'reports', 'owner', 'knowledge', 'guides', 'notifications',
  ];
  const bag: Record<string, VerdictT | null> = {};
  for (const key of screens) {
    bag[key] = resolveExecutiveVerdict(exec, key);
  }
  return bag;
}

/** Overlay executive daily brief + ranked queue onto briefing KPIs. */
export function mergeBriefingWithExecutive(
  brief: Briefing,
  exec: Executive,
  sensorAlerts: Briefing['sensor_alerts'] = [],
): Briefing {
  const db = exec.daily_brief;
  const pf = exec.portfolio;
  const narrative = [db.what, db.why, db.outcome].filter(Boolean);
  const decisions = (exec.ranked_decisions ?? []).slice(0, 6).map(rankedToDecision);

  return {
    ...brief,
    salutation: db.salutation || brief.salutation,
    owner_name: db.owner_name || brief.owner_name,
    headline: db.what || brief.headline,
    narrative: narrative.length ? narrative : brief.narrative,
    decisions: decisions.length ? decisions : brief.decisions,
    portfolio_annual_revenue: pf?.annual_revenue_aed ?? brief.portfolio_annual_revenue,
    avg_health: pf?.avg_health ?? brief.avg_health,
    occupancy: pf?.occupancy_pct ?? brief.occupancy,
    properties_count: pf?.units ?? brief.properties_count,
    tenants_count: pf?.tenants ?? brief.tenants_count,
    expiring_contracts: pf?.expiring_contracts ?? brief.expiring_contracts,
    sensor_alerts: sensorAlerts.length ? sensorAlerts : brief.sensor_alerts,
  };
}

/** Build KPI snapshot from /api/executive portfolio block. */
export function kpisFromExecutive(exec: Executive): Pick<
  Briefing,
  'portfolio_annual_revenue' | 'avg_health' | 'occupancy' | 'properties_count' | 'tenants_count' | 'expiring_contracts'
> {
  const pf = exec.portfolio;
  return {
    portfolio_annual_revenue: pf.annual_revenue_aed ?? 0,
    avg_health: pf.avg_health ?? 0,
    occupancy: pf.occupancy_pct ?? 0,
    properties_count: pf.units ?? 0,
    tenants_count: pf.tenants ?? 0,
    expiring_contracts: pf.expiring_contracts ?? 0,
  };
}
