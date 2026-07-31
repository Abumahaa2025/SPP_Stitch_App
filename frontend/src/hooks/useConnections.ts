import { useCallback, useEffect, useState } from 'react';
import { storage } from '@/src/utils/storage';

export type ServiceKey =
  | 'sheets'
  | 'whatsapp'
  | 'greenApi'
  | 'email'
  | 'homeAssistant';

export type ServiceConfig = {
  connected: boolean;
  completedSteps: number;
  /** Last four chars or masked label for display */
  summary: string;
  fields: Record<string, string>;
};

export type ConnectionsState = Record<ServiceKey, ServiceConfig>;

const KEY = 'spp.connections';

const empty = (): ServiceConfig => ({
  connected: false,
  completedSteps: 0,
  summary: '',
  fields: {},
});

const DEFAULT: ConnectionsState = {
  sheets: empty(),
  whatsapp: empty(),
  greenApi: empty(),
  email: empty(),
  homeAssistant: empty(),
};

export function useConnections() {
  const [state, setState] = useState<ConnectionsState>(DEFAULT);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const stored = await storage.getItem<string>(KEY, '');
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as Partial<ConnectionsState>;
          setState({ ...DEFAULT, ...parsed });
        } catch { /* ignore */ }
      }
      setReady(true);
    })();
  }, []);

  const updateService = useCallback((
    key: ServiceKey,
    patch: Partial<ServiceConfig>,
  ) => {
    setState((prev) => {
      const next = {
        ...prev,
        [key]: { ...prev[key], ...patch },
      };
      storage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const completeStep = useCallback((key: ServiceKey, step: number, fields?: Record<string, string>) => {
    setState((prev) => {
      const svc = prev[key];
      const mergedFields = { ...svc.fields, ...fields };
      const completedSteps = Math.max(svc.completedSteps, step);
      const connected = completedSteps >= 3;
      const next = {
        ...prev,
        [key]: {
          ...svc,
          fields: mergedFields,
          completedSteps,
          connected,
          summary: connected ? maskSummary(key, mergedFields) : svc.summary,
        },
      };
      storage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const disconnect = useCallback((key: ServiceKey) => {
    setState((prev) => {
      const next = { ...prev, [key]: empty() };
      storage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { connections: state, ready, updateService, completeStep, disconnect };
}

function maskSummary(key: ServiceKey, fields: Record<string, string>): string {
  if (key === 'sheets') return fields.spreadsheetId?.slice(-6) ?? 'connected';
  if (key === 'whatsapp' || key === 'greenApi') return fields.phone?.slice(-4) ? `··${fields.phone.slice(-4)}` : 'connected';
  if (key === 'email') return fields.fromEmail?.split('@')[0] ?? 'connected';
  if (key === 'homeAssistant') return fields.url?.replace(/^https?:\/\//, '').slice(0, 20) ?? 'connected';
  return 'connected';
}
