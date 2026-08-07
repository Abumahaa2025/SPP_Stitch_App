import { useCallback, useEffect, useState } from 'react';
import { storage } from '@/src/utils/storage';

export type ServiceKey =
  | 'sheets'
  | 'whatsapp'
  | 'greenApi'
  | 'email'
  | 'homeAssistant'
  | 'ejar'
  | 'electricity'
  | 'water'
  | 'messagingAutomation'
  | 'intelligenceHub';

export type ServiceConfig = {
  connected: boolean;
  completedSteps: number;
  /** Last four chars or masked label for display */
  summary: string;
  fields: Record<string, string>;
};

export type ConnectionsState = Record<ServiceKey, ServiceConfig>;

const KEY = 'spp.connections';

/** Provider secrets must never live in device storage (Blueprint §8.4 / GAP-C05). */
const SECRET_FIELD_KEYS = new Set([
  'apiToken',
  'token',
  'smtpPass',
  'webhookSecret',
  'apiKey',
  'password',
  'secret',
]);

export function stripSecretFields(fields: Record<string, string> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!fields) return out;
  for (const [k, v] of Object.entries(fields)) {
    if (SECRET_FIELD_KEYS.has(k)) continue;
    out[k] = v;
  }
  return out;
}

function sanitizeService(svc: ServiceConfig | undefined): ServiceConfig {
  const base = svc || empty();
  return {
    ...base,
    fields: stripSecretFields(base.fields),
  };
}

function sanitizeState(raw: Partial<ConnectionsState>): ConnectionsState {
  const next = { ...DEFAULT };
  (Object.keys(DEFAULT) as ServiceKey[]).forEach((key) => {
    next[key] = sanitizeService(raw[key] as ServiceConfig | undefined);
  });
  return next;
}

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
  ejar: empty(),
  electricity: empty(),
  water: empty(),
  messagingAutomation: empty(),
  intelligenceHub: empty(),
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
          const cleaned = sanitizeState(parsed);
          setState(cleaned);
          // Migrate: rewrite storage without any previously saved secrets.
          await storage.setItem(KEY, JSON.stringify(cleaned));
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
      const mergedFields = stripSecretFields({
        ...prev[key].fields,
        ...(patch.fields || {}),
      });
      const next = {
        ...prev,
        [key]: sanitizeService({ ...prev[key], ...patch, fields: mergedFields }),
      };
      storage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const completeStep = useCallback((key: ServiceKey, step: number, fields?: Record<string, string>) => {
    setState((prev) => {
      const svc = prev[key];
      const mergedFields = stripSecretFields({ ...svc.fields, ...fields });
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
  if (key === 'ejar') return fields.organizationId?.slice(-6) || 'ejar';
  if (key === 'electricity' || key === 'water') return fields.accountNumber?.slice(-4) || key;
  if (key === 'messagingAutomation') return fields.provider?.slice(0, 12) || 'messaging';
  if (key === 'intelligenceHub') return fields.workspace?.slice(0, 12) || 'intel';
  return 'connected';
}
