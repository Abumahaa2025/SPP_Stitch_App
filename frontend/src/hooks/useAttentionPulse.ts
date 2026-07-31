import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'expo-router';

import { api, type NotifT } from '@/src/api/client';
import { useOperational } from '@/src/hooks/useOperational';
import {
  getAttentionAck,
  loadAttentionAck,
  setAttentionAck,
  subscribeAttention,
} from '@/src/utils/attention-pulse-store';

function attentionFingerprint(notifications: NotifT[], pendingIds: string[]) {
  const notifIds = notifications
    .filter((n) => !n.read || n.priority === 'high' || n.priority === 'critical')
    .map((n) => n.id);
  return [...notifIds, ...pendingIds].sort().join('|');
}

/** Alert boost for the always-on SPP pulse — stronger when attention is needed and not yet acknowledged. */
export function useAttentionPulse() {
  const pathname = usePathname() || '/';
  const { pendingActions } = useOperational();
  const [notifications, setNotifications] = useState<NotifT[]>([]);
  const [, bump] = useState(0);

  useEffect(() => subscribeAttention(() => bump((n) => n + 1)), []);
  useEffect(() => { void loadAttentionAck(); }, []);

  const pendingIds = useMemo(
    () => pendingActions.map((a) => a.id),
    [pendingActions],
  );

  const fingerprint = useMemo(
    () => attentionFingerprint(notifications, pendingIds),
    [notifications, pendingIds],
  );

  const ackFingerprint = getAttentionAck();
  const hasAttention = fingerprint.length > 0;
  const alert = hasAttention && fingerprint !== ackFingerprint;

  const acknowledge = useCallback(async (fp?: string) => {
    await setAttentionAck(fp ?? fingerprint);
  }, [fingerprint]);

  const reload = useCallback(() => {
    api.notifications().then(setNotifications).catch(() => {});
  }, []);

  useEffect(() => {
    reload();
    const id = setInterval(reload, 50_000);
    return () => clearInterval(id);
  }, [reload]);

  useEffect(() => {
    if (pathname === '/notifications' && hasAttention) {
      void acknowledge();
    }
  }, [pathname, hasAttention, acknowledge]);

  const count = useMemo(() => {
    const urgent = notifications.filter(
      (n) => !n.read || n.priority === 'high' || n.priority === 'critical',
    ).length;
    return urgent + pendingIds.length;
  }, [notifications, pendingIds]);

  return { alert, count, hasAttention, acknowledge, reload };
}
