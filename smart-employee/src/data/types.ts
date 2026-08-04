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
  | "إدارة العقارات"
  | "ربط إيجار";

export type EjarRenewalStatus =
  | "بانتظار_إشعار_المستأجر"
  | "تم_إشعار_المستأجر"
  | "وافق_المستأجر"
  | "رفض_المستأجر"
  | "بانتظار_موافقة_المالك"
  | "موافق_المالك"
  | "مرفوع_لإيجار"
  | "مكتمل_في_إيجار"
  | "فشل_الرفع";

export type AlertActionType =
  | "notify_tenant_renewal"
  | "owner_approve_ejar"
  | "submit_ejar"
  | "open_contract"
  | "open_tenant"
  | "open_platforms"
  | "owner_auth_decide"
  | "custom";

export type PlatformKind = "ejar" | "electricity" | "water" | "custom";

export type PlatformNoticeKind =
  | "bill"
  | "payment_due"
  | "renewal"
  | "outage"
  | "info"
  | "action_required";

export type PlatformNoticeStatus =
  | "جديد"
  | "أُشعر_المالك"
  | "أُشعر_المستأجرون"
  | "بانتظار_إذن_المالك"
  | "مأذون"
  | "مرفوض"
  | "منفّذ"
  | "متجاهل";

export type OwnerAuthActionType = "pay_bill" | "renew_service" | "submit_procedure" | "custom";

export type OwnerAuthStatus = "بانتظار" | "موافق" | "مرفوض" | "منتهي";

export interface PlatformLink {
  id: string;
  kind: PlatformKind;
  name: string;
  /** رابط البوابة للمستخدم */
  portalUrl: string;
  /** عنوان واجهة API أو وسيط الإشعارات */
  apiBaseUrl?: string;
  accountNo?: string;
  apiKeyMasked?: string;
  connected: boolean;
  receiveNotifications: boolean;
  /** السماح بطلب إجراء نيابة عن المالك بعد إذنه */
  actOnBehalfEnabled: boolean;
  lastSyncAt?: string;
  notes?: string;
  createdAt: string;
}

export interface PlatformNotice {
  id: string;
  platformId: string;
  platformName: string;
  kind: PlatformNoticeKind;
  title: string;
  body: string;
  amount?: number;
  dueDate?: string;
  accountRef?: string;
  receivedAt: string;
  suggestion: string;
  status: PlatformNoticeStatus;
  ownerAuthId?: string;
  relatedTenantIds?: string[];
  relatedPropertyId?: string;
  history: { at: string; note: string }[];
}

export interface OwnerAuthorization {
  id: string;
  noticeId: string;
  platformId: string;
  platformName: string;
  title: string;
  description: string;
  actionType: OwnerAuthActionType;
  amount?: number;
  status: OwnerAuthStatus;
  token: string;
  requestedAt: string;
  decidedAt?: string;
  executedAt?: string;
  history: { at: string; note: string }[];
}

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
  ejarUnitId?: string;
}

export interface Contract {
  id: string;
  no: string;
  unit: string;
  property: string;
  propertyId?: string;
  tenant: string;
  tenantId?: string;
  end: string;
  start?: string;
  type: ContractType;
  rent: number;
  ejarContractNo?: string;
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

export interface AlertAction {
  id: string;
  label: string;
  type: AlertActionType;
  payload?: Record<string, string>;
}

export interface Alert {
  id: string;
  title: string;
  desc: string;
  time: string;
  level: "danger" | "warn" | "info";
  suggestion?: string;
  actions?: AlertAction[];
  relatedContractId?: string;
  relatedTenantId?: string;
  resolved?: boolean;
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

export type EjarMode = "mock" | "live";

export interface EjarConnection {
  connected: boolean;
  facilityNo: string;
  apiKeyMasked: string;
  /** mock = محاكاة محلية | live = استدعاء HTTP لـ baseUrl */
  mode: EjarMode;
  /** عنوان واجهة إيجار أو بوابة وسيطة */
  baseUrl: string;
  /** بعد موافقة المالك ارفع تلقائياً لإيجار */
  autoSubmitOnApproval: boolean;
  lastSyncAt?: string;
  notes?: string;
}

export interface EjarRenewalCase {
  id: string;
  contractId: string;
  contractNo: string;
  tenantName: string;
  tenantPhone: string;
  propertyName: string;
  endDate: string;
  status: EjarRenewalStatus;
  /** رمز رد المستأجر عبر الرابط العام */
  replyToken?: string;
  notifiedAt?: string;
  tenantReplyAt?: string;
  ownerApprovedAt?: string;
  submittedAt?: string;
  ejarRef?: string;
  lastError?: string;
  history: { at: string; note: string }[];
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
  ejar: EjarConnection;
  ejarRenewals: EjarRenewalCase[];
  platformLinks: PlatformLink[];
  platformNotices: PlatformNotice[];
  ownerAuthorizations: OwnerAuthorization[];
}

export type ToastKind = "ok" | "warn" | "danger";

export interface Toast {
  id: string;
  msg: string;
  kind: ToastKind;
}

export interface TenantBlockInput {
  name: string;
  phone: string;
  unit: string;
  contractType: ContractType;
  start: string;
  end: string;
  rent: number;
  rentAmount: number;
  dueDate: string;
  rentStatus: RentPayment["status"];
  method?: string;
  email?: string;
  nationalId?: string;
  secondaryPhone?: string;
  notes?: string;
  deposit?: number;
}

export interface PropertyPackageInput {
  property: Omit<Property, "id" | "status"> & { status?: PropertyStatus };
  tenants: TenantBlockInput[];
}
