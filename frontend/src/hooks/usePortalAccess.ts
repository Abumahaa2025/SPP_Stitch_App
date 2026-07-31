import { useCallback, useEffect, useState } from 'react';
import {
  loadPortalAccess,
  subscribePortalAccess,
  addAgent as storeAddAgent,
  recordPortalLogin,
  toggleAgentLink,
} from '@/src/utils/portal-access-store';
import type { AgentPermissions, PortalAccessState, PropertyAgentRecord } from '@/src/types/portal-access';

export function usePortalAccess() {
  const [state, setState] = useState<PortalAccessState>({ agents: [], accessLog: [] });
  const [ready, setReady] = useState(false);

  const reload = useCallback(async () => {
    const s = await loadPortalAccess();
    setState(s);
    setReady(true);
  }, []);

  useEffect(() => {
    reload();
    const unsub = subscribePortalAccess(() => { reload(); });
    return () => { unsub(); };
  }, [reload]);

  const addAgent = useCallback(async (
    input: { name: string; phone: string; email: string; permissions: AgentPermissions },
  ): Promise<PropertyAgentRecord> => {
    const agent = await storeAddAgent(input);
    await reload();
    return agent;
  }, [reload]);

  const logLogin = useCallback(async (
    userId: string,
    userType: 'tenant' | 'technician' | 'agent',
    name: string,
  ) => {
    await recordPortalLogin(userId, userType, name);
    await reload();
  }, [reload]);

  const setAgentActive = useCallback(async (agentId: string, active: boolean) => {
    await toggleAgentLink(agentId, active);
    await reload();
  }, [reload]);

  const getLastLogin = useCallback((userId: string, userType: 'tenant' | 'technician' | 'agent') => {
    return state.accessLog.find((e) => e.userId === userId && e.userType === userType)?.lastLoginAt;
  }, [state.accessLog]);

  return {
    ready,
    agents: state.agents,
    accessLog: state.accessLog,
    addAgent,
    logLogin,
    setAgentActive,
    getLastLogin,
    reload,
  };
}
