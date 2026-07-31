/**
 * SPP local preferences — persisted via AsyncStorage.
 * Phase 4 will migrate these to backend endpoints without changing the UI shape.
 */
import { useEffect, useState, useCallback } from 'react';
import { storage } from '@/src/utils/storage';

// ─── Notification preferences ─────────────────────────────────────────────

export type NotificationPrefs = {
  priorities: boolean;
  weeklyBrief: boolean;
  sensorAlerts: boolean;
  contractRenewals: boolean;
  maintenance: boolean;
  quietHours: boolean;
};

const NOTIF_DEFAULTS: NotificationPrefs = {
  priorities: true,
  weeklyBrief: true,
  sensorAlerts: false,
  contractRenewals: true,
  maintenance: true,
  quietHours: false,
};

const NOTIF_KEY = 'spp.notif.prefs';

export function useNotificationPrefs() {
  const [prefs, setPrefs] = useState<NotificationPrefs>(NOTIF_DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const stored = await storage.getItem<string>(NOTIF_KEY, '');
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as Partial<NotificationPrefs>;
          setPrefs({ ...NOTIF_DEFAULTS, ...parsed });
        } catch { /* ignore */ }
      }
      setReady(true);
    })();
  }, []);

  const update = useCallback(<K extends keyof NotificationPrefs>(key: K, val: NotificationPrefs[K]) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: val };
      storage.setItem(NOTIF_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const countEnabled = Object.values(prefs).filter(Boolean).length;
  return { prefs, update, ready, countEnabled };
}

// ─── Account preferences ─────────────────────────────────────────────────

export type ThemeChoice = 'system' | 'dark' | 'light';

export type AccountPrefs = {
  currency: string;         // AED, USD, EUR, GBP, SAR
  timezone: string;         // IANA
  defaultProperty: string;  // property id or 'none'
  theme: ThemeChoice;
  reduceMotion: boolean;
};

const ACCOUNT_DEFAULTS: AccountPrefs = {
  currency: 'AED',
  timezone: 'Asia/Dubai',
  defaultProperty: 'none',
  theme: 'dark',
  reduceMotion: false,
};

const ACCOUNT_KEY = 'spp.account.prefs';

export function useAccountPrefs() {
  const [prefs, setPrefs] = useState<AccountPrefs>(ACCOUNT_DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const stored = await storage.getItem<string>(ACCOUNT_KEY, '');
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as Partial<AccountPrefs>;
          setPrefs({ ...ACCOUNT_DEFAULTS, ...parsed });
        } catch { /* ignore */ }
      }
      setReady(true);
    })();
  }, []);

  const update = useCallback(<K extends keyof AccountPrefs>(key: K, val: AccountPrefs[K]) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: val };
      storage.setItem(ACCOUNT_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { prefs, update, ready };
}
