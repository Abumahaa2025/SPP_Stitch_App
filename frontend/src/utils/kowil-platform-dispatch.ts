/**
 * Historical Kowil spelling — prefer `@/src/utils/koil-platform-dispatch`.
 * Open prepared messages (wa.me / share) after owner approval.
 * Prepare-not-send: never server-dispatches; delivery remains a deep-link open.
 */
import { Linking, Platform, Share } from 'react-native';

import { loadPortalAccess } from '@/src/utils/portal-access-store';
import type { EmployeeTask } from '@/src/types/smart-employee';

export type PreparedMessages = Record<string, string | undefined>;

export async function dispatchAfterOwnerApproval(
  prepared: PreparedMessages | undefined,
  task: EmployeeTask,
  routeTo?: string,
): Promise<void> {
  const route = (routeTo || task.routeTo || 'tenant').toLowerCase();
  const portal = await loadPortalAccess();
  let message = prepared?.[route] || prepared?.tenant || task.whatsappMessage || '';
  let phone = task.whatsappPhone || '';

  if (route === 'agent') {
    const agent = portal.agents.find((a) => a.linkActive && a.permissions?.contracts)
      || portal.agents.find((a) => a.linkActive);
    if (agent?.phone) phone = agent.phone;
    message = prepared?.agent || message;
  } else if (route === 'tech' || route === 'guard') {
    const maintAgent = portal.agents.find((a) => a.linkActive && a.permissions?.maintenance);
    if (maintAgent?.phone) phone = maintAgent.phone;
    message = prepared?.[route] || message;
  } else if (route === 'tenant') {
    message = prepared?.tenant || message;
  }

  if (!message.trim()) return;

  const digits = String(phone).replace(/\D/g, '');
  if (digits) {
    const wa = Platform.select({
      ios: `whatsapp://send?phone=${digits}&text=${encodeURIComponent(message)}`,
      default: `https://wa.me/${digits}?text=${encodeURIComponent(message)}`,
    });
    await Linking.openURL(wa!).catch(() => Share.share({ message }));
  } else {
    await Share.share({ message });
  }
}
