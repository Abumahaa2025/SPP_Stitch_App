import { useCallback, useEffect, useState } from 'react';
import {
  confirmTenantPayment as storeConfirm,
  loadPortalDesk,
  postPortalMessage as storePost,
  rejectTenantPayment as storeReject,
  submitTenantPayment as storeSubmit,
  subscribePortalDesk,
} from '@/src/utils/portal-desk-store';
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

const EMPTY: PortalDeskState = { messages: [], payments: [], notices: [] };

export function usePortalDesk() {
  const [state, setState] = useState<PortalDeskState>(EMPTY);
  const [ready, setReady] = useState(false);

  const reload = useCallback(async () => {
    const s = await loadPortalDesk();
    setState(s);
    setReady(true);
  }, []);

  useEffect(() => {
    reload();
    const unsub = subscribePortalDesk(() => { reload(); });
    return () => { unsub(); };
  }, [reload]);

  const postMessage = useCallback(async (input: {
    threadId: string;
    from: PortalDeskActor;
    fromName: string;
    text: string;
    media?: PortalMediaItem[];
  }) => {
    const msg = await storePost(input);
    await reload();
    return msg;
  }, [reload]);

  const submitPayment = useCallback(async (input: {
    tenantId: string;
    tenantName: string;
    unitId?: string;
    amount: number;
    method: PortalPayMethod;
    billKind: PortalBillKind;
    monthKey: string;
    note?: string;
  }) => {
    const item = await storeSubmit(input);
    await reload();
    return item;
  }, [reload]);

  const confirmPayment = useCallback(async (paymentId: string, ar?: boolean) => {
    const item = await storeConfirm(paymentId, { ar });
    await reload();
    return item;
  }, [reload]);

  const rejectPayment = useCallback(async (paymentId: string) => {
    await storeReject(paymentId);
    await reload();
  }, [reload]);

  const threadMessages = useCallback((threadId: string): PortalDeskMessage[] => (
    state.messages.filter((m) => m.threadId === threadId)
  ), [state.messages]);

  const audienceNotices = useCallback((audience: PortalDeskActor, audienceId: string): PortalDeskNotice[] => (
    state.notices.filter((n) => n.audience === audience && n.audienceId === audienceId)
  ), [state.notices]);

  const pendingPayments = useCallback((): TenantPaymentSubmission[] => (
    state.payments.filter((p) => p.status === 'pending_owner')
  ), [state.payments]);

  const tenantPayments = useCallback((tenantId: string): TenantPaymentSubmission[] => (
    state.payments.filter((p) => p.tenantId === tenantId)
  ), [state.payments]);

  return {
    ready,
    messages: state.messages,
    payments: state.payments,
    notices: state.notices,
    postMessage,
    submitPayment,
    confirmPayment,
    rejectPayment,
    threadMessages,
    audienceNotices,
    pendingPayments,
    tenantPayments,
    reload,
  };
}
