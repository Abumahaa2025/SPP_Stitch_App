import type {
  Alert,
  AppState,
  OwnerAuthActionType,
  OwnerAuthorization,
  PlatformLink,
  PlatformNotice,
  PlatformNoticeKind,
} from "../data/types";
import { uid } from "../data/seed";
import { sar } from "../lib/format";

function nowIso() {
  return new Date().toISOString();
}

function kindLabel(kind: PlatformLink["kind"]) {
  if (kind === "ejar") return "إيجار";
  if (kind === "electricity") return "الكهرباء";
  if (kind === "water") return "المياه";
  return "منصة";
}

function suggestFor(kind: PlatformLink["kind"], noticeKind: PlatformNoticeKind, amount?: number) {
  if (noticeKind === "bill" || noticeKind === "payment_due") {
    return amount
      ? `اقترح الحل: إشعار المالك والمستأجرين بالمبلغ ${sar(amount)}، ثم طلب إذن المالك للسداد نيابة عنه.`
      : "اقترح الحل: إشعار المالك والمستأجرين، ثم طلب إذن المالك لإتمام السداد.";
  }
  if (kind === "ejar") {
    return "اقترح الحل: مراجعة العقد وإشعار الأطراف، ثم طلب إذن المالك لأي إجراء في إيجار.";
  }
  return "اقترح الحل: إشعار المالك والمستأجرين المعنيين واقتراح الإجراء المناسب.";
}

/** يولّد إشعارات تشغيلية من المنصات المتصلة (محاكاة استقبال الرسائل) */
export function pullPlatformNotices(
  state: AppState,
): { notices: PlatformNotice[]; syncedIds: string[] } {
  const at = nowIso();
  const created: PlatformNotice[] = [];
  const syncedIds: string[] = [];

  for (const p of state.platformLinks) {
    if (!p.connected || !p.receiveNotifications) continue;
    syncedIds.push(p.id);

    const account = p.accountNo || "—";
    if (p.kind === "electricity" || p.kind === "water") {
      const amount = p.kind === "electricity" ? 320 + Math.floor(Math.random() * 180) : 95 + Math.floor(Math.random() * 80);
      const due = new Date();
      due.setDate(due.getDate() + 7);
      const noticeKind: PlatformNoticeKind = "payment_due";
      created.push({
        id: uid("pn"),
        platformId: p.id,
        platformName: p.name,
        kind: noticeKind,
        title: `فاتورة ${kindLabel(p.kind)} مستحقة`,
        body: `ورد إشعار من ${p.name} للحساب ${account}: مبلغ مستحق للسداد.`,
        amount,
        dueDate: due.toISOString().slice(0, 10),
        accountRef: account,
        receivedAt: at,
        suggestion: suggestFor(p.kind, noticeKind, amount),
        status: "جديد",
        relatedTenantIds: state.tenants.filter((t) => t.status === "نشط").map((t) => t.id).slice(0, 5),
        history: [{ at, note: "تم استلام الإشعار من المنصة" }],
      });
    } else if (p.kind === "ejar") {
      created.push({
        id: uid("pn"),
        platformId: p.id,
        platformName: p.name,
        kind: "renewal",
        title: "إشعار من منصة إيجار",
        body: `رسالة واردة من إيجار بخصوص الحساب/المنشأة ${account}: يوجد إجراء يتطلب المتابعة.`,
        accountRef: account,
        receivedAt: at,
        suggestion: suggestFor(p.kind, "renewal"),
        status: "جديد",
        history: [{ at, note: "تم استلام الإشعار من منصة إيجار" }],
      });
    } else {
      created.push({
        id: uid("pn"),
        platformId: p.id,
        platformName: p.name,
        kind: "info",
        title: `رسالة من ${p.name}`,
        body: `وردت رسالة عبر الرابط المرتبط (${p.portalUrl}).`,
        accountRef: account,
        receivedAt: at,
        suggestion: suggestFor(p.kind, "info"),
        status: "جديد",
        history: [{ at, note: "تم استلام الرسالة من المنصة المخصصة" }],
      });
    }
  }

  return {
    notices: [...created, ...state.platformNotices].slice(0, 80),
    syncedIds,
  };
}

export function markNoticeStatus(
  notices: PlatformNotice[],
  noticeId: string,
  status: PlatformNotice["status"],
  note: string,
): PlatformNotice[] {
  const at = nowIso();
  return notices.map((n) =>
    n.id === noticeId
      ? { ...n, status, history: [...n.history, { at, note }] }
      : n,
  );
}

export function buildOwnerAuthFromNotice(
  notice: PlatformNotice,
  platform: PlatformLink | undefined,
): OwnerAuthorization {
  const at = nowIso();
  const actionType: OwnerAuthActionType =
    notice.kind === "bill" || notice.kind === "payment_due"
      ? "pay_bill"
      : notice.kind === "renewal"
        ? "renew_service"
        : "submit_procedure";

  return {
    id: uid("oath"),
    noticeId: notice.id,
    platformId: notice.platformId,
    platformName: notice.platformName,
    title: `إذن لإتمام: ${notice.title}`,
    description: [
      notice.body,
      notice.amount != null ? `المبلغ: ${sar(notice.amount)}` : "",
      platform?.actOnBehalfEnabled
        ? "بعد الموافقة سيقوم الموظف العقاري الذكي بإتمام الإجراء نيابة عنك."
        : "فعّل صلاحية التصرف نيابة عن المالك في إعدادات الرابط أولاً.",
    ]
      .filter(Boolean)
      .join(" "),
    actionType,
    amount: notice.amount,
    status: "بانتظار",
    token: uid("otok"),
    requestedAt: at,
    history: [{ at, note: "طُلب إذن المالك لإتمام الإجراء نيابة عنه" }],
  };
}

export function decideOwnerAuth(
  auths: OwnerAuthorization[],
  authId: string,
  accept: boolean,
  token?: string,
): { auths: OwnerAuthorization[]; ok: boolean; message: string; auth?: OwnerAuthorization } {
  const target = auths.find((a) => a.id === authId);
  if (!target) return { auths, ok: false, message: "طلب الإذن غير موجود" };
  if (token && target.token !== token) return { auths, ok: false, message: "رمز الإذن غير صالح" };
  if (target.status !== "بانتظار") return { auths, ok: false, message: "تم البت في هذا الطلب مسبقاً" };

  const at = nowIso();
  const next = auths.map((a) => {
    if (a.id !== authId) return a;
    return {
      ...a,
      status: accept ? ("موافق" as const) : ("مرفوض" as const),
      decidedAt: at,
      history: [
        ...a.history,
        {
          at,
          note: accept
            ? "وافق المالك على إتمام الإجراء نيابة عنه"
            : "رفض المالك الإجراء",
        },
      ],
    };
  });
  const auth = next.find((a) => a.id === authId);
  return {
    auths: next,
    ok: true,
    message: accept ? "تمت موافقة المالك" : "تم تسجيل رفض المالك",
    auth,
  };
}

export function executeAuthorizedAction(
  auths: OwnerAuthorization[],
  notices: PlatformNotice[],
  authId: string,
): { auths: OwnerAuthorization[]; notices: PlatformNotice[]; ok: boolean; message: string } {
  const auth = auths.find((a) => a.id === authId);
  if (!auth) return { auths, notices, ok: false, message: "طلب الإذن غير موجود" };
  if (auth.status !== "موافق") {
    return { auths, notices, ok: false, message: "يلزم موافقة المالك قبل التنفيذ" };
  }

  const at = nowIso();
  const ref = `PAY-${Date.now().toString().slice(-8)}`;
  return {
    ok: true,
    message:
      auth.actionType === "pay_bill"
        ? `تم السداد نيابة عن المالك — مرجع ${ref}`
        : `تم تنفيذ الإجراء نيابة عن المالك — مرجع ${ref}`,
    auths: auths.map((a) =>
      a.id === authId
        ? {
            ...a,
            status: "منتهي",
            executedAt: at,
            history: [...a.history, { at, note: `نُفّذ نيابة عن المالك — ${ref}` }],
          }
        : a,
    ),
    notices: notices.map((n) =>
      n.id === auth.noticeId
        ? {
            ...n,
            status: "منفّذ",
            history: [...n.history, { at, note: `أُنجز الإجراء بعد إذن المالك — ${ref}` }],
          }
        : n,
    ),
  };
}

export function noticesToAlerts(state: AppState): Alert[] {
  return state.platformNotices
    .filter((n) => n.status === "جديد" || n.status === "بانتظار_إذن_المالك")
    .slice(0, 15)
    .map((n) => ({
      id: uid("al"),
      title: n.title,
      desc: n.body,
      time: new Date(n.receivedAt).toLocaleString("ar-SA"),
      level: n.kind === "payment_due" || n.kind === "bill" ? ("warn" as const) : ("info" as const),
      suggestion: n.suggestion,
      actions: [
        {
          id: uid("act"),
          label: "فتح إدارة المنصات",
          type: "open_platforms" as const,
          payload: { noticeId: n.id },
        },
      ],
    }));
}
