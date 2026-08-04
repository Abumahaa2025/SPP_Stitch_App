import { storage } from '@/src/utils/storage';
import type {
  PortalBillKind,
  PortalDeskActor,
  PortalDeskMessage,
  PortalDeskNotice,
  PortalDeskState,
  PortalMediaItem,
  PortalPayMethod,
  TenantPaymentSubmission,
} from '@/src/types/portal-desk';
import { formatMonthLabel, tenantThreadId } from '@/src/types/portal-desk';
import { addPendingAction, loadOperational, removePendingAction } from '@/src/utils/operational-store';
import { getLang } from '@/src/i18n';

const KEY = 'spp.portalDesk';
const OS_KEY = 'spp.propertyOS';

const DEFAULT: PortalDeskState = {
  messages: [],
  payments: [],
  notices: [],
};

let cache: PortalDeskState = { ...DEFAULT };
const listeners = new Set<() => void>();

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function billLabel(kind: PortalBillKind, ar: boolean) {
  if (kind === 'rent') return ar ? 'إيجار' : 'rent';
  if (kind === 'electricity') return ar ? 'كهرباء' : 'electricity';
  return ar ? 'مياه' : 'water';
}

function methodLabel(method: PortalPayMethod, ar: boolean) {
  if (method === 'cash') return ar ? 'كاش' : 'cash';
  if (method === 'platform') return ar ? 'منصة' : 'platform';
  return ar ? 'نقداً' : 'cash in hand';
}

export function subscribePortalDesk(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  listeners.forEach((fn) => fn());
}

export async function loadPortalDesk(): Promise<PortalDeskState> {
  const raw = await storage.getItem<string>(KEY, '');
  if (raw) {
    try {
      cache = { ...DEFAULT, ...JSON.parse(raw) };
    } catch { /* ignore */ }
  } else {
    cache = { ...DEFAULT };
  }
  return cache;
}

async function save(next: PortalDeskState) {
  cache = next;
  await storage.setItem(KEY, JSON.stringify(cache));
  notify();
}

export async function postPortalMessage(input: {
  threadId: string;
  from: PortalDeskActor;
  fromName: string;
  text: string;
  media?: PortalMediaItem[];
}): Promise<PortalDeskMessage> {
  const s = await loadPortalDesk();
  const msg: PortalDeskMessage = {
    id: uid('pm'),
    threadId: input.threadId,
    from: input.from,
    fromName: input.fromName.trim(),
    text: input.text.trim(),
    media: input.media,
    createdAt: new Date().toISOString(),
  };
  await save({
    ...s,
    messages: [msg, ...s.messages].slice(0, 200),
  });
  return msg;
}

export async function submitTenantPayment(input: {
  tenantId: string;
  tenantName: string;
  unitId?: string;
  amount: number;
  method: PortalPayMethod;
  billKind: PortalBillKind;
  monthKey: string;
  note?: string;
}): Promise<TenantPaymentSubmission> {
  const s = await loadPortalDesk();
  const item: TenantPaymentSubmission = {
    id: uid('tpay'),
    tenantId: input.tenantId,
    tenantName: input.tenantName,
    unitId: input.unitId,
    amount: input.amount,
    method: input.method,
    billKind: input.billKind,
    monthKey: input.monthKey,
    note: input.note?.trim(),
    status: 'pending_owner',
    createdAt: new Date().toISOString(),
  };
  await save({
    ...s,
    payments: [item, ...s.payments].slice(0, 120),
  });

  const ar = getLang() === 'ar';
  await addPendingAction({
    kind: 'approve_tenant_payment',
    labelKey: 'opsv2.portalDesk.pendingPayment',
    labelParams: {
      name: input.tenantName,
      bill: billLabel(input.billKind, ar),
      month: formatMonthLabel(input.monthKey, ar),
      amount: String(input.amount),
      method: methodLabel(input.method, ar),
    },
    payload: { paymentId: item.id, tenantId: input.tenantId },
  });

  return item;
}

function confirmationCopy(
  billKind: PortalBillKind,
  monthKey: string,
  ar: boolean,
): { title: string; body: string } {
  const month = formatMonthLabel(monthKey, ar);
  if (billKind === 'rent') {
    return ar
      ? { title: 'تم تأكيد السداد', body: `تم سداد إيجار لشهر ${month}.` }
      : { title: 'Payment confirmed', body: `Rent for ${month} has been paid.` };
  }
  if (billKind === 'electricity') {
    return ar
      ? { title: 'تم تأكيد السداد', body: `تم سداد فاتورة الكهرباء لشهر ${month}.` }
      : { title: 'Payment confirmed', body: `Electricity bill for ${month} has been paid.` };
  }
  return ar
    ? { title: 'تم تأكيد السداد', body: `تم سداد فاتورة المياه لشهر ${month}.` }
    : { title: 'Payment confirmed', body: `Water bill for ${month} has been paid.` };
}

async function appendOsPayment(unitId: string, tenantId: string, amount: number, method: PortalPayMethod, monthKey: string) {
  const raw = await storage.getItem<string>(OS_KEY, '');
  if (!raw) return;
  try {
    const os = JSON.parse(raw);
    const payment = {
      id: uid('pay'),
      unitId,
      tenantId,
      amount,
      paidAt: new Date().toISOString(),
      method: method === 'cash_hand' ? 'cash' : method,
      monthKey,
    };
    os.payments = [...(os.payments || []), payment];
    await storage.setItem(OS_KEY, JSON.stringify(os));
  } catch { /* ignore */ }
}

export async function confirmTenantPayment(
  paymentId: string,
  opts?: { ar?: boolean },
): Promise<TenantPaymentSubmission | null> {
  const s = await loadPortalDesk();
  const target = s.payments.find((p) => p.id === paymentId);
  if (!target || target.status !== 'pending_owner') return null;

  const ar = opts?.ar !== false;
  const copy = confirmationCopy(target.billKind, target.monthKey, ar);
  const now = new Date().toISOString();
  const notice: PortalDeskNotice = {
    id: uid('pn'),
    audience: 'tenant',
    audienceId: target.tenantId,
    title: copy.title,
    body: copy.body,
    kind: 'payment_confirmed',
    createdAt: now,
  };

  const payments = s.payments.map((p) => (
    p.id === paymentId ? { ...p, status: 'confirmed' as const, confirmedAt: now } : p
  ));

  await save({
    ...s,
    payments,
    notices: [notice, ...s.notices].slice(0, 120),
    messages: [
      {
        id: uid('pm'),
        threadId: tenantThreadId(target.tenantId),
        from: 'owner' as const,
        fromName: ar ? 'المالك' : 'Owner',
        text: copy.body,
        createdAt: now,
      },
      ...s.messages,
    ].slice(0, 200),
  });

  if (target.unitId) {
    await appendOsPayment(target.unitId, target.tenantId, target.amount, target.method, target.monthKey);
  }

  try {
    const op = await loadOperational();
    const match = op.pendingActions.find(
      (a) => a.kind === 'approve_tenant_payment' && a.payload?.paymentId === paymentId,
    );
    if (match) await removePendingAction(match.id);
  } catch { /* ignore */ }

  return { ...target, status: 'confirmed', confirmedAt: now };
}

export async function rejectTenantPayment(paymentId: string): Promise<void> {
  const s = await loadPortalDesk();
  await save({
    ...s,
    payments: s.payments.map((p) => (
      p.id === paymentId ? { ...p, status: 'rejected' as const } : p
    )),
  });
  try {
    const op = await loadOperational();
    const match = op.pendingActions.find(
      (a) => a.kind === 'approve_tenant_payment' && a.payload?.paymentId === paymentId,
    );
    if (match) await removePendingAction(match.id);
  } catch { /* ignore */ }
}

export async function pushPortalNotice(input: Omit<PortalDeskNotice, 'id' | 'createdAt'>): Promise<void> {
  const s = await loadPortalDesk();
  const notice: PortalDeskNotice = {
    ...input,
    id: uid('pn'),
    createdAt: new Date().toISOString(),
  };
  await save({ ...s, notices: [notice, ...s.notices].slice(0, 120) });
}
