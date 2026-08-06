import { HttpEjarGateway } from "./httpGateway";
import { MockEjarGateway } from "./mockGateway";
import type { EjarCredentials, EjarGateway, EjarMode } from "./types";

const CRED_KEY = "smart-employee-ejar-creds-v1";

export function getEjarGateway(mode: EjarMode): EjarGateway {
  return mode === "live" ? new HttpEjarGateway() : new MockEjarGateway();
}

export function saveEjarSecrets(apiKey: string) {
  // يُحفظ محلياً فقط على جهاز المستخدم — للإنتاج لاحقاً يُنقل لخادم آمن
  sessionStorage.setItem(CRED_KEY, apiKey);
}

export function readEjarSecrets(): string {
  return sessionStorage.getItem(CRED_KEY) || "";
}

export function clearEjarSecrets() {
  sessionStorage.removeItem(CRED_KEY);
}

export function buildCredentials(input: {
  facilityNo: string;
  apiKey: string;
  baseUrl?: string;
  mode?: EjarMode;
}): EjarCredentials {
  return {
    facilityNo: input.facilityNo.trim(),
    apiKey: input.apiKey.trim(),
    baseUrl: (input.baseUrl || "https://api.ejar.sa/v1").replace(/\/$/, ""),
    mode: input.mode || "mock",
  };
}

export * from "./types";
export * from "./mockGateway";
export * from "./httpGateway";
