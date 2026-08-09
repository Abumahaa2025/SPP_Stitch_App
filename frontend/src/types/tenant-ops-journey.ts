/** Tenant operations journeys — payment / maintenance paths with step blink + reports. */

export type TenantOpsKind = 'payment' | 'maintenance' | 'move' | 'vacate' | 'entry' | 'other';

export type TenantOpsStepStatus = 'pending' | 'active' | 'done';

export type TenantOpsStep = {
  id: string;
  /** Stable machine key */
  key: string;
  labelAr: string;
  labelEn: string;
  status: TenantOpsStepStatus;
  at?: string;
  detailAr?: string;
  detailEn?: string;
};

export type TenantOpsJourney = {
  id: string;
  kind: TenantOpsKind;
  tenantId: string;
  tenantName: string;
  unitId?: string;
  unitNumber?: string;
  propertyName?: string;
  titleAr: string;
  titleEn: string;
  steps: TenantOpsStep[];
  /** linked portal payment / maintenance ticket */
  paymentId?: string;
  ticketId?: string;
  monthKey?: string;
  amount?: number;
  techName?: string;
  status: 'open' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  /** free-form cost report summary when maintenance completes */
  costReport?: {
    labor?: number;
    parts?: number;
    total?: number;
    noteAr?: string;
    noteEn?: string;
  };
};

export type TenantOpsReport = {
  id: string;
  journeyId: string;
  kind: TenantOpsKind;
  tenantId: string;
  tenantName: string;
  unitNumber?: string;
  summaryAr: string;
  summaryEn: string;
  monthKey?: string;
  amount?: number;
  techName?: string;
  costTotal?: number;
  createdAt: string;
  /** mirrored into tenant notes line */
  noteLineAr: string;
  noteLineEn: string;
};

export type TenantOpsState = {
  journeys: TenantOpsJourney[];
  reports: TenantOpsReport[];
};

export function paymentStepDefs(arMonth: string, enMonth: string, unit: string) {
  return [
    {
      key: 'notice_sent',
      labelAr: 'تم إرسال إشعار السداد',
      labelEn: 'Payment notice sent',
    },
    {
      key: 'owner_received',
      labelAr: 'استلم المالك الإشعار',
      labelEn: 'Owner received the notice',
    },
    {
      key: 'owner_approved',
      labelAr: 'وافق المالك على الاستلام',
      labelEn: 'Owner approved receipt',
    },
    {
      key: 'paid',
      labelAr: `تم سداد إيجار ${arMonth} — شقة ${unit}`,
      labelEn: `Rent paid for ${enMonth} — unit ${unit}`,
    },
  ] as const;
}

export function maintenanceStepDefs(techFallbackAr = 'الفني', techFallbackEn = 'Technician') {
  return [
    {
      key: 'request_sent',
      labelAr: 'تم إرسال طلب الصيانة',
      labelEn: 'Maintenance request sent',
    },
    {
      key: 'owner_approved',
      labelAr: 'وافق المالك على الطلب',
      labelEn: 'Owner approved the request',
    },
    {
      key: 'tech_received',
      labelAr: `استلم ${techFallbackAr} المهمة`,
      labelEn: `${techFallbackEn} received the task`,
    },
    {
      key: 'in_progress',
      labelAr: 'جاري تنفيذ المهمة',
      labelEn: 'Task in progress',
    },
    {
      key: 'completed',
      labelAr: 'تم اكتمال المهمة',
      labelEn: 'Task completed',
    },
    {
      key: 'cost_report',
      labelAr: 'تقرير التكاليف',
      labelEn: 'Cost report',
    },
  ] as const;
}
