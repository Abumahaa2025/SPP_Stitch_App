import { Linking } from 'react-native';

/** Source web (SPP_Official GAS) — same operational surface as v3pro / portals. */
const BASE = (process.env.EXPO_PUBLIC_SOURCE_WEB_URL || '').replace(/\/$/, '');

export type SourceApp = 'koil' | 'owner' | 'tenant' | 'technician' | 'mobile' | 'settings';

export function sourceWebUrl(app: SourceApp, extra?: Record<string, string>): string | null {
  if (!BASE) return null;
  const params = new URLSearchParams();
  if (app === 'settings') {
    params.set('view', 'settings');
  } else {
    params.set('app', app);
  }
  if (extra) {
    Object.entries(extra).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
  }
  const qs = params.toString();
  return qs ? `${BASE}/exec?${qs}` : `${BASE}/exec`;
}

export async function openSourcePortal(app: SourceApp, extra?: Record<string, string>): Promise<boolean> {
  const url = sourceWebUrl(app, extra);
  if (!url) return false;
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

export function hasSourceWeb(): boolean {
  return Boolean(BASE);
}
