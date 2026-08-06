import type {
  EjarAuthResult,
  EjarCredentials,
  EjarGateway,
  EjarNotificationDto,
  EjarRenewalSubmitRequest,
  EjarRenewalSubmitResult,
} from "./types";

/**
 * بوابة HTTP حية — تستدعي endpoints قابلة للتهيئة.
 * عند توفر وثائق/اعتمادات إيجار الرسمية، اضبط baseUrl فقط.
 *
 * المسارات الافتراضية (قابلة للتغيير عبر query على نفس الـ gateway لاحقاً):
 * - POST {baseUrl}/auth/validate
 * - GET  {baseUrl}/notifications
 * - POST {baseUrl}/contracts/renewals
 */
export class HttpEjarGateway implements EjarGateway {
  async authenticate(creds: EjarCredentials): Promise<EjarAuthResult> {
    try {
      const res = await fetch(join(creds.baseUrl, "/auth/validate"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${creds.apiKey}`,
          "X-Facility-No": creds.facilityNo,
        },
        body: JSON.stringify({ facilityNo: creds.facilityNo }),
      });
      if (!res.ok) {
        return {
          ok: false,
          message: `فشل التحقق من إيجار (${res.status}). تأكد من baseUrl والاعتمادات.`,
        };
      }
      const data = (await res.json().catch(() => ({}))) as { token?: string; message?: string };
      return {
        ok: true,
        token: data.token || creds.apiKey,
        message: data.message || "تم التحقق من إيجار بنجاح",
      };
    } catch (err) {
      return {
        ok: false,
        message:
          err instanceof Error
            ? `تعذر الاتصال بخادم إيجار: ${err.message}`
            : "تعذر الاتصال بخادم إيجار",
      };
    }
  }

  async fetchNotifications(creds: EjarCredentials): Promise<EjarNotificationDto[]> {
    const res = await fetch(join(creds.baseUrl, "/notifications"), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${creds.apiKey}`,
        "X-Facility-No": creds.facilityNo,
      },
    });
    if (!res.ok) {
      throw new Error(`فشل جلب إشعارات إيجار (${res.status})`);
    }
    const data = (await res.json()) as { items?: EjarNotificationDto[] } | EjarNotificationDto[];
    return Array.isArray(data) ? data : data.items || [];
  }

  async submitRenewal(
    creds: EjarCredentials,
    payload: EjarRenewalSubmitRequest,
  ): Promise<EjarRenewalSubmitResult> {
    try {
      const res = await fetch(join(creds.baseUrl, "/contracts/renewals"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${creds.apiKey}`,
          "X-Facility-No": creds.facilityNo,
        },
        body: JSON.stringify(payload),
      });
      const raw = await res.json().catch(() => ({}));
      if (!res.ok) {
        return {
          ok: false,
          message: `رفض إيجار الطلب (${res.status})`,
          raw,
        };
      }
      const reference =
        (raw as { reference?: string; id?: string }).reference ||
        (raw as { id?: string }).id ||
        `EJAR-${Date.now().toString().slice(-8)}`;
      return {
        ok: true,
        reference,
        message: "تم رفع التجديد إلى منصة إيجار",
        raw,
      };
    } catch (err) {
      return {
        ok: false,
        message:
          err instanceof Error
            ? `فشل الرفع إلى إيجار: ${err.message}`
            : "فشل الرفع إلى إيجار",
      };
    }
  }
}

function join(base: string, path: string) {
  return `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}
