/** Smart Property Employee — proactive tasks (think → suggest → execute → follow up). */

export type EmployeeTaskKind =
  | 'collect_arrears'
  | 'renew_contract'
  | 'expired_contract'
  | 'fill_vacancy'
  | 'maintenance_follow'
  | 'send_portal_link'
  | 'share_portal'
  | 'data_gap'
  | 'daily_brief'
  | 'follow_up'
  | 'escalate_collection';

export type EmployeeTaskStatus =
  | 'suggested'
  | 'in_progress'
  | 'done'
  | 'dismissed'
  | 'waiting_followup';

export type EmployeeTaskAction =
  | 'send_whatsapp'
  | 'open_database'
  | 'open_maintenance'
  | 'open_contracts'
  | 'open_portals'
  | 'mark_done'
  | 'snooze';

/** Soft on-device adaptation from owner actions (not ML). */
export type EmployeePrefs = {
  dismissCountByKind: Record<string, number>;
  lastDismissedAtByKind: Record<string, string>;
  /** Suppress low-urgency kinds until this ISO (per kind). */
  quietUntilByKind: Record<string, string>;
  /** Times owner executed WhatsApp successfully. */
  whatsappWins: number;
  /** Times owner opened routes instead. */
  routeWins: number;
};

export type EmployeeTask = {
  id: string;
  kind: EmployeeTaskKind;
  status: EmployeeTaskStatus;
  /** Priority 1 = highest */
  priority: 1 | 2 | 3;
  /** Higher = more urgent within same priority */
  score?: number;
  titleAr: string;
  titleEn: string;
  reasonAr: string;
  reasonEn: string;
  /** What the employee will do when executed */
  action: EmployeeTaskAction;
  actionLabelAr: string;
  actionLabelEn: string;
  /** Optional WhatsApp payload */
  whatsappPhone?: string;
  whatsappMessage?: string;
  route?: string;
  tenantId?: string;
  unitId?: string;
  unitNumber?: string;
  amount?: number;
  createdAt: string;
  updatedAt: string;
  dueAt?: string;
  executedAt?: string;
  followUpAt?: string;
  followUpNoteAr?: string;
  followUpNoteEn?: string;
  /** How many times this work item was executed / followed */
  attemptCount?: number;
  source?: 'local' | 'enriched';
  /** Official platform integrations — owner must approve before Kowil auto-sends */
  platformSource?: 'ejar' | 'electricity' | 'water' | 'messaging' | 'intelligence';
  platformEventId?: string;
  requiresOwnerApproval?: boolean;
  routeTo?: 'tenant' | 'agent' | 'tech' | 'guard' | 'owner';
};

export type EmployeeActivity = {
  id: string;
  at: string;
  textAr: string;
  textEn: string;
  taskId?: string;
};

export type SmartEmployeeState = {
  tasks: EmployeeTask[];
  activity: EmployeeActivity[];
  prefs?: EmployeePrefs;
  lastThoughtAt?: string;
  lastThoughtAr?: string;
  lastThoughtEn?: string;
  /** local | hybrid when external enrich is configured */
  mode?: 'local' | 'hybrid';
};

export const EMPTY_EMPLOYEE_PREFS: EmployeePrefs = {
  dismissCountByKind: {},
  lastDismissedAtByKind: {},
  quietUntilByKind: {},
  whatsappWins: 0,
  routeWins: 0,
};
