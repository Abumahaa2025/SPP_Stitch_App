import { useState, type FormEvent } from "react";
import { PageHeader } from "../components/PageHeader";
import { useStore } from "../lib/store";
import { formatDate } from "../lib/format";
import "./pages.css";

const statusLabel: Record<string, string> = {
  بانتظار_إشعار_المستأجر: "بانتظار إشعار المستأجر",
  تم_إشعار_المستأجر: "تم إشعار المستأجر",
  وافق_المستأجر: "وافق المستأجر",
  رفض_المستأجر: "رفض المستأجر",
  بانتظار_موافقة_المالك: "بانتظار موافقة المالك",
  موافق_المالك: "موافقة المالك",
  مرفوع_لإيجار: "مرفوع لإيجار",
  مكتمل_في_إيجار: "مكتمل في إيجار",
  فشل_الرفع: "فشل الرفع",
};

export function EjarPage() {
  const {
    state,
    connectEjar,
    disconnectEjar,
    notifyTenantRenewal,
    tenantReplyRenewal,
    ownerApproveEjarRenewal,
    submitEjarRenewal,
  } = useStore();
  const [facilityNo, setFacilityNo] = useState(state.ejar.facilityNo);
  const [apiKey, setApiKey] = useState("");

  const onConnect = (e: FormEvent) => {
    e.preventDefault();
    connectEjar({ facilityNo, apiKey });
    setApiKey("");
  };

  return (
    <div className="stack">
      <PageHeader
        kicker="منصة إيجار"
        title="الربط مع إيجار"
        desc="استلام إشعارات العقود وتجديدها: إشعار المستأجر → رده → موافقة المالك → رفع تلقائي لإيجار."
      />

      <section className="card block">
        <div className="block-head">
          <h3>حالة الربط</h3>
          <span className={`pill ${state.ejar.connected ? "pill-ok" : "pill-warn"}`}>
            {state.ejar.connected ? "متصل" : "غير متصل"}
          </span>
        </div>
        {state.ejar.connected ? (
          <div className="settings-grid">
            <div>
              <div className="muted">رقم المنشأة</div>
              <strong>{state.ejar.facilityNo}</strong>
            </div>
            <div>
              <div className="muted">مفتاح الربط</div>
              <strong>{state.ejar.apiKeyMasked}</strong>
            </div>
            <div>
              <div className="muted">آخر مزامنة</div>
              <strong>
                {state.ejar.lastSyncAt ? formatDate(state.ejar.lastSyncAt.slice(0, 10)) : "—"}
              </strong>
            </div>
            <button className="btn btn-ghost" type="button" onClick={disconnectEjar}>
              إلغاء الربط
            </button>
          </div>
        ) : (
          <form className="form-grid" onSubmit={onConnect}>
            <div className="field">
              <label htmlFor="facilityNo">رقم المنشأة في إيجار *</label>
              <input
                id="facilityNo"
                value={facilityNo}
                onChange={(e) => setFacilityNo(e.target.value)}
                required
                placeholder="رقم المنشأة"
              />
            </div>
            <div className="field">
              <label htmlFor="apiKey">مفتاح الربط / التوكن *</label>
              <input
                id="apiKey"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                required
                type="password"
                placeholder="مفتاح واجهة إيجار"
              />
            </div>
            <p className="muted">
              حالياً يتم حفظ إعدادات الربط وتشغيل مسار التجديد محلياً، مع جاهزية لاستبدال المحاكاة بـ API الرسمي
              عند توفير الاعتمادات.
            </p>
            <button className="btn btn-primary" type="submit">
              ربط منصة إيجار
            </button>
          </form>
        )}
      </section>

      <section className="card block">
        <div className="block-head">
          <h3>مسار تجديد العقود</h3>
        </div>
        <ol className="roadmap">
          <li>اكتشاف قرب انتهاء العقد</li>
          <li>إشعار المستأجر: هل ترغب بالتجديد؟</li>
          <li>عند الموافقة → طلب موافقة المالك</li>
          <li>بعد موافقة المالك → رفع الطلب لمنصة إيجار</li>
        </ol>
      </section>

      <section className="card block">
        <div className="block-head">
          <h3>عقود قريبة الانتهاء</h3>
        </div>
        <div className="list">
          {state.contracts
            .filter((c) => c.type !== "عقد صيانة")
            .map((c) => (
              <div key={c.id} className="row-item">
                <div>
                  <strong>{c.no}</strong>
                  <p className="muted">
                    {c.tenant} · {c.property} · ينتهي {formatDate(c.end)}
                  </p>
                </div>
                <button className="btn btn-soft" type="button" onClick={() => notifyTenantRenewal(c.id)}>
                  إشعار المستأجر
                </button>
              </div>
            ))}
          {!state.contracts.length && (
            <div className="empty">لا توجد عقود بعد — أضف بيانات من صفحة إدخال البيانات</div>
          )}
        </div>
      </section>

      <div className="list stack-gap">
        {state.ejarRenewals.map((r) => (
          <article key={r.id} className="card block">
            <div className="block-head">
              <h3>
                {r.contractNo} — {r.tenantName}
              </h3>
              <span className="pill pill-info">{statusLabel[r.status] || r.status}</span>
            </div>
            <p className="muted">
              {r.propertyName} · نهاية العقد {formatDate(r.endDate)}
              {r.ejarRef ? ` · مرجع إيجار: ${r.ejarRef}` : ""}
            </p>
            <div className="head-actions" style={{ marginTop: 10 }}>
              {r.status === "تم_إشعار_المستأجر" && (
                <>
                  <button className="btn btn-secondary" type="button" onClick={() => tenantReplyRenewal(r.id, true)}>
                    محاكاة موافقة المستأجر
                  </button>
                  <button className="btn btn-ghost" type="button" onClick={() => tenantReplyRenewal(r.id, false)}>
                    محاكاة رفض المستأجر
                  </button>
                </>
              )}
              {r.status === "وافق_المستأجر" && (
                <button className="btn btn-primary" type="button" onClick={() => ownerApproveEjarRenewal(r.id)}>
                  موافقة المالك
                </button>
              )}
              {(r.status === "موافق_المالك" || r.status === "مرفوع_لإيجار") && (
                <button className="btn btn-primary" type="button" onClick={() => submitEjarRenewal(r.id)}>
                  رفع إلى منصة إيجار
                </button>
              )}
            </div>
            <ul className="roadmap" style={{ marginTop: 12 }}>
              {r.history.map((h, i) => (
                <li key={`${r.id}-${i}`}>
                  {new Date(h.at).toLocaleString("ar-SA")} — {h.note}
                </li>
              ))}
            </ul>
          </article>
        ))}
        {!state.ejarRenewals.length && (
          <div className="empty card">لا توجد طلبات تجديد بعد</div>
        )}
      </div>
    </div>
  );
}
