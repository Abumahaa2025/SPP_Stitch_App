/** Smart Property Employee — proactive tasks (think → suggest → execute → follow up). */

export type EmployeeTaskKind =
  | 'collect_arrears'
  | 'renew_contract'
  | 'fill_vacancy'
  | 'maintenance_follow'
  | 'send_portal_link'
  | 'daily_brief'
  | 'follow_up';

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

export type EmployeeTask = {
  id: string;
  kind: EmployeeTaskKind;
  status: EmployeeTaskStatus;
  /** Priority 1 = highest */
  priority: 1 | 2 | 3;
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
  lastThoughtAt?: string;
  lastThoughtAr?: string;
  lastThoughtEn?: string;
};
