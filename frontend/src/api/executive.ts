export type ExecutiveDailyBrief = {
  salutation: string;
  owner_name: string;
  what: string;
  why: string;
  outcome: string;
  focus_count: number;
  recoverable_aed: number;
};

export type ExecutiveRankedItem = {
  id: string;
  source?: string;
  kind: string;
  priority: string;
  score: number;
  tier?: string;
  emoji?: string;
  title: string;
  why: string;
  action: string;
  impact_aed: number;
  property_id?: string;
  route: string;
};

export type ExecutiveAgenda = {
  now: ExecutiveRankedItem[];
  today: ExecutiveRankedItem[];
  this_week: ExecutiveRankedItem[];
  follow_up: ExecutiveRankedItem[];
  labels?: Record<string, string>;
};

export type Executive = {
  version: string;
  portfolio: {
    units: number;
    tenants: number;
    contracts_tracked: number;
    open_decisions: number;
    avg_health: number;
    occupancy_pct: number;
    annual_revenue_aed: number;
    expiring_contracts: number;
  };
  daily_brief: ExecutiveDailyBrief;
  agenda: ExecutiveAgenda;
  ranked_decisions: ExecutiveRankedItem[];
  opportunities: ExecutiveRankedItem[];
  meta?: unknown;
};
