/** Limited portal desk — tenant/agent/tech/guard scoped app (not full SPP). */

export type PortalPayMethod = 'cash' | 'platform' | 'cash_hand';

export type PortalBillKind = 'rent' | 'electricity' | 'water';

export type PortalMediaKind = 'photo' | 'video';

export type PortalMediaItem = {
  uri: string;
  kind: PortalMediaKind;
  name?: string;
};

export type PortalDeskActor = 'owner' | 'tenant' | 'agent' | 'tech' | 'guard';

export type PortalDeskMessage = {
  id: string;
  /** e.g. tenant:ten_1 · agent:agent_1 */
  threadId: string;
  from: PortalDeskActor;
  fromName: string;
  text: string;
  media?: PortalMediaItem[];
  createdAt: string;
};

export type TenantPaymentSubmission = {
  id: string;
  tenantId: string;
  tenantName: string;
  unitId?: string;
  amount: number;
  method: PortalPayMethod;
  billKind: PortalBillKind;
  /** YYYY-MM */
  monthKey: string;
  note?: string;
  status: 'pending_owner' | 'confirmed' | 'rejected';
  createdAt: string;
  confirmedAt?: string;
};

export type PortalDeskNotice = {
  id: string;
  audience: PortalDeskActor;
  audienceId: string;
  title: string;
  body: string;
  kind: 'payment_confirmed' | 'task' | 'admin' | 'media';
  createdAt: string;
  read?: boolean;
};

export type PortalDeskState = {
  messages: PortalDeskMessage[];
  payments: TenantPaymentSubmission[];
  notices: PortalDeskNotice[];
};

export function tenantThreadId(tenantId: string) {
  return `tenant:${tenantId}`;
}

export function agentThreadId(agentId: string) {
  return `agent:${agentId}`;
}

export function techThreadId(techId: string) {
  return `tech:${techId}`;
}

export function guardThreadId(guardId: string) {
  return `guard:${guardId}`;
}

export function currentMonthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function formatMonthLabel(monthKey: string, ar: boolean) {
  const [y, m] = monthKey.split('-').map(Number);
  if (!y || !m) return monthKey;
  if (ar) {
    const names = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    return `${names[m - 1] || m} ${y}`;
  }
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${names[m - 1] || m} ${y}`;
}
