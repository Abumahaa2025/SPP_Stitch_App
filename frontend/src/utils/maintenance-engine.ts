import type {
  MaintenanceTicket,
  TimelineEvent,
  TimelineEventKind,
  TenantNotification,
} from '@/src/types/operational';
import { uid } from '@/src/utils/operational-store';

export const TIMELINE_ORDER: TimelineEventKind[] = [
  'created',
  'technician_assigned',
  'tech_accepted',
  'en_route',
  'started',
  'photos_uploaded',
  'completed',
  'tenant_approved',
];

const PROGRESS_MAP: Record<TimelineEventKind, number> = {
  created: 10,
  technician_assigned: 25,
  tech_accepted: 40,
  en_route: 55,
  started: 65,
  photos_uploaded: 80,
  completed: 90,
  tenant_approved: 100,
};

const TIMELINE_LABELS: Record<TimelineEventKind, string> = {
  created: 'maint.timeline.created',
  technician_assigned: 'maint.timeline.assigned',
  tech_accepted: 'maint.timeline.accepted',
  en_route: 'maint.timeline.enRoute',
  started: 'maint.timeline.started',
  photos_uploaded: 'maint.timeline.photos',
  completed: 'maint.timeline.completed',
  tenant_approved: 'maint.timeline.tenantApproved',
};

export function defaultTimeline(): TimelineEvent[] {
  return TIMELINE_ORDER.map((kind) => ({
    id: kind,
    kind,
    done: kind === 'created',
    at: kind === 'created' ? new Date().toISOString() : undefined,
  }));
}

export function ensureTimeline(ticket: MaintenanceTicket): TimelineEvent[] {
  if (ticket.timeline?.length) return ticket.timeline;
  return defaultTimeline();
}

export function timelineLabelKey(kind: TimelineEventKind) {
  return TIMELINE_LABELS[kind];
}

export function calcProgress(timeline: TimelineEvent[]): number {
  const done = timeline.filter((e) => e.done);
  if (!done.length) return 10;
  const last = done[done.length - 1];
  return PROGRESS_MAP[last.kind] ?? 10;
}

export function markTimeline(
  timeline: TimelineEvent[],
  kind: TimelineEventKind,
): TimelineEvent[] {
  const now = new Date().toISOString();
  return timeline.map((e) => (
    e.kind === kind ? { ...e, done: true, at: now } : e
  ));
}

export function pushTenantNotification(
  ticket: MaintenanceTicket,
  messageKey: string,
  messageParams?: Record<string, string>,
): TenantNotification[] {
  const list = ticket.tenantNotifications ?? [];
  return [{
    at: new Date().toISOString(),
    messageKey,
    messageParams,
    read: false,
  }, ...list].slice(0, 20);
}

export function defaultEtaMinutes() {
  return 25;
}

export function etaArrivalFromNow(minutes: number) {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

/** SPP maintenance intelligence — pattern-based recommendation. */
export function generateMaintenanceInsight(
  ticket: MaintenanceTicket,
  unitTickets: MaintenanceTicket[],
): string {
  const category = ticket.category ?? 'general';
  const recent = unitTickets.filter((t) => t.unitId === ticket.unitId && t.id !== ticket.id);
  const sameCategory = recent.filter((t) => t.category === category);
  const count = sameCategory.length + 1;

  if (category === 'plumbing' && count >= 3) {
    return 'maint.insight.plumbingRepeat';
  }
  if (category === 'ac' && count >= 2) {
    return 'maint.insight.acRepeat';
  }
  if (category === 'electrical' && count >= 2) {
    return 'maint.insight.electricalRepeat';
  }
  if (count >= 4) {
    return 'maint.insight.generalRepeat';
  }
  return 'maint.insight.ok';
}

export function newTimelineId() {
  return uid('tl');
}
