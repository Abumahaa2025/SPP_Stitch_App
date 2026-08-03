export type PropertyStatus = "شاغرة" | "مؤجرة" | "تحت الصيانة";
export type PropertyType = "سكني" | "تجاري";
export type ContractType = "إيجار سكني" | "إيجار تجاري" | "عقد صيانة";
export type SensorStatus = "يعمل" | "تنبيه" | "متوقف";
export type MaintStatus = "جديد" | "قيد التنفيذ" | "مكتمل";

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
}

export interface Contract {
  id: string;
  no: string;
  unit: string;
  property: string;
  tenant: string;
  end: string;
  type: ContractType;
  rent: number;
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
}

export interface AppUser {
  name: string;
  role: string;
  initials: string;
}

export interface AppState {
  loggedIn: boolean;
  user: AppUser;
  properties: Property[];
  contracts: Contract[];
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
