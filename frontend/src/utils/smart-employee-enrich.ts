/**
 * External enrichment hook for Smart Employee.
 * Local agent always produces the work queue first (offline-safe). When
 * the SPP backend has an applied analysis (Koil has real portfolio
 * reasoning to work with), this layer asks Koil which item it would work
 * on right now and uses its professionally-drafted message to replace the
 * matching local task's canned template — it never invents financial
 * facts, it only asks the backend, which itself only phrases confirmed
 * data (see backend/adapters/koil/action_registry.py).
 *
 * Fails silently and safely: any network/parse error just returns the
 * local state unchanged, mode stays 'local'.
 */
import type { EmployeeTask, SmartEmployeeState } from '@/src/types/smart-employee';
import { api } from '@/src/api/client';

export type EnrichContext = {
  propertyName?: string;
  lateTenantCount: number;
  vacantCount: number;
  openMaintCount: number;
};

function enrichDisabled(): boolean {
  // Escape hatch only — enrichment talks to the same SPP backend the rest
  // of the app already trusts, so it is on by default (no separate key
  // needed). Set EXPO_PUBLIC_EMPLOYEE_ENRICH_DISABLE=1 to force local-only.
  return String(process.env.EXPO_PUBLIC_EMPLOYEE_ENRICH_DISABLE || '').trim() === '1';
}

/** Returns true when the hybrid (backend-assisted) path can run. */
export function isExternalEmployeeEnrichAvailable(): boolean {
  return !enrichDisabled();
}

/** Loose match between a local heuristic task and a backend unified decision. */
function matchesTask(task: EmployeeTask, unit: string, tenant: string): boolean {
  const u = String(task.unitNumber || '').trim().toLowerCase();
  if (u && unit && u === unit.trim().toLowerCase()) return true;
  const t = String(task.titleAr || '').toLowerCase();
  if (tenant && tenant.trim() && t.includes(tenant.trim().toLowerCase())) return true;
  return false;
}

/**
 * Optionally polish the top task via Koil's backend reasoning.
 * Safe default: return state unchanged (local-only mode) on any failure.
 */
export async function enrichSmartEmployeeState(
  state: SmartEmployeeState,
  _ctx: EnrichContext,
): Promise<SmartEmployeeState> {
  if (enrichDisabled()) {
    return { ...state, mode: 'local' };
  }

  const active = state.tasks.filter(
    (t) => t.status === 'suggested' || t.status === 'in_progress' || t.status === 'waiting_followup',
  );
  if (active.length === 0) {
    return { ...state, mode: 'local' };
  }

  try {
    // Dry run: ask Koil what it would do next, without logging an execution.
    // Requires a previously-applied analysis on the backend — a fresh
    // install with no import yet will 404, which we treat as "not ready".
    const resp = await api.koilAct({ dryRun: true });
    if (!('execution' in resp) || !resp.execution) {
      return { ...state, mode: 'local' };
    }

    const { execution } = resp;
    const matchIndex = state.tasks.findIndex((t) => matchesTask(t, execution.unit, execution.tenant));

    const activity = [
      {
        id: `act_koil_${Date.now().toString(36)}`,
        at: new Date().toISOString(),
        textAr: execution.agent_reason
          ? `كويل (${execution.agent_source === 'llm' ? 'تحليل ذكي' : 'تحليل محلي'}): ${execution.agent_reason}`
          : `كويل يقترح التركيز على: ${execution.summary}`,
        textEn: execution.agent_reason
          ? `Koil (${execution.agent_source === 'llm' ? 'AI reasoning' : 'local reasoning'}): ${execution.agent_reason}`
          : `Koil suggests focusing on: ${execution.summary}`,
      },
      ...state.activity,
    ].slice(0, 20);

    if (matchIndex === -1 || execution.channel !== 'whatsapp' || !execution.message) {
      return { ...state, mode: 'hybrid', activity };
    }

    const tasks = state.tasks.map((t, i): EmployeeTask => {
      if (i !== matchIndex) return { ...t, source: t.source || 'local' };
      return {
        ...t,
        // Replace the canned template with Koil's professionally-drafted
        // message — same confirmed amount/tenant/unit, better phrasing.
        whatsappMessage: execution.message,
        reasonAr: execution.summary || t.reasonAr,
        source: 'enriched',
      };
    });

    return { ...state, mode: 'hybrid', tasks, activity };
  } catch {
    // Backend unreachable, no analysis applied yet, or a transient error —
    // the local agent already produced a complete, usable queue.
    return { ...state, mode: 'local' };
  }
}
