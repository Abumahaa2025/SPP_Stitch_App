/** Operational layer — events, tickets, pending approvals (additive on Property OS). */



export type OperationalActor = 'owner' | 'tenant' | 'technician' | 'employee' | 'system';



export type OperationalEventKind =

  | 'tenant_added'

  | 'contract_ended'

  | 'payment_recorded'

  | 'maintenance_opened'

  | 'maintenance_assigned'

  | 'maintenance_closed'

  | 'notification_prepared'

  | 'renewal_suggested'

  | 'setup_completed';



export type OperationalEvent = {

  id: string;

  kind: OperationalEventKind;

  at: string;

  actor: OperationalActor;

  summaryKey: string;

  summaryParams?: Record<string, string>;

  relatedUnitId?: string;

  relatedTenantId?: string;

  relatedTicketId?: string;

};



export type MaintenanceTicketStatus =
  | 'open'
  | 'assigned'
  | 'accepted'
  | 'en_route'
  | 'in_progress'
  | 'awaiting_tenant'
  | 'closed'
  | 'reprocess';

export type TimelineEventKind =
  | 'created'
  | 'technician_assigned'
  | 'tech_accepted'
  | 'en_route'
  | 'started'
  | 'photos_uploaded'
  | 'completed'
  | 'tenant_approved';

export type TimelineEvent = {
  id: string;
  kind: TimelineEventKind;
  at?: string;
  done: boolean;
};

export type TenantNotification = {
  at: string;
  messageKey: string;
  messageParams?: Record<string, string>;
  read?: boolean;
};

export type TenantApprovalStatus = 'pending' | 'approved' | 'reprocess';

export type CostEvaluationStatus = 'none' | 'proposed' | 'approved' | 'rejected';

export type MaintenanceCategory = 'plumbing' | 'electrical' | 'ac' | 'general' | 'other';

export type MaintenancePriority = 'low' | 'medium' | 'high' | 'urgent';

export type MediaAttachment = {
  uri: string;
  type: 'photo' | 'video' | 'file';
  name: string;
  addedAt: string;
  phase?: 'before' | 'after' | 'general';
};

export type MaintenanceWorkflowStep =
  | 'create'
  | 'type'
  | 'description'
  | 'photos'
  | 'video'
  | 'priority'
  | 'technician'
  | 'submit'
  | 'tracking'
  | 'close'
  | 'rating';

export type MaintenanceTicket = {
  id: string;
  unitId: string;
  tenantId?: string;
  title: string;
  description?: string;
  category?: MaintenanceCategory;
  priority?: MaintenancePriority;
  status: MaintenanceTicketStatus;
  workflowStep?: MaintenanceWorkflowStep;
  technicianId?: string;
  technicianName?: string;
  media?: MediaAttachment[];
  beforeMedia?: MediaAttachment[];
  afterMedia?: MediaAttachment[];
  timeline?: TimelineEvent[];
  progressPercent?: number;
  etaMinutes?: number;
  etaArrivalAt?: string;
  tenantNotifications?: TenantNotification[];
  tenantApproval?: TenantApprovalStatus;
  tenantComment?: string;
  rating?: number;
  sppInsight?: string;
  /** Stitch: تقييم التكلفة المالية */
  estimatedCost?: number;
  costCurrency?: string;
  costNote?: string;
  costStatus?: CostEvaluationStatus;
  costDecidedAt?: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  notes: string[];
};



export type PendingActionKind =

  | 'approve_whatsapp'

  | 'approve_renewal'

  | 'approve_technician'

  | 'approve_owner_alert';



export type PendingAction = {

  id: string;

  kind: PendingActionKind;

  labelKey: string;

  labelParams?: Record<string, string>;

  createdAt: string;

  payload?: Record<string, string>;

};


