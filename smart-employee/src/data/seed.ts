import type { AppState } from "./types";
import { defaultPlatformLinks } from "./platforms";

let n = 0;
export function uid(prefix: string) {
  n += 1;
  return `${prefix}_${Date.now().toString(36)}_${n}`;
}

/** حالة فارغة بدون أي بيانات تجريبية */
export const seedState = (): AppState => ({
  loggedIn: false,
  user: {
    name: "مدير العقار",
    role: "مدير تشغيل",
    initials: "م.ع",
  },
  owner: {
    name: "",
    phone: "",
    email: "",
    company: "",
    city: "الرياض",
  },
  agents: [],
  properties: [],
  contracts: [],
  rents: [],
  sensors: [],
  alerts: [],
  technicians: [],
  maintenance: [],
  tenants: [],
  ejar: {
    connected: false,
    facilityNo: "",
    apiKeyMasked: "",
    mode: "mock",
    baseUrl: "https://api.ejar.sa/v1",
    autoSubmitOnApproval: true,
    lastSyncAt: undefined,
    notes: "",
  },
  ejarRenewals: [],
  platformLinks: defaultPlatformLinks(),
  platformNotices: [],
  ownerAuthorizations: [],
});
