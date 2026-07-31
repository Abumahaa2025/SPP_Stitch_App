import type { IntelligenceResponse, PortfolioMemory } from './intelligence';
import { getLang } from '../i18n';
import { apiUrl } from '../constants/backend';

export const API_BASE = apiUrl('');

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept-Language': getLang(),
  };
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...headers, ...(init?.headers as Record<string, string> | undefined) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status} ${path}: ${text}`);
  }
  return (await res.json()) as T;
}

export const api = {
  briefing: () => req<Briefing>('/briefing'),
  executive: () => req<import('./executive').Executive>('/executive'),
  properties: () => req<PropertyT[]>('/properties'),
  property: (id: string) => req<PropertyT>(`/properties/${id}`),
  decisions: () => req<DecisionT[]>('/decisions'),
  tenants: () => req<TenantT[]>('/tenants'),
  contracts: () => req<ContractT[]>('/contracts'),
  timeline: () => req<TimelineT[]>('/timeline'),
  sensors: () => req<SensorT[]>('/sensors'),
  notifications: () => req<NotifT[]>('/notifications'),
  reports: () => req<ReportT[]>('/reports'),
  knowledge: () => req<KnowledgeT[]>('/knowledge'),
  guides: () => req<GuideT[]>('/guides'),
  owner: () => req<OwnerT>('/owner'),
  verdicts: () => req<Record<string, VerdictT | null>>('/verdicts'),
  portfolioMemory: () => req<PortfolioMemory>('/portfolio-memory'),
  intelligence: () => req<IntelligenceResponse>('/intelligence'),
  chatSend: (session_id: string, text: string) =>
    req<{ reply: string; at: string }>('/chat', {
      method: 'POST',
      body: JSON.stringify({ session_id, text }),
    }),
  chatHistory: (sid: string) => req<ChatMsg[]>(`/chat/${sid}`),
  loadDemo: () => req<{ ok: boolean; mode: string }>('/demo/load', { method: 'POST' }),
  clearDemo: () => req<{ ok: boolean; mode: string }>('/demo/clear', { method: 'POST' }),
  betaLogin: (email: string, password: string) =>
    req<{ ok: boolean; persona: string; email: string }>('/beta/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  betaInfo: () => req<{ beta: boolean; gas_disabled: boolean }>('/beta/info'),
};

// Types
export type DecisionT = {
  id: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  kind: 'maintenance' | 'financial' | 'tenant' | 'opportunity';
  title: string;
  reason: string;
  impact: string;
  recommended_action: string;
  confidence: number;
  property_id?: string;
  created_at: string;
};

export type Briefing = {
  salutation: string;
  owner_name: string;
  headline: string;
  narrative: string[];
  portfolio_annual_revenue: number;
  avg_health: number;
  occupancy: number;
  properties_count: number;
  tenants_count: number;
  expiring_contracts: number;
  decisions: DecisionT[];
  sensor_alerts: SensorT[];
};

export type PropertyT = {
  id: string; name: string; address: string; city: string;
  kind: string; units: number; occupancy: number;
  monthly_revenue: number; health_score: number; hero_image: string;
  tenant_ids: string[]; owner_id: string;
};

export type TenantT = {
  id: string; name: string; property_id: string; unit: string;
  since: string; rent: number; reliability: number;
};

export type ContractT = {
  id: string; tenant_id: string; property_id: string;
  start: string; end: string; monthly_rent: number; status: string;
};

export type TimelineT = {
  id: string; property_id: string; kind: string;
  title: string; subtitle: string; at: string;
};

export type SensorT = {
  id: string; property_id: string; kind: string; label: string;
  value: number; unit: string; status: 'nominal' | 'attention' | 'critical';
  trend: 'up' | 'down' | 'flat';
};

export type NotifT = {
  id: string; title: string; body: string; priority: string;
  at: string; read: boolean;
};

export type ChatMsg = {
  id: string; role: 'user' | 'assistant'; text: string; at: string;
};

export type ReportT = {
  id: string; kind: string; title: string; subtitle: string;
  highlight: string; created_at: string; pages: number; accent: 'gold' | 'emerald';
};

export type KnowledgeT = {
  id: string; topic: string; title: string; body: string; reading_minutes: number;
};

export type GuideT = {
  id: string; title: string; duration: string; kind: string;
  level: string; chapters: number; poster: string;
};

export type OwnerT = {
  id: string; name: string; portfolio_value: number; properties: number;
};

export type VerdictT = {
  headline: string;
  why: string;
  action: string;
  route: string;
};

export type { Executive, ExecutiveDailyBrief, ExecutiveRankedItem, ExecutiveAgenda } from './executive';
