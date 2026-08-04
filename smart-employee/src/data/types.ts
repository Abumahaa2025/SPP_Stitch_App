export type PropertyStatus = "شاغرة" | "مؤجرة" | "تحت الصيانة";
export type PropertyType = "سكني" | "تجاري";
export type ContractType = "إيجار سكني" | "إيجار تجاري" | "عقد صيانة";
export type SensorStatus = "يعمل" | "تنبيه" | "متوقف";
export type MaintStatus = "جديد" | "قيد التنفيذ" | "مكتمل";
export type PermissionKey =
  | "إدارة العقود"
  | "تحصيل الإيجارات"
  | "إدارة الصيانة"
  | "خدمات الكهرباء"
  | "خدمات المياه"
  | "إدارة العقارات";

export interface Property {
  id: string;
  name: string;
  location: string;
  city: string;
  type: PropertyType;
  status: PropertyStatus;
  price: number;
  area: number;
  rooms: number;
  baths?: number;
  notes?: string;
}

export interface Contract {
  id: string;
  no: string;
  unit: string;
  property: string;
  propertyId?: string;
  tenant: string;
  end: string;
  start?: string;
  type: ContractType;
  rent: number;
}

export interface RentPayment {
  id: string;
  contractNo: string;
  tenant: string;
  property: string;
  amount: number;
  dueDate: string;
  paidDate?: string;
  status: "مدفوع" | "متأخر" | "قادم";
  method?: string;
}

export interface Sensor {
  id: string;
  unit: string;
  city: string;
  type: string;
  reading: string;
  status: SensorStatus;
}

export interface Alert {
  id: string;
  title: string;
  desc: string;
  time: string;
  level: "danger" | "warn" | "info";
}

export interface Technician {
  id: string;
  name: string;
  phone: string;
  specialty: string;
  rating: number;
}

export interface MaintenanceRequest {
  id: string;
  no: string;
  desc: string;
  type: string;
  status: MaintStatus;
  tech: string;
  property: string;
}

export interface Tenant {
  id: string;
  name: string;
  unit: string;
  contractNo: string;
  rent: number;
  phone: string;
  status: "نشط" | "متأخر" | "منتهي";
  /** اختياري */
  email?: string;
  nationalId?: string;
  secondaryPhone?: string;
  notes?: string;
  deposit?: number;
}

export interface Agent {
  id: string;
  name: string;
  phone: string;
  role: string;
  status: "نشط" | "بانتظار الموافقة";
  permissions: PermissionKey[];
  accessLink: string;
}

export interface OwnerProfile {
  name: string;
  phone: string;
  email: string;
  company?: string;
  city: string;
}

export interface AppUser {
  name: string;
  role: string;
  initials: string;
}

export interface AppState {
  loggedIn: boolean;
  user: AppUser;
  owner: OwnerProfile;
  agents: Agent[];
  properties: Property[];
  contracts: Contract[];
  rents: RentPayment[];
  sensors: Sensor[];
  alerts: Alert[];
  technicians: Technician[];
  maintenance: MaintenanceRequest[];
  tenants: Tenant[];
}

export type ToastKind = "ok" | "warn" | "danger";

export interface Toast {
  id: string;
  msg: string;
  kind: ToastKind;
}

export interface PropertyPackageInput {
  property: Omit<Property, "id" | "status"> & { status?: PropertyStatus };
  contract?: {
    unit: string;
    tenantName: string;
    type: ContractType;
    start: string;
    end: string;
    rent: number;
  };
  tenant?: {
    name: string;
    phone: string;
    email?: string;
    nationalId?: string;
    secondaryPhone?: string;
    notes?: string;
    deposit?: number;
  };
  rent?: {
    amount: number;
    dueDate: string;
    status: RentPayment["status"];
    method?: string;
  };
}
