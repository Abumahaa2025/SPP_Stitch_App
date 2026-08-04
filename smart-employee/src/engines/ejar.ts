import type { Alert, AppState, Contract, EjarRenewalCase, Tenant } from "../data/types";
import type { EjarRenewalSubmitResult } from "../integrations/ejar";
import { daysLeft } from "../lib/format";
import { uid } from "../data/seed";

function nowLabel() {
  return new Date().toLocaleString("ar-SA");
}

function tenantReplyPath(renewalId: string, token: string) {
  return `/tenant-renewal/${renewalId}?token=${encodeURIComponent(token)}`;
}

/** يبني تنبيهات تجديد العقود مع اقتراح حل عملي */
export function buildRenewalAlerts(state: AppState): Alert[] {
  const out: Alert[] = [];
  for (const c of state.contracts) {
    if (c.type === "عقد صيانة") continue;
    const left = daysLeft(c.end);
    if (left < 0 || left > 60) continue;

    const existing = state.ejarRenewals.find(
      (r) => r.contractId === c.id && !["مكتمل_في_إيجار", "رفض_المستأجر", "فشل_الرفع"].includes(r.status),
    );

    const tenant = state.tenants.find((t) => t.contractNo === c.no || t.name === c.tenant);

    if (!existing && left <= 45) {
      out.push({
        id: uid("al"),
        title: `قرب انتهاء العقد ${c.no}`,
        desc: `العقد ينتهي خلال ${left} يوم — ${c.tenant} / ${c.property}`,
        time: "الآن",
        level: left <= 15 ? "danger" : "warn",
        suggestion:
          "اقترح الحل: إشعار المستأجر برغبة التجديد. إذا وافق → موافقة المالك → رفع تلقائي لمنصة إيجار.",
        relatedContractId: c.id,
        relatedTenantId: tenant?.id,
        actions: [
          {
            id: uid("act"),
            label: "إشعار المستأجر بالتجديد",
            type: "notify_tenant_renewal",
            payload: { contractId: c.id },
          },
          {
            id: uid("act"),
            label: "فتح العقد",
            type: "open_contract",
            payload: { contractId: c.id },
          },
        ],
      });
    }

    if (existing?.status === "وافق_المستأجر") {
      out.push({
        id: uid("al"),
        title: `المستأجر وافق على تجديد ${c.no}`,
        desc: "بانتظار موافقة المالك ثم الرفع لمنصة إيجار.",
        time: nowLabel(),
        level: "info",
        suggestion: state.ejar.autoSubmitOnApproval
          ? "بعد موافقة المالك سيُرفع الطلب تلقائياً إلى إيجار عبر بوابة الربط."
          : "بعد موافقة المالك ارفع الطلب يدوياً إلى إيجار.",
        relatedContractId: c.id,
        actions: [
          {
            id: uid("act"),
            label: state.ejar.autoSubmitOnApproval
              ? "موافقة المالك والرفع لإيجار"
              : "موافقة المالك",
            type: "owner_approve_ejar",
            payload: { renewalId: existing.id },
          },
        ],
      });
    }

    if (existing?.status === "موافق_المالك" || existing?.status === "فشل_الرفع") {
      out.push({
        id: uid("al"),
        title: `جاهز للرفع إلى إيجار — ${c.no}`,
        desc:
          existing.status === "فشل_الرفع"
            ? existing.lastError || "فشل الرفع السابق — يمكن إعادة المحاولة."
            : "المالك وافق. يمكن رفع التجديد لمنصة إيجار الآن.",
        time: nowLabel(),
        level: existing.status === "فشل_الرفع" ? "danger" : "info",
        suggestion: "اضغط رفع إلى إيجار لإكمال المسار عبر بوابة الربط.",
        relatedContractId: c.id,
        actions: [
          {
            id: uid("act"),
            label: "رفع إلى منصة إيجار",
            type: "submit_ejar",
            payload: { renewalId: existing.id },
          },
        ],
      });
    }
  }
  return out;
}

export function startTenantRenewalNotice(
  state: AppState,
  contractId: string,
): { renewals: EjarRenewalCase[]; alertNote: string; replyPath: string } | null {
  const contract = state.contracts.find((c) => c.id === contractId);
  if (!contract) return null;
  const tenant =
    state.tenants.find((t) => t.contractNo === contract.no || t.name === contract.tenant) ||
    ({
      name: contract.tenant,
      phone: "",
    } as Pick<Tenant, "name" | "phone">);

  const existing = state.ejarRenewals.find((r) => r.contractId === contractId);
  const at = new Date().toISOString();
  const replyToken = existing?.replyToken || uid("tok");
  const caseId = existing?.id || uid("ejr");
  const replyPath = tenantReplyPath(caseId, replyToken);
  const note = `تم إرسال إشعار للمستأجر (${tenant.name}) بسؤال: هل ترغب بتجديد العقد؟ رابط الرد: ${replyPath}`;

  if (existing) {
    return {
      renewals: state.ejarRenewals.map((r) =>
        r.id === existing.id
          ? {
              ...r,
              status: "تم_إشعار_المستأجر",
              replyToken,
              notifiedAt: at,
              lastError: undefined,
              history: [...r.history, { at, note }],
            }
          : r,
      ),
      alertNote: note,
      replyPath,
    };
  }

  const created: EjarRenewalCase = {
    id: caseId,
    contractId: contract.id,
    contractNo: contract.no,
    tenantName: tenant.name,
    tenantPhone: tenant.phone || "",
    propertyName: contract.property,
    endDate: contract.end,
    status: "تم_إشعار_المستأجر",
    replyToken,
    notifiedAt: at,
    history: [{ at, note }],
  };

  return { renewals: [created, ...state.ejarRenewals], alertNote: note, replyPath };
}

export function recordTenantReply(
  renewals: EjarRenewalCase[],
  renewalId: string,
  accept: boolean,
  token?: string,
): { renewals: EjarRenewalCase[]; ok: boolean; message: string } {
  const target = renewals.find((r) => r.id === renewalId);
  if (!target) return { renewals, ok: false, message: "طلب التجديد غير موجود" };
  if (token && target.replyToken && token !== target.replyToken) {
    return { renewals, ok: false, message: "رمز الرد غير صالح" };
  }
  if (!["تم_إشعار_المستأجر", "بانتظار_إشعار_المستأجر"].includes(target.status)) {
    return { renewals, ok: false, message: "لا يمكن الرد على هذه الحالة حالياً" };
  }

  const at = new Date().toISOString();
  return {
    ok: true,
    message: accept ? "تم تسجيل موافقة المستأجر" : "تم تسجيل رفض المستأجر",
    renewals: renewals.map((r) => {
      if (r.id !== renewalId) return r;
      return {
        ...r,
        status: accept ? "وافق_المستأجر" : "رفض_المستأجر",
        tenantReplyAt: at,
        history: [
          ...r.history,
          {
            at,
            note: accept
              ? "رد المستأجر: أوافق على التجديد"
              : "رد المستأجر: لا أرغب بالتجديد",
          },
        ],
      };
    }),
  };
}

/** توافق خلفي مع الاسم السابق */
export const simulateTenantReply = (
  renewals: EjarRenewalCase[],
  renewalId: string,
  accept: boolean,
): EjarRenewalCase[] => recordTenantReply(renewals, renewalId, accept).renewals;

export function ownerApproveRenewal(
  renewals: EjarRenewalCase[],
  renewalId: string,
): EjarRenewalCase[] {
  const at = new Date().toISOString();
  return renewals.map((r) => {
    if (r.id !== renewalId) return r;
    return {
      ...r,
      status: "موافق_المالك",
      ownerApprovedAt: at,
      lastError: undefined,
      history: [...r.history, { at, note: "وافق المالك على التجديد والرفع لإيجار" }],
    };
  });
}

export function markRenewalSubmitting(
  renewals: EjarRenewalCase[],
  renewalId: string,
): EjarRenewalCase[] {
  const at = new Date().toISOString();
  return renewals.map((r) => {
    if (r.id !== renewalId) return r;
    return {
      ...r,
      status: "مرفوع_لإيجار",
      submittedAt: at,
      lastError: undefined,
      history: [...r.history, { at, note: "جاري رفع طلب التجديد إلى منصة إيجار…" }],
    };
  });
}

export function applyRenewalSubmitResult(
  renewals: EjarRenewalCase[],
  renewalId: string,
  result: EjarRenewalSubmitResult,
  modeLabel: string,
): EjarRenewalCase[] {
  const at = new Date().toISOString();
  return renewals.map((r) => {
    if (r.id !== renewalId) return r;
    if (!result.ok) {
      return {
        ...r,
        status: "فشل_الرفع",
        lastError: result.message,
        history: [
          ...r.history,
          { at, note: `فشل الرفع إلى إيجار (${modeLabel}): ${result.message}` },
        ],
      };
    }
    const ref = result.reference || `EJAR-${Date.now().toString().slice(-8)}`;
    return {
      ...r,
      status: "مكتمل_في_إيجار",
      submittedAt: at,
      ejarRef: ref,
      lastError: undefined,
      history: [
        ...r.history,
        {
          at,
          note: `تم استلام طلب التجديد في إيجار — المرجع ${ref} (${modeLabel})`,
        },
      ],
    };
  });
}

export function contractsNeedingRenewal(contracts: Contract[]) {
  return contracts.filter((c) => {
    if (c.type === "عقد صيانة") return false;
    const d = daysLeft(c.end);
    return d >= 0 && d <= 60;
  });
}
