import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useStore } from "../lib/store";
import { formatDate } from "../lib/format";
import "./LoginPage.css";
import "./pages.css";

export function TenantRenewalPage() {
  const { renewalId = "" } = useParams();
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const { state, tenantReplyRenewal, ready } = useStore();
  const [done, setDone] = useState<"accept" | "reject" | null>(null);

  const renewal = useMemo(
    () => state.ejarRenewals.find((r) => r.id === renewalId),
    [state.ejarRenewals, renewalId],
  );

  if (!ready) {
    return (
      <div className="login-page">
        <div className="login-card card">جاري التحميل…</div>
      </div>
    );
  }

  if (!renewal) {
    return (
      <div className="login-page">
        <div className="login-card card stack">
          <h2>طلب التجديد غير موجود</h2>
          <p className="muted">تأكد من صحة الرابط أو اطلب إشعاراً جديداً من مدير العقار.</p>
          <Link className="btn btn-primary" to="/login">
            تسجيل الدخول
          </Link>
        </div>
      </div>
    );
  }

  const alreadyReplied = [
    "وافق_المستأجر",
    "رفض_المستأجر",
    "موافق_المالك",
    "مرفوع_لإيجار",
    "مكتمل_في_إيجار",
    "فشل_الرفع",
  ].includes(renewal.status);

  const reply = (accept: boolean) => {
    const ok = tenantReplyRenewal(renewal.id, accept, token || undefined);
    if (ok) setDone(accept ? "accept" : "reject");
  };

  return (
    <div className="login-page">
      <div className="login-card card stack">
        <p className="section-kicker">الموظف العقاري الذكي</p>
        <h2>تجديد عقد الإيجار</h2>
        <p className="muted">
          {renewal.contractNo} · {renewal.propertyName}
          <br />
          ينتهي في {formatDate(renewal.endDate)}
        </p>

        {done || alreadyReplied ? (
          <div className="empty">
            {done === "reject" || renewal.status === "رفض_المستأجر"
              ? "تم تسجيل رفضك للتجديد. شكراً لك."
              : "تم تسجيل موافقتك. سيتم إشعار المالك لإكمال التجديد عبر إيجار."}
          </div>
        ) : (
          <>
            <p>هل ترغب بتجديد عقد الإيجار؟</p>
            <div className="head-actions">
              <button className="btn btn-primary" type="button" onClick={() => reply(true)}>
                أوافق على التجديد
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => reply(false)}>
                لا أرغب بالتجديد
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
