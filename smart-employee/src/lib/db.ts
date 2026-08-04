import type { AppState } from "../data/types";
import { seedState } from "../data/seed";

/** v3 يفرّغ أي بيانات تجريبية قديمة */
const STORAGE_KEY = "smart-employee-db-v3";
const LEGACY_KEYS = ["smart-employee-db-v2", "smart-employee-v1"];

function migrate(raw: unknown): AppState {
  const base = seedState();
  if (!raw || typeof raw !== "object") return base;
  const parsed = raw as Partial<AppState>;
  return {
    ...base,
    ...parsed,
    owner: { ...base.owner, ...(parsed.owner || {}) },
    user: { ...base.user, ...(parsed.user || {}) },
    ejar: { ...base.ejar, ...(parsed.ejar || {}) },
    agents: Array.isArray(parsed.agents) ? parsed.agents : [],
    rents: Array.isArray(parsed.rents) ? parsed.rents : [],
    properties: Array.isArray(parsed.properties) ? parsed.properties : [],
    contracts: Array.isArray(parsed.contracts) ? parsed.contracts : [],
    tenants: Array.isArray(parsed.tenants) ? parsed.tenants : [],
    sensors: Array.isArray(parsed.sensors) ? parsed.sensors : [],
    alerts: Array.isArray(parsed.alerts) ? parsed.alerts : [],
    technicians: Array.isArray(parsed.technicians) ? parsed.technicians : [],
    maintenance: Array.isArray(parsed.maintenance) ? parsed.maintenance : [],
    ejarRenewals: Array.isArray(parsed.ejarRenewals) ? parsed.ejarRenewals : [],
    loggedIn: Boolean(parsed.loggedIn),
  };
}

export async function loadDatabase(): Promise<AppState> {
  await new Promise((r) => setTimeout(r, 400));
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // تجاهل الإصدارات التجريبية القديمة وابدأ فارغاً
      LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));
      return seedState();
    }
    return migrate(JSON.parse(raw));
  } catch {
    return seedState();
  }
}

export async function saveDatabase(state: AppState): Promise<void> {
  await new Promise((r) => setTimeout(r, 160));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));
}

export async function clearDatabase(): Promise<void> {
  localStorage.removeItem(STORAGE_KEY);
  LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));
}
