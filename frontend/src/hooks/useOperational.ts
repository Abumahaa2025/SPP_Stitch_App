import { useCallback, useEffect, useMemo, useState } from 'react';

import type { MaintenanceTicket, MediaAttachment } from '@/src/types/operational';
import type { TechnicianRecord } from '@/src/types/technician';
import {
  createOwnerTicket,
  assignTechnicianToTicket,
  techAcceptTicket,
  techEnRoute,
  techStartTicket,
  techUploadMedia,
  techCompleteTicket,
  tenantApproveTicket,
  tenantRequestReprocess,
  proposeTicketCost,
  decideTicketCost,
  ticketsForTechnician,
  ticketsForUnit,
} from '@/src/utils/maintenance-workflow';
import { onMaintenanceOpened } from '@/src/utils/operational-flow-engine';
import { onEjarApproved } from '@/src/utils/operational-flow-engine';
import { onUtilityPaymentApproved } from '@/src/utils/operational-flow-engine';
import { approveEjarEvent } from '@/src/utils/ejar-sync';
import { approveUtilityPayment } from '@/src/utils/utilities-sync';
import { pushLocalNotification } from '@/src/utils/local-notifications';
import {
  loadOperational,
  removePendingAction,
  subscribeOperational,
  upsertTicket,
} from '@/src/utils/operational-store';
import { getLang } from '@/src/i18n';
import { Linking, Platform, Share } from 'react-native';

export function useOperational() {
  const [, bump] = useState(0);
  useEffect(() => subscribeOperational(() => bump((n) => n + 1)), []);

  const [state, setState] = useState({
    events: [] as import('@/src/types/operational').OperationalEvent[],
    tickets: [] as MaintenanceTicket[],
    pendingActions: [] as import('@/src/types/operational').PendingAction[],
  });
  const [ready, setReady] = useState(false);

  const reload = useCallback(async () => {
    const s = await loadOperational();
    setState(s);
    setReady(true);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const openTicket = useCallback(async (
    unitId: string,
    title: string,
    tenantId?: string,
    description?: string,
    unitNumber?: string,
    extras?: {
      category?: MaintenanceTicket['category'];
      priority?: MaintenanceTicket['priority'];
      technicianId?: string;
      technicianName?: string;
      media?: MediaAttachment[];
    },
  ) => {
    const ticket = await createOwnerTicket(
      unitId, title, tenantId, description,
      {
        category: extras?.category,
        priority: extras?.priority,
        media: extras?.media,
        technicianId: extras?.technicianId,
        technicianName: extras?.technicianName,
      },
      unitNumber,
    );
    if (!extras?.technicianId) await onMaintenanceOpened(ticket, unitNumber);
    await reload();
    return ticket;
  }, [reload]);

  const assignTechnician = useCallback(async (
    ticketId: string,
    tech: TechnicianRecord,
    unitNumber?: string,
  ) => {
    const s = await loadOperational();
    const ticket = s.tickets.find((t) => t.id === ticketId);
    if (!ticket) return;
    await assignTechnicianToTicket(ticket, tech, unitNumber);
    await reload();
  }, [reload]);

  const acceptTicket = useCallback(async (ticketId: string) => {
    const s = await loadOperational();
    const ticket = s.tickets.find((t) => t.id === ticketId);
    if (!ticket) return;
    await techAcceptTicket(ticket);
    await reload();
  }, [reload]);

  const enRouteTicket = useCallback(async (ticketId: string) => {
    const s = await loadOperational();
    const ticket = s.tickets.find((t) => t.id === ticketId);
    if (!ticket) return;
    await techEnRoute(ticket);
    await reload();
  }, [reload]);

  const startTicket = useCallback(async (ticketId: string) => {
    const s = await loadOperational();
    const ticket = s.tickets.find((t) => t.id === ticketId);
    if (!ticket) return;
    await techStartTicket(ticket);
    await reload();
  }, [reload]);

  const uploadTicketMedia = useCallback(async (
    ticketId: string,
    media: MediaAttachment[],
    phase: 'before' | 'after' | 'general',
  ) => {
    const s = await loadOperational();
    const ticket = s.tickets.find((t) => t.id === ticketId);
    if (!ticket) return;
    await techUploadMedia(ticket, media, phase);
    await reload();
  }, [reload]);

  const completeTicket = useCallback(async (ticketId: string, note?: string) => {
    const s = await loadOperational();
    const ticket = s.tickets.find((t) => t.id === ticketId);
    if (!ticket) return;
    await techCompleteTicket(ticket, s.tickets, note);
    await reload();
  }, [reload]);

  const tenantApprove = useCallback(async (
    ticketId: string,
    rating: number,
    comment?: string,
  ) => {
    const s = await loadOperational();
    const ticket = s.tickets.find((t) => t.id === ticketId);
    if (!ticket) return;
    await tenantApproveTicket(ticket, rating, comment);
    if (ticket.technicianId) {
      const { updateTechnicianRating } = await import('@/src/utils/technician-store');
      await updateTechnicianRating(ticket.technicianId, rating);
    }
    await reload();
  }, [reload]);

  const tenantReprocess = useCallback(async (ticketId: string, comment?: string) => {
    const s = await loadOperational();
    const ticket = s.tickets.find((t) => t.id === ticketId);
    if (!ticket) return;
    await tenantRequestReprocess(ticket, comment);
    await reload();
  }, [reload]);

  const proposeCost = useCallback(async (ticketId: string, amount: number, note?: string) => {
    const s = await loadOperational();
    const ticket = s.tickets.find((t) => t.id === ticketId);
    if (!ticket) return;
    await proposeTicketCost(ticket, amount, note);
    await reload();
  }, [reload]);

  const decideCost = useCallback(async (ticketId: string, decision: 'approved' | 'rejected') => {
    const s = await loadOperational();
    const ticket = s.tickets.find((t) => t.id === ticketId);
    if (!ticket) return;
    await decideTicketCost(ticket, decision);
    await reload();
  }, [reload]);

  /** @deprecated use workflow methods */
  const assignTicket = useCallback(async (ticketId: string, techName: string) => {
    const s = await loadOperational();
    const ticket = s.tickets.find((t) => t.id === ticketId);
    if (!ticket) return;
    const next: MaintenanceTicket = {
      ...ticket,
      status: 'assigned',
      technicianName: techName,
      updatedAt: new Date().toISOString(),
    };
    await upsertTicket(next);
    await reload();
  }, [reload]);

  const updateTicketStatus = useCallback(async (
    ticketId: string,
    status: MaintenanceTicket['status'],
    note?: string,
    unitNumber?: string,
    extras?: { media?: MediaAttachment[]; rating?: number },
  ) => {
    const s = await loadOperational();
    const ticket = s.tickets.find((t) => t.id === ticketId);
    if (!ticket) return;
    const notes = note ? [...ticket.notes, note] : ticket.notes;
    const next: MaintenanceTicket = {
      ...ticket,
      status,
      notes,
      rating: extras?.rating ?? ticket.rating,
      updatedAt: new Date().toISOString(),
      closedAt: status === 'closed' ? new Date().toISOString() : ticket.closedAt,
    };
    await upsertTicket(next);
    await reload();
  }, [reload]);

  const approveAction = useCallback(async (id: string) => {
    const action = state.pendingActions.find((a) => a.id === id);
    if (action?.kind === 'approve_ejar_notice' && action.payload?.eventId) {
      const result = await approveEjarEvent(action.payload.eventId);
      const ar = getLang() === 'ar';
      const msgs = result?.approval?.prepared_messages || {};
      await onEjarApproved(action.payload.contractNumber || '—');
      await pushLocalNotification({
        id: `loc_ejar_approved_${action.payload.eventId}`,
        title: ar ? 'كويل · تمت الموافقة' : 'Kowil · approved',
        body: ar
          ? (result?.approval?.kowil_note_ar
            || 'تم تجهيز إشعارات المالك ووكيل العقود والمستأجر — لم يُرسل تلقائياً.')
          : (result?.approval?.kowil_note_en
            || 'Notices for owner, contracts agent, and tenant are prepared — not auto-sent.'),
        priority: 'high',
        route: '/contracts',
      });
      // Offer tenant WhatsApp only after owner permission (prepare → optional send).
      const tenantMsg = msgs.tenant || action.payload.message;
      const phone = action.payload.phone;
      if (tenantMsg && phone) {
        const digits = String(phone).replace(/\D/g, '');
        if (digits) {
          const wa = Platform.select({
            ios: `whatsapp://send?phone=${digits}&text=${encodeURIComponent(tenantMsg)}`,
            default: `https://wa.me/${digits}?text=${encodeURIComponent(tenantMsg)}`,
          });
          await Linking.openURL(wa!).catch(() => Share.share({ message: tenantMsg }));
        } else {
          await Share.share({ message: tenantMsg });
        }
      } else if (tenantMsg) {
        await Share.share({ message: tenantMsg });
      }
    }
    if (action?.kind === 'approve_utility_payment' && action.payload?.eventId) {
      const result = await approveUtilityPayment(action.payload.eventId);
      const ar = getLang() === 'ar';
      await onUtilityPaymentApproved(
        action.payload.utility || 'electricity',
        action.payload.billNumber || '—',
      );
      await pushLocalNotification({
        id: `loc_util_approved_${action.payload.eventId}`,
        title: ar ? 'كويل · تمت الموافقة على السداد' : 'Kowil · payment approved',
        body: ar
          ? (result?.approval?.kowil_note_ar
            || 'تم تجهيز السداد بعد إذنك — لم يُخصم أي مبلغ تلقائياً.')
          : (result?.approval?.kowil_note_en
            || 'Payment prepared after your permission — nothing was auto-charged.'),
        priority: 'high',
        route: '/wallet',
      });
      const payUrl = action.payload.paymentUrl || result?.approval?.payment_url;
      const summary = result?.approval?.prepared_messages?.payment_summary
        || result?.approval?.prepared_messages?.owner;
      if (payUrl) {
        await Linking.openURL(payUrl).catch(() => {
          if (summary) return Share.share({ message: summary });
        });
      } else if (summary) {
        await Share.share({ message: summary });
      }
    }
    await removePendingAction(id);
    await reload();
  }, [reload, state.pendingActions]);

  const dismissAction = useCallback(async (id: string) => {
    await removePendingAction(id);
    await reload();
  }, [reload]);

  const recentEvents = useMemo(() => state.events.slice(0, 8), [state.events]);
  const openTickets = useMemo(
    () => state.tickets.filter((t) => t.status !== 'closed'),
    [state.tickets],
  );

  return {
    ready,
    events: state.events,
    tickets: state.tickets,
    pendingActions: state.pendingActions,
    recentEvents,
    openTickets,
    openTicket,
    assignTechnician,
    acceptTicket,
    enRouteTicket,
    startTicket,
    uploadTicketMedia,
    completeTicket,
    tenantApprove,
    tenantReprocess,
    proposeCost,
    decideCost,
    assignTicket,
    updateTicketStatus,
    approveAction,
    dismissAction,
    ticketsForTechnician: (techId: string) => ticketsForTechnician(state.tickets, techId),
    ticketsForUnit: (unitId: string) => ticketsForUnit(state.tickets, unitId),
    reload,
  };
}
