/**
 * Maintenance workflow transitions — owner → tech → tenant → owner cycle.
 */
import type { MaintenanceTicket, MediaAttachment } from '@/src/types/operational';
import type { TechnicianRecord } from '@/src/types/technician';
import { upsertTicket, appendEvent, addPendingAction, uid } from '@/src/utils/operational-store';
import {
  defaultTimeline,
  markTimeline,
  calcProgress,
  pushTenantNotification,
  defaultEtaMinutes,
  etaArrivalFromNow,
  generateMaintenanceInsight,
  ensureTimeline,
} from '@/src/utils/maintenance-engine';

function now() {
  return new Date().toISOString();
}

function patch(ticket: MaintenanceTicket, patch: Partial<MaintenanceTicket>): MaintenanceTicket {
  const timeline = ensureTimeline({ ...ticket, ...patch });
  const progressPercent = calcProgress(timeline);
  return {
    ...ticket,
    ...patch,
    timeline,
    progressPercent,
    updatedAt: now(),
  };
}

export async function createOwnerTicket(
  unitId: string,
  title: string,
  tenantId: string | undefined,
  description: string | undefined,
  extras: {
    category?: MaintenanceTicket['category'];
    priority?: MaintenanceTicket['priority'];
    media?: MediaAttachment[];
    technicianId?: string;
    technicianName?: string;
  },
  unitNumber?: string,
): Promise<MaintenanceTicket> {
  const created = now();
  let timeline = defaultTimeline();
  timeline = markTimeline(timeline, 'created');
  let status: MaintenanceTicket['status'] = 'open';
  if (extras.technicianId) {
    timeline = markTimeline(timeline, 'technician_assigned');
    status = 'assigned';
  }
  const ticket: MaintenanceTicket = {
    id: uid('ticket'),
    unitId,
    tenantId,
    title,
    description,
    category: extras.category,
    priority: extras.priority ?? 'medium',
    status,
    technicianId: extras.technicianId,
    technicianName: extras.technicianName,
    media: extras.media ?? [],
    beforeMedia: [],
    afterMedia: [],
    timeline,
    progressPercent: calcProgress(timeline),
    tenantNotifications: [],
    tenantApproval: 'pending',
    workflowStep: 'tracking',
    createdAt: created,
    updatedAt: created,
    notes: [],
  };
  await upsertTicket(ticket);
  await appendEvent({
    kind: 'maintenance_opened',
    actor: 'owner',
    summaryKey: 'op.event.maintenanceOpened',
    summaryParams: { title, unit: unitNumber ?? '—' },
    relatedTicketId: ticket.id,
    relatedUnitId: unitId,
    relatedTenantId: tenantId,
  });
  if (extras.technicianId) {
    await appendEvent({
      kind: 'maintenance_assigned',
      actor: 'owner',
      summaryKey: 'op.event.maintenanceAssigned',
      summaryParams: { tech: extras.technicianName ?? '—', title },
      relatedTicketId: ticket.id,
      relatedUnitId: unitId,
    });
    await addPendingAction({
      kind: 'approve_technician',
      labelKey: 'maint.notify.tech',
      labelParams: { name: extras.technicianName ?? '—' },
      payload: { ticketId: ticket.id, techId: extras.technicianId },
    });
  }
  return ticket;
}

export async function assignTechnicianToTicket(
  ticket: MaintenanceTicket,
  tech: TechnicianRecord,
  unitNumber?: string,
): Promise<MaintenanceTicket> {
  let timeline = markTimeline(ensureTimeline(ticket), 'technician_assigned');
  const next = patch(ticket, {
    status: 'assigned',
    technicianId: tech.id,
    technicianName: tech.name,
    timeline,
  });
  await upsertTicket(next);
  await appendEvent({
    kind: 'maintenance_assigned',
    actor: 'owner',
    summaryKey: 'op.event.maintenanceAssigned',
    summaryParams: { tech: tech.name, title: ticket.title },
    relatedTicketId: ticket.id,
    relatedUnitId: ticket.unitId,
  });
  return next;
}

export async function techAcceptTicket(ticket: MaintenanceTicket): Promise<MaintenanceTicket> {
  const eta = defaultEtaMinutes();
  let timeline = markTimeline(ensureTimeline(ticket), 'tech_accepted');
  const notifs = pushTenantNotification(ticket, 'maint.notify.tenant.enRoute', {
    tech: ticket.technicianName ?? '—',
  });
  const next = patch(ticket, {
    status: 'accepted',
    etaMinutes: eta,
    etaArrivalAt: etaArrivalFromNow(eta),
    tenantNotifications: notifs,
    timeline,
  });
  await upsertTicket(next);
  return next;
}

export async function techEnRoute(ticket: MaintenanceTicket): Promise<MaintenanceTicket> {
  let timeline = markTimeline(ensureTimeline(ticket), 'en_route');
  const notifs = pushTenantNotification(ticket, 'maint.notify.tenant.enRoute', {
    tech: ticket.technicianName ?? '—',
  });
  const next = patch(ticket, {
    status: 'en_route',
    tenantNotifications: notifs,
    timeline,
  });
  await upsertTicket(next);
  return next;
}

export async function techStartTicket(ticket: MaintenanceTicket): Promise<MaintenanceTicket> {
  let timeline = markTimeline(ensureTimeline(ticket), 'started');
  const notifs = pushTenantNotification(ticket, 'maint.notify.tenant.started', {});
  const next = patch(ticket, {
    status: 'in_progress',
    tenantNotifications: notifs,
    timeline,
  });
  await upsertTicket(next);
  return next;
}

export async function techUploadMedia(
  ticket: MaintenanceTicket,
  media: MediaAttachment[],
  phase: 'before' | 'after' | 'general',
): Promise<MaintenanceTicket> {
  const before = phase === 'before'
    ? [...(ticket.beforeMedia ?? []), ...media]
    : ticket.beforeMedia;
  const after = phase === 'after'
    ? [...(ticket.afterMedia ?? []), ...media]
    : ticket.afterMedia;
  const allMedia = [...(ticket.media ?? []), ...media];
  let timeline = ensureTimeline(ticket);
  if (phase === 'after' || allMedia.length > 0) {
    timeline = markTimeline(timeline, 'photos_uploaded');
  }
  const next = patch(ticket, {
    beforeMedia: before,
    afterMedia: after,
    media: allMedia,
    timeline,
  });
  await upsertTicket(next);
  return next;
}

export async function techCompleteTicket(
  ticket: MaintenanceTicket,
  allTickets: MaintenanceTicket[],
  note?: string,
): Promise<MaintenanceTicket> {
  let timeline = markTimeline(ensureTimeline(ticket), 'completed');
  const insight = generateMaintenanceInsight(ticket, allTickets);
  const notifs = pushTenantNotification(ticket, 'maint.notify.tenant.completed', {});
  const notes = note ? [...ticket.notes, note] : ticket.notes;
  const next = patch(ticket, {
    status: 'awaiting_tenant',
    tenantApproval: 'pending',
    tenantNotifications: notifs,
    sppInsight: insight,
    notes,
    timeline,
    workflowStep: 'rating',
  });
  await upsertTicket(next);
  await appendEvent({
    kind: 'maintenance_closed',
    actor: 'technician',
    summaryKey: 'op.event.maintenanceClosed',
    summaryParams: { title: ticket.title, unit: '—' },
    relatedTicketId: ticket.id,
    relatedUnitId: ticket.unitId,
  });
  return next;
}

export async function tenantApproveTicket(
  ticket: MaintenanceTicket,
  rating: number,
  comment?: string,
): Promise<MaintenanceTicket> {
  let timeline = markTimeline(ensureTimeline(ticket), 'tenant_approved');
  const next = patch(ticket, {
    status: 'closed',
    tenantApproval: 'approved',
    rating,
    tenantComment: comment,
    closedAt: now(),
    timeline,
    workflowStep: 'close',
  });
  await upsertTicket(next);
  return next;
}

export async function tenantRequestReprocess(
  ticket: MaintenanceTicket,
  comment?: string,
): Promise<MaintenanceTicket> {
  const next = patch(ticket, {
    status: 'reprocess',
    tenantApproval: 'reprocess',
    tenantComment: comment,
    workflowStep: 'tracking',
  });
  await upsertTicket(next);
  await addPendingAction({
    kind: 'approve_owner_alert',
    labelKey: 'maint.reprocess',
    labelParams: { title: ticket.title },
    payload: { ticketId: ticket.id },
  });
  return next;
}

/** Stitch flow: technician/owner proposes a repair cost for owner approval. */
export async function proposeTicketCost(
  ticket: MaintenanceTicket,
  amount: number,
  note?: string,
  currency = 'SAR',
): Promise<MaintenanceTicket> {
  const next = patch(ticket, {
    estimatedCost: amount,
    costCurrency: currency,
    costNote: note,
    costStatus: 'proposed',
  });
  await upsertTicket(next);
  await addPendingAction({
    kind: 'approve_owner_alert',
    labelKey: 'maint.cost.pending',
    labelParams: { title: ticket.title, amount: String(amount) },
    payload: { ticketId: ticket.id, kind: 'cost' },
  });
  return next;
}

export async function decideTicketCost(
  ticket: MaintenanceTicket,
  decision: 'approved' | 'rejected',
): Promise<MaintenanceTicket> {
  const next = patch(ticket, {
    costStatus: decision,
    costDecidedAt: now(),
  });
  await upsertTicket(next);
  return next;
}

export function ticketsForTechnician(tickets: MaintenanceTicket[], techId: string) {
  return tickets.filter((t) => t.technicianId === techId);
}

export function ticketsForUnit(tickets: MaintenanceTicket[], unitId: string) {
  return tickets.filter((t) => t.unitId === unitId);
}
