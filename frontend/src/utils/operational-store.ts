import { storage } from '@/src/utils/storage';
import type { MaintenanceTicket, OperationalEvent, PendingAction } from '@/src/types/operational';

export type OperationalState = {
  events: OperationalEvent[];
  tickets: MaintenanceTicket[];
  pendingActions: PendingAction[];
};

const KEY = 'spp.operational';

const DEFAULT: OperationalState = {
  events: [],
  tickets: [],
  pendingActions: [],
};

let cache: OperationalState | null = null;
const listeners = new Set<() => void>();

export function subscribeOperational(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function notify() {
  listeners.forEach((fn) => fn());
}

export function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export async function loadOperational(): Promise<OperationalState> {
  if (cache) return cache;
  const raw = await storage.getItem<string>(KEY, '');
  if (raw) {
    try {
      cache = { ...DEFAULT, ...JSON.parse(raw) };
      return cache!;
    } catch { /* ignore */ }
  }
  cache = { ...DEFAULT };
  return cache;
}

export async function saveOperational(next: OperationalState) {
  cache = next;
  await storage.setItem(KEY, JSON.stringify(next));
  notify();
}

export async function appendEvent(
  event: Omit<OperationalEvent, 'id' | 'at'> & { at?: string },
): Promise<OperationalEvent> {
  const state = await loadOperational();
  const ev: OperationalEvent = {
    ...event,
    id: uid('ev'),
    at: event.at ?? new Date().toISOString(),
  };
  await saveOperational({
    ...state,
    events: [ev, ...state.events].slice(0, 120),
  });
  return ev;
}

export async function addPendingAction(
  action: Omit<PendingAction, 'id' | 'createdAt'>,
): Promise<PendingAction> {
  const state = await loadOperational();
  const item: PendingAction = {
    ...action,
    id: uid('pa'),
    createdAt: new Date().toISOString(),
  };
  await saveOperational({
    ...state,
    pendingActions: [item, ...state.pendingActions].slice(0, 30),
  });
  return item;
}

export async function removePendingAction(id: string) {
  const state = await loadOperational();
  await saveOperational({
    ...state,
    pendingActions: state.pendingActions.filter((a) => a.id !== id),
  });
}

export async function upsertTicket(ticket: MaintenanceTicket) {
  const state = await loadOperational();
  const idx = state.tickets.findIndex((t) => t.id === ticket.id);
  const tickets = idx >= 0
    ? state.tickets.map((t) => (t.id === ticket.id ? ticket : t))
    : [ticket, ...state.tickets];
  await saveOperational({ ...state, tickets: tickets.slice(0, 80) });
}

export async function getTicket(id: string) {
  const state = await loadOperational();
  return state.tickets.find((t) => t.id === id);
}
