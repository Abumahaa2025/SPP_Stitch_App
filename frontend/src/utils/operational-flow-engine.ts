/**
 * Operational flow engine — links daily actions across owner, tenant, technician, employee.
 * Additive layer on Property OS — does not mutate property-os types.
 */
import type { PaymentRecord, PropertyOSState, TenantRecord } from '@/src/types/property-os';
import type { MaintenanceTicket } from '@/src/types/operational';
import {
  addPendingAction, appendEvent, uid, upsertTicket,
} from '@/src/utils/operational-store';

export function inAppTenantRoute(tenantId: string, token: string) {
  return `/portal/tenant?id=${tenantId}&t=${token}`;
}

export function inAppTechRoute(token: string) {
  return `/portal/tech?t=${token}`;
}

export async function onTenantAdded(tenant: TenantRecord, unitNumber?: string) {
  await appendEvent({
    kind: 'tenant_added',
    actor: 'owner',
    summaryKey: 'op.event.tenantAdded',
    summaryParams: { name: tenant.name, unit: unitNumber ?? '—' },
    relatedTenantId: tenant.id,
    relatedUnitId: tenant.unitId,
  });
  await addPendingAction({
    kind: 'approve_whatsapp',
    labelKey: 'op.pending.whatsappWelcome',
    labelParams: { name: tenant.name },
    payload: {
      tenantId: tenant.id,
      phone: tenant.phone,
      message: tenant.whatsAppMessage,
      inAppRoute: inAppTenantRoute(tenant.id, tenant.portalToken),
    },
  });
}

export async function onSetupCompleted() {
  await appendEvent({
    kind: 'setup_completed',
    actor: 'system',
    summaryKey: 'op.event.setupCompleted',
  });
}

export async function onPaymentRecorded(
  state: PropertyOSState,
  payment: PaymentRecord,
) {
  const tenant = state.tenants.find((t) => t.id === payment.tenantId);
  const unit = state.units.find((u) => u.id === payment.unitId);
  await appendEvent({
    kind: 'payment_recorded',
    actor: 'owner',
    summaryKey: 'op.event.paymentRecorded',
    summaryParams: {
      name: tenant?.name ?? '—',
      unit: unit?.number ?? '—',
      amount: String(payment.amount),
    },
    relatedUnitId: payment.unitId,
    relatedTenantId: payment.tenantId,
  });
  await addPendingAction({
    kind: 'approve_owner_alert',
    labelKey: 'op.pending.paymentReport',
    labelParams: { unit: unit?.number ?? '—' },
    payload: {
      unitId: payment.unitId,
      tenantId: payment.tenantId,
      amount: String(payment.amount),
    },
  });
}

export async function onContractEnded(
  state: PropertyOSState,
  tenant: TenantRecord,
  unitNumber?: string,
) {
  await appendEvent({
    kind: 'contract_ended',
    actor: 'owner',
    summaryKey: 'op.event.contractEnded',
    summaryParams: { name: tenant.name, unit: unitNumber ?? '—' },
    relatedTenantId: tenant.id,
    relatedUnitId: tenant.unitId,
  });
  await addPendingAction({
    kind: 'approve_renewal',
    labelKey: 'op.pending.renewalSuggest',
    labelParams: { unit: unitNumber ?? '—' },
    payload: { tenantId: tenant.id, unitId: tenant.unitId },
  });
  await addPendingAction({
    kind: 'approve_whatsapp',
    labelKey: 'op.pending.contractEndTenant',
    labelParams: { name: tenant.name },
    payload: {
      tenantId: tenant.id,
      phone: tenant.phone,
      message: tenant.whatsAppMessage,
    },
  });
}

export async function onMaintenanceOpened(
  ticket: MaintenanceTicket,
  unitNumber?: string,
) {
  await appendEvent({
    kind: 'maintenance_opened',
    actor: 'tenant',
    summaryKey: 'op.event.maintenanceOpened',
    summaryParams: { title: ticket.title, unit: unitNumber ?? '—' },
    relatedTicketId: ticket.id,
    relatedUnitId: ticket.unitId,
    relatedTenantId: ticket.tenantId,
  });
  await addPendingAction({
    kind: 'approve_technician',
    labelKey: 'op.pending.assignTechnician',
    labelParams: { unit: unitNumber ?? '—' },
    payload: { ticketId: ticket.id, unitId: ticket.unitId },
  });
}

export async function onMaintenanceAssigned(ticket: MaintenanceTicket, techName: string) {
  await appendEvent({
    kind: 'maintenance_assigned',
    actor: 'employee',
    summaryKey: 'op.event.maintenanceAssigned',
    summaryParams: { tech: techName, title: ticket.title },
    relatedTicketId: ticket.id,
    relatedUnitId: ticket.unitId,
  });
}

export async function onMaintenanceClosed(ticket: MaintenanceTicket, unitNumber?: string) {
  await appendEvent({
    kind: 'maintenance_closed',
    actor: 'technician',
    summaryKey: 'op.event.maintenanceClosed',
    summaryParams: { title: ticket.title, unit: unitNumber ?? '—' },
    relatedTicketId: ticket.id,
    relatedUnitId: ticket.unitId,
  });
}

export async function createMaintenanceTicket(
  unitId: string,
  title: string,
  tenantId?: string,
  description?: string,
  extras?: {
    category?: MaintenanceTicket['category'];
    priority?: MaintenanceTicket['priority'];
    technicianName?: string;
    media?: MaintenanceTicket['media'];
  },
): Promise<MaintenanceTicket> {
  const now = new Date().toISOString();
  const ticket: MaintenanceTicket = {
    id: uid('ticket'),
    unitId,
    tenantId,
    title,
    description,
    category: extras?.category,
    priority: extras?.priority ?? 'medium',
    status: extras?.technicianName ? 'assigned' : 'open',
    technicianName: extras?.technicianName,
    media: extras?.media ?? [],
    workflowStep: extras?.technicianName ? 'tracking' : 'submit',
    createdAt: now,
    updatedAt: now,
    notes: [],
  };
  await upsertTicket(ticket);
  return ticket;
}

export async function onNotificationPrepared(summaryKey: string, params?: Record<string, string>) {
  await appendEvent({
    kind: 'notification_prepared',
    actor: 'employee',
    summaryKey,
    summaryParams: params,
  });
}

export async function onRenewalSuggested(unitNumber: string, tenantName: string) {
  await appendEvent({
    kind: 'renewal_suggested',
    actor: 'employee',
    summaryKey: 'op.event.renewalSuggested',
    summaryParams: { unit: unitNumber, name: tenantName },
  });
}
