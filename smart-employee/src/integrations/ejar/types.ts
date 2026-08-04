/** عقود تكامل منصة إيجار — جاهزة للربط الرسمي */

export type EjarMode = "mock" | "live";

export interface EjarCredentials {
  facilityNo: string;
  apiKey: string;
  baseUrl: string;
  mode: EjarMode;
}

export interface EjarAuthResult {
  ok: boolean;
  token?: string;
  message: string;
}

export interface EjarNotificationDto {
  id: string;
  type: string;
  title: string;
  body: string;
  contractNo?: string;
  receivedAt: string;
}

export interface EjarRenewalSubmitRequest {
  facilityNo: string;
  contractNo: string;
  tenantName: string;
  tenantPhone: string;
  propertyName: string;
  endDate: string;
  ownerApprovedAt: string;
  tenantApprovedAt: string;
}

export interface EjarRenewalSubmitResult {
  ok: boolean;
  reference?: string;
  message: string;
  raw?: unknown;
}

export interface EjarGateway {
  authenticate(creds: EjarCredentials): Promise<EjarAuthResult>;
  fetchNotifications(creds: EjarCredentials): Promise<EjarNotificationDto[]>;
  submitRenewal(
    creds: EjarCredentials,
    payload: EjarRenewalSubmitRequest,
  ): Promise<EjarRenewalSubmitResult>;
}
