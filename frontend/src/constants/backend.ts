/** Production beta API — always used when env is missing or LAN (OTA-safe). */
export const BETA_BACKEND_URL = 'https://spp-beta-api.onrender.com';

export function resolveBackendUrl(): string {
  const raw = process.env.EXPO_PUBLIC_BACKEND_URL?.trim() ?? '';
  if (!raw) return BETA_BACKEND_URL;
  // OTA/dev bundles may ship a LAN URL — beta APK must hit Render.
  if (raw.includes('192.168.') || raw.includes('127.0.0.1') || raw.includes('localhost')) {
    return BETA_BACKEND_URL;
  }
  return raw.replace(/\/$/, '');
}

export function apiUrl(path: string): string {
  const base = resolveBackendUrl();
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}/api${p}`;
}
