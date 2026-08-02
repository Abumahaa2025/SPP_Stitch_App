/**
 * External enrichment hook for Smart Employee.
 * Local agent always produces the work queue. When a provider key/URL is
 * configured later, this layer may refine titles/reasons only — never invent
 * financial facts that contradict Property OS.
 *
 * Without EXPO_PUBLIC_EMPLOYEE_ENRICH_URL (or key), this is a no-op.
 */
import type { EmployeeTask, SmartEmployeeState } from '@/src/types/smart-employee';

export type EnrichContext = {
  propertyName?: string;
  lateTenantCount: number;
  vacantCount: number;
  openMaintCount: number;
};

function enrichConfigured(): boolean {
  const url = String(process.env.EXPO_PUBLIC_EMPLOYEE_ENRICH_URL || '').trim();
  const key = String(process.env.EXPO_PUBLIC_EMPLOYEE_LLM_KEY || '').trim();
  return Boolean(url || key);
}

/** Returns true when hybrid external path can run. */
export function isExternalEmployeeEnrichAvailable(): boolean {
  return enrichConfigured();
}

/**
 * Optionally polish task copy via external service.
 * Safe default: return state unchanged (local-only mode).
 */
export async function enrichSmartEmployeeState(
  state: SmartEmployeeState,
  _ctx: EnrichContext,
): Promise<SmartEmployeeState> {
  if (!enrichConfigured()) {
    return { ...state, mode: 'local' };
  }

  // Placeholder for future HTTP/LLM call. Do not call paid APIs without a key.
  // When implemented: POST tasks summary → merge refined titles only.
  return {
    ...state,
    mode: 'hybrid',
    tasks: state.tasks.map((t): EmployeeTask => ({ ...t, source: t.source || 'local' })),
  };
}
