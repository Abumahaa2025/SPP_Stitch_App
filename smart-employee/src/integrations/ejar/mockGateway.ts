import type {
  EjarAuthResult,
  EjarCredentials,
  EjarGateway,
  EjarNotificationDto,
  EjarRenewalSubmitRequest,
  EjarRenewalSubmitResult,
} from "./types";

/** بوابة محاكاة — تعمل بدون اعتمادات رسمية */
export class MockEjarGateway implements EjarGateway {
  async authenticate(creds: EjarCredentials): Promise<EjarAuthResult> {
    if (!creds.facilityNo.trim() || !creds.apiKey.trim()) {
      return { ok: false, message: "رقم المنشأة ومفتاح الربط مطلوبان" };
    }
    await delay(350);
    return {
      ok: true,
      token: `mock-token-${creds.facilityNo}`,
      message: "تم التحقق (وضع المحاكاة)",
    };
  }

  async fetchNotifications(creds: EjarCredentials): Promise<EjarNotificationDto[]> {
    await delay(300);
    if (!creds.facilityNo) return [];
    return [
      {
        id: `n-${Date.now()}`,
        type: "contract_expiry",
        title: "تنبيه من إيجار",
        body: "يوجد عقود قاربت على الانتهاء — راجع مسار التجديد في التطبيق.",
        receivedAt: new Date().toISOString(),
      },
    ];
  }

  async submitRenewal(
    _creds: EjarCredentials,
    payload: EjarRenewalSubmitRequest,
  ): Promise<EjarRenewalSubmitResult> {
    await delay(500);
    const reference = `EJAR-MOCK-${Date.now().toString().slice(-8)}`;
    return {
      ok: true,
      reference,
      message: `تم استلام طلب تجديد ${payload.contractNo} (محاكاة)`,
      raw: { mode: "mock", payload },
    };
  }
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
