import { useCallback, useEffect, useState } from 'react';

import type { TenantOpsState } from '@/src/types/tenant-ops-journey';
import {
  loadTenantOps,
  openJourneys,
  journeysForTenant,
  reportsForTenant,
  subscribeTenantOps,
  markPaymentOwnerReceived,
  advanceMaintenanceJourney,
  completePaymentJourney,
} from '@/src/utils/tenant-ops-journey-store';

const EMPTY: TenantOpsState = { journeys: [], reports: [] };

export function useTenantOps() {
  const [state, setState] = useState<TenantOpsState>(EMPTY);
  const [ready, setReady] = useState(false);

  const reload = useCallback(async () => {
    const next = await loadTenantOps();
    setState(next);
    setReady(true);
    return next;
  }, []);

  useEffect(() => {
    void reload();
    return subscribeTenantOps(() => { void reload(); });
  }, [reload]);

  return {
    ready,
    state,
    reload,
    open: openJourneys(state),
    forTenant: (tenantId: string) => journeysForTenant(state, tenantId),
    reportsFor: (tenantId: string) => reportsForTenant(state, tenantId),
    markPaymentOwnerReceived,
    advanceMaintenanceJourney,
    completePaymentJourney,
  };
}
