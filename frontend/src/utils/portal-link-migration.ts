/**
 * One-shot repair for portal links saved before the HTML bridge fix.
 *
 * Links stored with a plain-text CDN host open as page source on the
 * recipient's phone, so every persisted copy (portal URL, QR payload, WhatsApp
 * draft) is rewritten in place to the working bridge host.
 */
import { storage } from '@/src/utils/storage';
import { normalizePortalBridgeText } from '@/src/utils/portal-links';

const PORTAL_STORAGE_KEYS = [
  'spp.propertyOS',
  'spp.portalAccess',
  'spp.technicians',
  'spp.accountControl.guards',
];

/** Returns the storage keys that were repaired. */
export async function migrateStoredPortalLinks(): Promise<string[]> {
  const repaired: string[] = [];
  for (const key of PORTAL_STORAGE_KEYS) {
    const raw = await storage.getItem<string>(key, '');
    if (!raw || typeof raw !== 'string') continue;
    const next = normalizePortalBridgeText(raw);
    if (next === raw) continue;
    await storage.setItem(key, next);
    repaired.push(key);
  }
  return repaired;
}
