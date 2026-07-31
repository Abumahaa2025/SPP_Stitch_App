export type PortfolioMemoryAsset = {
  asset_id: string;
  name: string;
  type: string;
  unit_id?: string | null;
  risk: 'low' | 'medium' | 'high' | 'critical';
  fault_count: number;
  total_cost: number;
  life_pct: number;
  warranty_days?: number | null;
  age_years: number;
};

export type PortfolioMemory = {
  summary: {
    total_assets: number;
    critical: number;
    high_risk: number;
    repeat_faults: number;
    warranty_expiring: number;
    total_maint_cost: number;
  };
  assets: PortfolioMemoryAsset[];
};

export type IntelligenceInsight = {
  id: string;
  scenario: string;
  headline: string;
  why: string;
  action: string;
  impact: string;
  likely_outcome: string;
  confidence: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  route?: string;
  unit_id?: string | null;
  property_id?: string | null;
};

export type IntelligenceResponse = {
  insights: IntelligenceInsight[];
  count: number;
};
