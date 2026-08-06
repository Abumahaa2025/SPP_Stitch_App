import { useCallback, useEffect, useState } from 'react';
import {
  loadPortalAccess,
  subscribePortalAccess,
  addAgent as storeAddAgent,
  addGuard as storeAddGuard,
  createFollowUp as storeCreateFollowUp,
  replyFollowUp as storeReplyFollowUp,
  acceptGuardFollowUp as storeAcceptGuardFollowUp,
  setFollowUpStatus as storeSetFollowUpStatus,
  recordPortalLogin,
  toggleAgentLink,
  updateAgentPermissions as storeUpdateAgentPermissions,
} from '@/src/utils/portal-access-store';
import type {
  AgentFollowUp,
  AgentPermissions,
  FollowUpActor,
  FollowUpDomain,
  FollowUpMediaItem,
  FollowUpStatus,
  PortalAccessState,
  PropertyAgentRecord,
  PropertyGuardRecord,
} from '@/src/types/portal-access';

const EMPTY: PortalAccessState = {
  agents: [],
  guards: [],
  followUps: [],
  accessLog: [],
};

export function usePortalAccess() {
  const [state, setState] = useState<PortalAccessState>(EMPTY);
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

  const addGuard = useCallback(async (
    input: { name: string; phone: string; notes?: string; pairedAgentId?: string },
  ): Promise<PropertyGuardRecord> => {
    const guard = await storeAddGuard(input);
    await reload();
    return guard;
  }, [reload]);

  const createFollowUp = useCallback(async (input: {
    title: string;
    body: string;
    domain: FollowUpDomain;
    createdBy: FollowUpActor;
    createdByName: string;
    agentId?: string;
    guardId?: string;
    status?: FollowUpStatus;
  }): Promise<AgentFollowUp> => {
    const item = await storeCreateFollowUp(input);
    await reload();
    return item;
  }, [reload]);

  const replyFollowUp = useCallback(async (
    followUpId: string,
    actor: FollowUpActor,
    authorName: string,
    message: string,
    nextStatus?: FollowUpStatus,
    media?: FollowUpMediaItem[],
  ) => {
    await storeReplyFollowUp(followUpId, actor, authorName, message, nextStatus, media);
    await reload();
  }, [reload]);

  const acceptGuardFollowUp = useCallback(async (followUpId: string) => {
    await storeAcceptGuardFollowUp(followUpId);
    await reload();
  }, [reload]);

  const setFollowUpStatus = useCallback(async (followUpId: string, status: FollowUpStatus) => {
    await storeSetFollowUpStatus(followUpId, status);
    await reload();
  }, [reload]);

  const updateAgentPermissions = useCallback(async (
    agentId: string,
    permissions: AgentPermissions,
  ) => {
    await storeUpdateAgentPermissions(agentId, permissions);
    await reload();
  }, [reload]);

  const logLogin = useCallback(async (
    userId: string,
    userType: 'tenant' | 'technician' | 'agent' | 'guard',
    name: string,
  ) => {
    await recordPortalLogin(userId, userType, name);
    await reload();
  }, [reload]);

  const setAgentActive = useCallback(async (agentId: string, active: boolean) => {
    await toggleAgentLink(agentId, active);
    await reload();
  }, [reload]);

  const getLastLogin = useCallback((
    userId: string,
    userType: 'tenant' | 'technician' | 'agent' | 'guard',
  ) => {
    return state.accessLog.find((e) => e.userId === userId && e.userType === userType)?.lastLoginAt;
  }, [state.accessLog]);

  return {
    ready,
    agents: state.agents,
    guards: state.guards,
    followUps: state.followUps,
    accessLog: state.accessLog,
    addAgent,
    addGuard,
    createFollowUp,
    replyFollowUp,
    acceptGuardFollowUp,
    setFollowUpStatus,
    updateAgentPermissions,
    logLogin,
    setAgentActive,
    getLastLogin,
    reload,
  };
}
