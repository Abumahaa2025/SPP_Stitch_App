import type { Alert, AppState, Contract, EjarRenewalCase, Tenant } from "../data/types";
import { daysLeft } from "../lib/format";
import { uid } from "../data/seed";

function nowLabel() {
  return new Date().toLocaleString("ar-SA");
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
        suggestion: "بعد موافقة المالك سيتم تجهيز الطلب للرفع إلى إيجار.",
        relatedContractId: c.id,
        actions: [
          {
            id: uid("act"),
            label: "موافقة المالك والرفع لإيجار",
            type: "owner_approve_ejar",
            payload: { renewalId: existing.id },
          },
        ],
      });
    }

    if (existing?.status === "موافق_المالك") {
      out.push({
        id: uid("al"),
        title: `جاهز للرفع إلى إيجار — ${c.no}`,
        desc: "المالك وافق. يمكن رفع التجديد لمنصة إيجار الآن.",
        time: nowLabel(),
        level: "info",
        suggestion: "اضغط رفع إلى إيجار لإكمال المسار.",
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
): { renewals: EjarRenewalCase[]; alertNote: string } | null {
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
  const note = `تم إرسال إشعار للمستأجر (${tenant.name}) بسؤال: هل ترغب بتجديد العقد؟`;

  if (existing) {
    return {
      renewals: state.ejarRenewals.map((r) =>
        r.id === existing.id
          ? {
              ...r,
              status: "تم_إشعار_المستأجر",
              notifiedAt: at,
              history: [...r.history, { at, note }],
            }
          : r,
      ),
      alertNote: note,
    };
  }

  const created: EjarRenewalCase = {
    id: uid("ejr"),
    contractId: contract.id,
    contractNo: contract.no,
    tenantName: tenant.name,
    tenantPhone: tenant.phone || "",
    propertyName: contract.property,
    endDate: contract.end,
    status: "تم_إشعار_المستأجر",
    notifiedAt: at,
    history: [{ at, note }],
  };

  return { renewals: [created, ...state.ejarRenewals], alertNote: note };
}

export function simulateTenantReply(
  renewals: EjarRenewalCase[],
  renewalId: string,
  accept: boolean,
): EjarRenewalCase[] {
  const at = new Date().toISOString();
  return renewals.map((r) => {
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
  });
}

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
      history: [...r.history, { at, note: "وافق المالك على التجديد والرفع لإيجار" }],
    };
  });
}

/** محاكاة رفع لمنصة إيجار — جاهز لاستبدالها بـ API رسمي لاحقاً */
export function submitRenewalToEjar(
  renewals: EjarRenewalCase[],
  renewalId: string,
  connected: boolean,
): { renewals: EjarRenewalCase[]; ok: boolean; message: string } {
  const at = new Date().toISOString();
  if (!connected) {
    return {
      renewals,
      ok: false,
      message: "اربط حساب منصة إيجار أولاً من صفحة إيجار",
    };
  }

  let ok = false;
  const next = renewals.map((r) => {
    if (r.id !== renewalId) return r;
    ok = true;
    const ref = `EJAR-${Date.now().toString().slice(-8)}`;
    return {
      ...r,
      status: "مرفوع_لإيجار" as const,
      submittedAt: at,
      ejarRef: ref,
      history: [
        ...r.history,
        { at, note: `تم رفع طلب التجديد إلى منصة إيجار — المرجع ${ref}` },
      ],
    };
  });

  // انتقل سريعاً لحالة مكتمل في المحاكاة
  const completed = next.map((r) => {
    if (r.id !== renewalId) return r;
    return {
      ...r,
      status: "مكتمل_في_إيجار" as const,
      history: [
        ...r.history,
        { at: new Date().toISOString(), note: "إيجار: تم استلام الطلب بنجاح (محاكاة الربط)" },
      ],
    };
  });

  return {
    renewals: completed,
    ok,
    message: ok ? "تم الرفع إلى منصة إيجار بنجاح" : "تعذر العثور على طلب التجديد",
  };
}

export function contractsNeedingRenewal(contracts: Contract[]) {
  return contracts.filter((c) => {
    if (c.type === "عقد صيانة") return false;
    const d = daysLeft(c.end);
    return d >= 0 && d <= 60;
  });
}
