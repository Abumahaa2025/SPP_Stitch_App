/** Technician registry — separate from property-os.ts */

import type { MaintenanceCategory } from '@/src/types/operational';

export type TechnicianSpecialty = MaintenanceCategory | 'general';

export type TechnicianRecord = {
  id: string;
  name: string;
  phone: string;
  specialty: TechnicianSpecialty;
  portalToken: string;
  portalUrl: string;
  qrData: string;
  createdAt: string;
  linkActive: boolean;
  avgRating?: number;
  completedJobs?: number;
  lastLoginAt?: string;
};
