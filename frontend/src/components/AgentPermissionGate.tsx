import React, { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';

import { AliveEmpty } from '@/src/components/AliveEmpty';
import { storage } from '@/src/utils/storage';
import { loadPortalAccess } from '@/src/utils/portal-access-store';
import type { AgentPermissions } from '@/src/types/portal-access';
import { useI18n } from '@/src/i18n';

type Props = {
  perm: keyof AgentPermissions;
  children: React.ReactNode;
};

const ACTIVE_KEY = 'spp.activeAgentId';

/** Spec §5.10 / §13 — agent may only open screens in their permission scope. */
export function AgentPermissionGate({ perm, children }: Props) {
  const { t } = useI18n();
  const router = useRouter();
  const [state, setState] = useState<'loading' | 'ok' | 'denied'>('loading');

  useEffect(() => {
    let alive = true;
    (async () => {
      const id = await storage.getItem<string>(ACTIVE_KEY, '');
      if (!id) {
        if (alive) setState('ok');
        return;
      }
      const access = await loadPortalAccess();
      const agent = access.agents.find((a) => a.id === id && a.linkActive);
      if (!agent || !agent.permissions[perm]) {
        if (alive) setState('denied');
        return;
      }
      if (alive) setState('ok');
    })();
    return () => { alive = false; };
  }, [perm]);

  if (state === 'loading') return null;
  if (state === 'denied') {
    return (
      <AliveEmpty
        title={t('opsv2.agent.title' as any)}
        body={t('opsv2.agent.denied' as any)}
        actionLabel={t('common.cancel')}
        onAction={() => router.back()}
        testID="agent-perm-denied"
      />
    );
  }
  return <>{children}</>;
}

export async function setActiveAgentSession(agentId: string | null): Promise<void> {
  if (!agentId) await storage.removeItem(ACTIVE_KEY);
  else await storage.setItem(ACTIVE_KEY, agentId);
}
