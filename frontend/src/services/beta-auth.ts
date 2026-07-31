import { storage } from '@/src/utils/storage';
import { apiUrl } from '@/src/constants/backend';

export type Persona = 'owner' | 'tenant' | 'technician';

export type BetaUserAccount = {
  id: string;
  name: string;
  phone: string;
  email: string;
  password: string;
  persona?: Persona;
  createdAt: string;
};

export type SignInFailureCode = 'empty' | 'not_found' | 'wrong_password';

export type FinalizeSessionResult = {
  sessionSaved: boolean;
  backendSynced: boolean;
  backendError?: string;
};

export const DEMO_CREDENTIALS: Record<Persona, { email: string; password: string }> = {
  owner: { email: 'demo.owner@spp.beta', password: 'SPP-Owner-26' },
  tenant: { email: 'demo.tenant@spp.beta', password: 'SPP-Tenant-26' },
  technician: { email: 'demo.tech@spp.beta', password: 'SPP-Tech-26' },
};

const ACCOUNTS_KEY = 'spp.beta.accounts';
const ACTIVE_ACCOUNT_KEY = 'spp.beta.activeAccountId';
const BETA_LOGIN_TIMEOUT_MS = 75_000;

export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('966')) return digits;
  if (digits.startsWith('0')) return `966${digits.slice(1)}`;
  if (digits.length === 9 && digits.startsWith('5')) return `966${digits}`;
  return digits;
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function resolvePostLoginRoute(persona: Persona, onboarded: boolean): string {
  if (!onboarded) return '/onboarding';
  if (persona === 'tenant') return '/notifications';
  if (persona === 'technician') return '/maintenance';
  return '/';
}

export async function listAccounts(): Promise<BetaUserAccount[]> {
  const raw = await storage.getItem<string>(ACCOUNTS_KEY, '[]');
  try {
    const parsed = JSON.parse(raw ?? '[]') as BetaUserAccount[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function persistAccounts(accounts: BetaUserAccount[]): Promise<void> {
  await storage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

function formatErr(e: unknown): string {
  if (e instanceof Error) {
    if (e.name === 'AbortError') return 'انتهت مهلة الاتصال بالخادم (75 ثانية). حاول مرة أخرى.';
    return e.message;
  }
  return String(e);
}

/** Sync demo persona portfolio on Render — must not block local session. */
async function syncBackendPersona(persona: Persona): Promise<void> {
  const cred = DEMO_CREDENTIALS[persona];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BETA_LOGIN_TIMEOUT_MS);
  try {
    const res = await fetch(apiUrl('/beta/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email: cred.email, password: cred.password }),
      signal: controller.signal,
    });
    const text = await res.text().catch(() => '');
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 240) || res.statusText}`);
    }
  } finally {
    clearTimeout(timer);
  }
}

export async function registerAccount(input: {
  name: string;
  phone: string;
  email: string;
  password: string;
}): Promise<{ ok: true; account: BetaUserAccount } | { ok: false; code: 'duplicate' | 'invalid' }> {
  const name = input.name.trim();
  const phone = normalizePhone(input.phone);
  const email = normalizeEmail(input.email);
  const password = input.password;

  if (!name || !phone || !email || password.length < 6) {
    return { ok: false, code: 'invalid' };
  }

  const accounts = await listAccounts();
  if (accounts.some((a) => a.email === email || a.phone === phone)) {
    return { ok: false, code: 'duplicate' };
  }

  const account: BetaUserAccount = {
    id: `acc_${Date.now()}`,
    name,
    phone,
    email,
    password,
    createdAt: new Date().toISOString(),
  };

  accounts.push(account);
  await persistAccounts(accounts);
  await storage.setItem(ACTIVE_ACCOUNT_KEY, account.id);
  return { ok: true, account };
}

function matchDemo(identifier: string, password: string, mode: 'email' | 'phone'): Persona | null {
  if (mode === 'email') {
    const id = normalizeEmail(identifier);
    for (const [persona, cred] of Object.entries(DEMO_CREDENTIALS) as [Persona, { email: string; password: string }][]) {
      if (id === cred.email && password === cred.password) return persona;
    }
    return null;
  }

  // Phone tab: demo password uniquely maps to persona (beta testers often use phone field).
  const byPassword = (Object.entries(DEMO_CREDENTIALS) as [Persona, { email: string; password: string }][])
    .filter(([, cred]) => cred.password === password);
  if (byPassword.length === 1) return byPassword[0][0];

  const id = normalizePhone(identifier);
  if (id.length >= 9) {
    for (const [persona, cred] of Object.entries(DEMO_CREDENTIALS) as [Persona, { email: string; password: string }][]) {
      if (password === cred.password) return persona;
    }
  }
  return null;
}

export async function signInLocal(
  identifier: string,
  password: string,
  mode: 'email' | 'phone',
): Promise<
  | { ok: true; account: BetaUserAccount; needsRole: boolean }
  | { ok: true; demoPersona: Persona }
  | { ok: false; code: SignInFailureCode }
> {
  const trimmedId = identifier.trim();
  if (!trimmedId || !password) {
    return { ok: false, code: 'empty' };
  }

  const accounts = await listAccounts();
  const id = mode === 'email' ? normalizeEmail(trimmedId) : normalizePhone(trimmedId);

  const account = accounts.find((a) =>
    mode === 'email' ? a.email === id : a.phone === id,
  );

  if (account) {
    if (account.password !== password) return { ok: false, code: 'wrong_password' };
    await storage.setItem(ACTIVE_ACCOUNT_KEY, account.id);
    return { ok: true, account, needsRole: !account.persona };
  }

  const demoPersona = matchDemo(trimmedId, password, mode);
  if (demoPersona) return { ok: true, demoPersona };

  return { ok: false, code: 'not_found' };
}

export async function assignPersona(accountId: string, persona: Persona): Promise<BetaUserAccount | null> {
  const accounts = await listAccounts();
  const idx = accounts.findIndex((a) => a.id === accountId);
  if (idx < 0) return null;
  accounts[idx] = { ...accounts[idx], persona };
  await persistAccounts(accounts);
  await storage.setItem(ACTIVE_ACCOUNT_KEY, accountId);
  return accounts[idx];
}

export async function getActiveAccount(): Promise<BetaUserAccount | null> {
  const id = await storage.getItem<string>(ACTIVE_ACCOUNT_KEY, '');
  if (!id) return null;
  const accounts = await listAccounts();
  return accounts.find((a) => a.id === id) ?? null;
}

export async function finalizeSession(opts: {
  persona: Persona;
  displayEmail: string;
  displayName?: string;
  /** Spec §2 — demo portfolio only for explicit demo credentials, never real accounts. */
  useDemoData?: boolean;
}): Promise<FinalizeSessionResult> {
  const alreadyOnboarded = await storage.getItem<boolean>('spp.onboarded', false);
  const useDemo = Boolean(opts.useDemoData);

  // Save local session first — navigation must never wait on Render cold start.
  const authedOk = await storage.setItem('spp.betaAuthed', true);
  const personaOk = await storage.setItem('spp.betaPersona', opts.persona);
  const emailOk = await storage.setItem('spp.betaEmail', opts.displayEmail);
  if (opts.displayName?.trim()) {
    await storage.setItem('spp.ownerName', opts.displayName.trim());
  }
  await storage.setItem('spp.demoMode', useDemo);
  if (!alreadyOnboarded) {
    await storage.setItem('spp.onboarded', false);
  }

  const sessionSaved = authedOk && personaOk && emailOk;

  let backendSynced = false;
  let backendError: string | undefined;
  if (useDemo) {
    try {
      await syncBackendPersona(opts.persona);
      backendSynced = true;
    } catch (e) {
      backendError = formatErr(e);
    }
  } else {
    // Real account — local session only; never pull demo credentials into the API.
    backendSynced = true;
  }

  return { sessionSaved, backendSynced, backendError };
}

/** End beta session — returns to login without wiping local accounts or connections. */
export async function signOutSession(): Promise<void> {
  await storage.setItem('spp.betaAuthed', false);
  await storage.removeItem('spp.betaPersona');
  await storage.removeItem('spp.betaEmail');
  await storage.removeItem(ACTIVE_ACCOUNT_KEY);
  await storage.removeItem('spp.activeAgentId');
}
