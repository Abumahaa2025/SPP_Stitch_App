import { useCallback, useEffect, useState } from 'react';
import { storage } from '@/src/utils/storage';

export type PlanKey = 'starter' | 'executive' | 'estate';
export type BillingStatus = 'trial' | 'active' | 'past_due' | 'cancelled';
export type PaymentStatus = 'paid' | 'pending' | 'failed';

export type Invoice = {
  id: string;
  date: string;
  amount: number;
  status: PaymentStatus;
  plan: PlanKey;
};

export type BillingState = {
  plan: PlanKey;
  status: BillingStatus;
  trialEndsAt: string | null;
  renewsAt: string;
  paymentMethod: string;
  licensesUsed: number;
  licensesTotal: number;
  invoices: Invoice[];
};

export const PLAN_PRICES: Record<PlanKey, number> = {
  starter: 49,
  executive: 199,
  estate: 499,
};

export const PLAN_LIMITS: Record<PlanKey, number> = {
  starter: 2,
  executive: 20,
  estate: 999,
};

const KEY = 'spp.billing';

const DEFAULT: BillingState = {
  plan: 'executive',
  status: 'active',
  trialEndsAt: null,
  renewsAt: '2026-03-01',
  paymentMethod: 'Visa ·· 4242',
  licensesUsed: 1,
  licensesTotal: 5,
  invoices: [
    { id: 'in_1', date: '2026-02-01', amount: 199, status: 'paid', plan: 'executive' },
    { id: 'in_2', date: '2026-01-01', amount: 199, status: 'paid', plan: 'executive' },
    { id: 'in_3', date: '2025-12-01', amount: 199, status: 'paid', plan: 'executive' },
  ],
};

export function useBilling() {
  const [state, setState] = useState<BillingState>(DEFAULT);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const stored = await storage.getItem<string>(KEY, '');
      if (stored) {
        try {
          setState({ ...DEFAULT, ...JSON.parse(stored) as Partial<BillingState> });
        } catch { /* ignore */ }
      }
      setReady(true);
    })();
  }, []);

  const persist = useCallback((next: BillingState) => {
    setState(next);
    storage.setItem(KEY, JSON.stringify(next));
  }, []);

  const changePlan = useCallback((plan: PlanKey) => {
    setState((prev) => {
      const price = PLAN_PRICES[plan];
      const next: BillingState = {
        ...prev,
        plan,
        status: prev.status === 'trial' ? 'trial' : 'active',
        licensesTotal: plan === 'starter' ? 2 : plan === 'executive' ? 5 : 20,
        invoices: [
          {
            id: `in_${Date.now()}`,
            date: new Date().toISOString().slice(0, 10),
            amount: price,
            status: 'pending',
            plan,
          },
          ...prev.invoices,
        ],
      };
      storage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const startTrial = useCallback((plan: PlanKey = 'executive') => {
    const ends = new Date();
    ends.setDate(ends.getDate() + 14);
    const next: BillingState = {
      ...DEFAULT,
      plan,
      status: 'trial',
      trialEndsAt: ends.toISOString().slice(0, 10),
      licensesTotal: plan === 'starter' ? 2 : plan === 'executive' ? 5 : 20,
      invoices: [],
    };
    persist(next);
  }, [persist]);

  const cancelSubscription = useCallback(() => {
    setState((prev) => {
      const next = { ...prev, status: 'cancelled' as BillingStatus };
      storage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const isUpgrade = (target: PlanKey) => PLAN_PRICES[target] > PLAN_PRICES[state.plan];
  const isDowngrade = (target: PlanKey) => PLAN_PRICES[target] < PLAN_PRICES[state.plan];

  return {
    ...state,
    ready,
    changePlan,
    startTrial,
    cancelSubscription,
    isUpgrade,
    isDowngrade,
    price: PLAN_PRICES[state.plan],
  };
}
