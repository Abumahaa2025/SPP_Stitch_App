import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useStore } from "../lib/store";
import { sar } from "../lib/format";
import "./LoginPage.css";
import "./pages.css";

export function OwnerAuthPage() {
  const { authId = "" } = useParams();
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const { state, ownerDecideAuthorization, ready } = useStore();
  const [done, setDone] = useState<"accept" | "reject" | null>(null);

  const auth = useMemo(
    () => state.ownerAuthorizations.find((a) => a.id === authId),
    [state.ownerAuthorizations, authId],
  );

  if (!ready) {
    return (
      <div className="login-page">
        <div className="login-card card">جاري التحميل…</div>
      </div>
    );
  }

  if (!auth) {
    return (
      <div className="login-page">
        <div className="login-card card stack">
          <h2>طلب الإذن غير موجود</h2>
          <p className="muted">تأكد من صحة الرابط المرسل إليك.</p>
          <Link className="btn btn-primary" to="/login">
            تسجيل الدخول
          </Link>
        </div>
      </div>
    );
  }

  const decided = auth.status !== "بانتظار" || done;

  const reply = (accept: boolean) => {
    const ok = ownerDecideAuthorization(auth.id, accept, token || undefined);
    if (!ok) return;
    setDone(accept ? "accept" : "reject");
  };

  return (
    <div className="login-page">
      <div className="login-card card stack">
        <p className="section-kicker">الموظف العقاري الذكي</p>
        <h2>إذن المالك لإتمام إجراء</h2>
        <p className="muted">{auth.platformName}</p>
        <h3>{auth.title}</h3>
        <p>{auth.description}</p>
        {auth.amount != null && (
          <p>
            <strong>المبلغ:</strong> {sar(auth.amount)}
          </p>
        )}

        {decided ? (
          <div className="empty">
            {done === "reject" || auth.status === "مرفوض"
              ? "تم تسجيل رفضك. لن يتم تنفيذ أي سداد أو إجراء."
              : "تمت الموافقة. سيتولى التطبيق إتمام السداد/الإجراء نيابة عنك."}
          </div>
        ) : (
          <>
            <p>
              بالموافقة تفوّض <strong>الموظف العقاري الذكي</strong> بإتمام السداد أو الإجراء المطلوب
              نيابة عنك لدى {auth.platformName}.
            </p>
            <div className="head-actions">
              <button className="btn btn-primary" type="button" onClick={() => reply(true)}>
                أوافق على التنفيذ نيابة عني
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => reply(false)}>
                أرفض
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
