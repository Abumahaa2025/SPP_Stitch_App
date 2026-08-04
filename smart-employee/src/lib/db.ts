import type { AppState } from "../data/types";
import { seedState } from "../data/seed";

const STORAGE_KEY = "smart-employee-db-v2";
const LEGACY_KEY = "smart-employee-v1";

function migrate(raw: unknown): AppState {
  const base = seedState();
  if (!raw || typeof raw !== "object") return base;
  const parsed = raw as Partial<AppState>;
  return {
    ...base,
    ...parsed,
    owner: { ...base.owner, ...(parsed.owner || {}) },
    agents: parsed.agents || base.agents,
    rents: parsed.rents || base.rents,
    properties: parsed.properties || base.properties,
    contracts: parsed.contracts || base.contracts,
    tenants: parsed.tenants || base.tenants,
    sensors: parsed.sensors || base.sensors,
    alerts: parsed.alerts || base.alerts,
    technicians: parsed.technicians || base.technicians,
    maintenance: parsed.maintenance || base.maintenance,
    user: { ...base.user, ...(parsed.user || {}) },
    loggedIn: Boolean(parsed.loggedIn),
  };
}

/** تحميل غير متزامن لمحاكاة قاعدة البيانات وإظهار حالة التحميل */
export async function loadDatabase(): Promise<AppState> {
  await new Promise((r) => setTimeout(r, 450));
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_KEY);
    if (!raw) return seedState();
    return migrate(JSON.parse(raw));
  } catch {
    return seedState();
  }
}

export async function saveDatabase(state: AppState): Promise<void> {
  await new Promise((r) => setTimeout(r, 180));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  localStorage.removeItem(LEGACY_KEY);
}

export async function clearDatabase(): Promise<void> {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(LEGACY_KEY);
}
