import type { AppState } from "../data/types";
import { defaultPlatformLinks } from "../data/platforms";
import { seedState } from "../data/seed";

/** v4 يضيف روابط المنصات وصندوق الوارد */
const STORAGE_KEY = "smart-employee-db-v4";
const LEGACY_KEYS = ["smart-employee-db-v3", "smart-employee-db-v2", "smart-employee-v1"];

function mergePlatformLinks(parsed: Partial<AppState>): AppState["platformLinks"] {
  const defaults = defaultPlatformLinks();
  if (!Array.isArray(parsed.platformLinks) || !parsed.platformLinks.length) return defaults;
  const byId = new Map(parsed.platformLinks.map((p) => [p.id, p]));
  const merged = defaults.map((d) => ({ ...d, ...(byId.get(d.id) || {}) }));
  const custom = parsed.platformLinks.filter((p) => !defaults.some((d) => d.id === p.id));
  return [...merged, ...custom];
}

function migrate(raw: unknown): AppState {
  const base = seedState();
  if (!raw || typeof raw !== "object") return base;
  const parsed = raw as Partial<AppState>;
  return {
    ...base,
    ...parsed,
    owner: { ...base.owner, ...(parsed.owner || {}) },
    user: { ...base.user, ...(parsed.user || {}) },
    ejar: {
      ...base.ejar,
      ...(parsed.ejar || {}),
      mode: parsed.ejar?.mode === "live" ? "live" : "mock",
      baseUrl: parsed.ejar?.baseUrl || base.ejar.baseUrl,
      autoSubmitOnApproval: parsed.ejar?.autoSubmitOnApproval !== false,
    },
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
    platformLinks: mergePlatformLinks(parsed),
    platformNotices: Array.isArray(parsed.platformNotices) ? parsed.platformNotices : [],
    ownerAuthorizations: Array.isArray(parsed.ownerAuthorizations)
      ? parsed.ownerAuthorizations
      : [],
    loggedIn: Boolean(parsed.loggedIn),
  };
}

export async function loadDatabase(): Promise<AppState> {
  await new Promise((r) => setTimeout(r, 400));
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      for (const key of LEGACY_KEYS) {
        const legacy = localStorage.getItem(key);
        if (legacy) {
          const migrated = migrate(JSON.parse(legacy));
          localStorage.removeItem(key);
          return migrated;
        }
      }
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
