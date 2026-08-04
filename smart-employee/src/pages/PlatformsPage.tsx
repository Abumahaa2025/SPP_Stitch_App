import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Link2, Plus, RefreshCw } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { useStore } from "../lib/store";
import { formatDate, sar } from "../lib/format";
import type { PlatformKind, PlatformLink } from "../data/types";
import "./pages.css";

const kindOptions: { value: PlatformKind; label: string }[] = [
  { value: "ejar", label: "منصة إيجار" },
  { value: "electricity", label: "شركة الكهرباء" },
  { value: "water", label: "شركة المياه" },
  { value: "custom", label: "منصة أخرى" },
];

const noticeStatusLabel: Record<string, string> = {
  جديد: "جديد",
  أُشعر_المالك: "أُشعر المالك",
  أُشعر_المستأجرون: "أُشعر المستأجرون",
  بانتظار_إذن_المالك: "بانتظار إذن المالك",
  مأذون: "مأذون",
  مرفوض: "مرفوض",
  منفّذ: "منفّذ",
  متجاهل: "متجاهل",
};

export function PlatformsPage() {
  const {
    state,
    addPlatformLink,
    removePlatformLink,
    connectPlatformLink,
    disconnectPlatformLink,
    updatePlatformLinkFlags,
    syncPlatformInbox,
    notifyOwnerAboutNotice,
    notifyTenantsAboutNotice,
    requestOwnerAuthorization,
    ownerDecideAuthorization,
    executeOwnerAuthorizedAction,
    dismissPlatformNotice,
  } = useStore();

  const [showAdd, setShowAdd] = useState(false);
  const [connectId, setConnectId] = useState<string | null>(null);
  const [accountNo, setAccountNo] = useState("");
  const [apiKey, setApiKey] = useState("");
  const origin = useMemo(() => (typeof window !== "undefined" ? window.location.origin : ""), []);

  const onAdd = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    addPlatformLink({
      name: String(fd.get("name") || ""),
      portalUrl: String(fd.get("portalUrl") || ""),
      kind: String(fd.get("kind") || "custom") as PlatformKind,
      apiBaseUrl: String(fd.get("apiBaseUrl") || ""),
      accountNo: String(fd.get("accountNo") || ""),
    });
    setShowAdd(false);
    e.currentTarget.reset();
  };

  const onConnect = (e: FormEvent) => {
    e.preventDefault();
    if (!connectId) return;
    connectPlatformLink(connectId, { accountNo, apiKey });
    setConnectId(null);
    setAccountNo("");
    setApiKey("");
  };

  const pendingAuths = state.ownerAuthorizations.filter((a) => a.status === "بانتظار" || a.status === "موافق");

  return (
    <div className="stack">
      <PageHeader
        kicker="الربط الخارجي"
        title="إدارة روابط المنصات"
        desc="اربط إيجار والكهرباء والمياه وأي رابط إضافي. التطبيق يستقبل الرسائل ويقترح الحل ويطلب إذن المالك قبل السداد أو أي إجراء نيابة عنه."
        actions={
          <div className="head-actions">
            <button className="btn btn-soft" type="button" onClick={syncPlatformInbox}>
              <RefreshCw size={16} /> سحب الإشعارات
            </button>
            <button className="btn btn-primary" type="button" onClick={() => setShowAdd((v) => !v)}>
              <Plus size={16} /> إضافة رابط
            </button>
          </div>
        }
      />

      {showAdd && (
        <section className="card block">
          <div className="block-head">
            <h3>إضافة رابط منصة / شركة</h3>
          </div>
          <form className="form-grid" onSubmit={onAdd}>
            <div className="field">
              <label htmlFor="kind">النوع</label>
              <select id="kind" name="kind" defaultValue="custom">
                {kindOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="name">الاسم *</label>
              <input id="name" name="name" required placeholder="مثال: بوابة فواتير الحي" />
            </div>
            <div className="field">
              <label htmlFor="portalUrl">رابط البوابة *</label>
              <input id="portalUrl" name="portalUrl" required placeholder="https://..." />
            </div>
            <div className="field">
              <label htmlFor="apiBaseUrl">رابط واجهة الإشعارات / API</label>
              <input id="apiBaseUrl" name="apiBaseUrl" placeholder="اختياري — وسيط أو API" />
            </div>
            <div className="field">
              <label htmlFor="accountNo">رقم الحساب</label>
              <input id="accountNo" name="accountNo" placeholder="اختياري" />
            </div>
            <button className="btn btn-primary" type="submit">
              حفظ الرابط
            </button>
          </form>
        </section>
      )}

      <section className="card block">
        <div className="block-head">
          <h3>الروابط المرتبطة</h3>
          <span className="pill pill-info">{state.platformLinks.filter((p) => p.connected).length} متصل</span>
        </div>
        <div className="list stack-gap">
          {state.platformLinks.map((p) => (
            <PlatformCard
              key={p.id}
              platform={p}
              connecting={connectId === p.id}
              onStartConnect={() => {
                setConnectId(p.id);
                setAccountNo(p.accountNo || "");
                setApiKey("");
              }}
              onCancelConnect={() => setConnectId(null)}
              onDisconnect={() => disconnectPlatformLink(p.id)}
              onRemove={() => removePlatformLink(p.id)}
              onFlags={(patch) => updatePlatformLinkFlags(p.id, patch)}
            />
          ))}
        </div>
      </section>

      {connectId && (
        <section className="card block">
          <div className="block-head">
            <h3>ربط المنصة مباشرة بالتطبيق</h3>
          </div>
          <form className="form-grid" onSubmit={onConnect}>
            <div className="field">
              <label htmlFor="acc">رقم المنشأة / الحساب *</label>
              <input
                id="acc"
                value={accountNo}
                onChange={(e) => setAccountNo(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="key">مفتاح الربط / التوكن *</label>
              <input
                id="key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                required
              />
            </div>
            <p className="muted">
              بعد الربط يستطيع التطبيق استقبال الرسائل والإشعارات من هذه المنصة واقتراح الإجراءات
              وطلب إذنك قبل أي سداد.
            </p>
            <div className="head-actions">
              <button className="btn btn-primary" type="submit">
                تأكيد الربط
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => setConnectId(null)}>
                إلغاء
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="card block">
        <div className="block-head">
          <h3>صندوق رسائل وإشعارات المنصات</h3>
        </div>
        <div className="list stack-gap">
          {state.platformNotices.map((n) => (
            <article key={n.id} className="card block">
              <div className="block-head">
                <h3>{n.title}</h3>
                <span className="pill pill-info">{noticeStatusLabel[n.status] || n.status}</span>
              </div>
              <p className="muted">
                {n.platformName}
                {n.amount != null ? ` · ${sar(n.amount)}` : ""}
                {n.dueDate ? ` · استحقاق ${formatDate(n.dueDate)}` : ""}
              </p>
              <p>{n.body}</p>
              <p>
                <strong>الاقتراح:</strong> {n.suggestion}
              </p>
              <div className="head-actions" style={{ marginTop: 10 }}>
                <button className="btn btn-soft" type="button" onClick={() => notifyOwnerAboutNotice(n.id)}>
                  إرسال للمالك
                </button>
                <button className="btn btn-soft" type="button" onClick={() => notifyTenantsAboutNotice(n.id)}>
                  إرسال للمستأجرين
                </button>
                <button
                  className="btn btn-primary"
                  type="button"
                  onClick={() => requestOwnerAuthorization(n.id)}
                  disabled={["بانتظار_إذن_المالك", "مأذون", "منفّذ", "مرفوض"].includes(n.status)}
                >
                  طلب إذن المالك للسداد/الإجراء
                </button>
                <button className="btn btn-ghost" type="button" onClick={() => dismissPlatformNotice(n.id)}>
                  تجاهل
                </button>
              </div>
              <ul className="roadmap" style={{ marginTop: 12 }}>
                {n.history.slice(-4).map((h, i) => (
                  <li key={`${n.id}-h-${i}`}>
                    {new Date(h.at).toLocaleString("ar-SA")} — {h.note}
                  </li>
                ))}
              </ul>
            </article>
          ))}
          {!state.platformNotices.length && (
            <div className="empty">
              لا رسائل بعد — اربط المنصات ثم اضغط «سحب الإشعارات»
            </div>
          )}
        </div>
      </section>

      <section className="card block">
        <div className="block-head">
          <h3>أذونات المالك (السداد والإجراءات نيابة عنه)</h3>
        </div>
        <div className="list stack-gap">
          {pendingAuths.map((a) => (
            <article key={a.id} className="card block">
              <div className="block-head">
                <h3>{a.title}</h3>
                <span className={`pill ${a.status === "موافق" ? "pill-ok" : "pill-warn"}`}>{a.status}</span>
              </div>
              <p className="muted">
                {a.platformName}
                {a.amount != null ? ` · ${sar(a.amount)}` : ""}
              </p>
              <p>{a.description}</p>
              {a.status === "بانتظار" && (
                <p className="muted" style={{ wordBreak: "break-all" }}>
                  رابط موافقة المالك:{" "}
                  <Link to={`/owner-auth/${a.id}?token=${encodeURIComponent(a.token)}`}>فتح</Link>
                  {origin ? ` · ${origin}/owner-auth/${a.id}?token=${a.token}` : ""}
                </p>
              )}
              <div className="head-actions" style={{ marginTop: 10 }}>
                {a.status === "بانتظار" && (
                  <>
                    <button
                      className="btn btn-primary"
                      type="button"
                      onClick={() => ownerDecideAuthorization(a.id, true)}
                    >
                      موافقة المالك
                    </button>
                    <button
                      className="btn btn-ghost"
                      type="button"
                      onClick={() => ownerDecideAuthorization(a.id, false)}
                    >
                      رفض
                    </button>
                  </>
                )}
                {a.status === "موافق" && (
                  <button
                    className="btn btn-primary"
                    type="button"
                    onClick={() => executeOwnerAuthorizedAction(a.id)}
                  >
                    تنفيذ السداد/الإجراء نيابة عن المالك
                  </button>
                )}
              </div>
            </article>
          ))}
          {!pendingAuths.length && <div className="empty">لا توجد طلبات إذن حالياً</div>}
        </div>
      </section>
    </div>
  );
}

function PlatformCard({
  platform: p,
  connecting,
  onStartConnect,
  onCancelConnect,
  onDisconnect,
  onRemove,
  onFlags,
}: {
  platform: PlatformLink;
  connecting: boolean;
  onStartConnect: () => void;
  onCancelConnect: () => void;
  onDisconnect: () => void;
  onRemove: () => void;
  onFlags: (
    patch: Partial<Pick<PlatformLink, "receiveNotifications" | "actOnBehalfEnabled" | "portalUrl" | "apiBaseUrl">>,
  ) => void;
}) {
  return (
    <article className={`row-item ${connecting ? "alert-info" : ""}`}>
      <div style={{ width: "100%" }}>
        <div className="title-row">
          <h3>
            <Link2 size={16} style={{ marginInlineEnd: 6 }} />
            {p.name}
          </h3>
          <span className={`pill ${p.connected ? "pill-ok" : "pill-warn"}`}>
            {p.connected ? "متصل" : "غير متصل"}
          </span>
        </div>
        <p className="muted" style={{ wordBreak: "break-all" }}>
          {p.portalUrl}
          {p.accountNo ? ` · حساب ${p.accountNo}` : ""}
          {p.lastSyncAt ? ` · آخر مزامنة ${formatDate(p.lastSyncAt.slice(0, 10))}` : ""}
        </p>
        {p.notes && <p className="muted">{p.notes}</p>}
        <div className="settings-grid" style={{ marginTop: 8 }}>
          <label className="check-row">
            <input
              type="checkbox"
              checked={p.receiveNotifications}
              onChange={(e) => onFlags({ receiveNotifications: e.target.checked })}
            />
            استقبال الرسائل والإشعارات
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={p.actOnBehalfEnabled}
              onChange={(e) => onFlags({ actOnBehalfEnabled: e.target.checked })}
            />
            طلب إذن للتصرف نيابة عن المالك
          </label>
        </div>
        <div className="head-actions" style={{ marginTop: 10 }}>
          {p.connected ? (
            <button className="btn btn-ghost" type="button" onClick={onDisconnect}>
              إلغاء الربط
            </button>
          ) : (
            <button className="btn btn-primary" type="button" onClick={onStartConnect}>
              ربط بالتطبيق
            </button>
          )}
          {connecting && (
            <button className="btn btn-ghost" type="button" onClick={onCancelConnect}>
              إلغاء
            </button>
          )}
          {!["plt_ejar", "plt_electricity", "plt_water"].includes(p.id) && (
            <button className="btn btn-ghost" type="button" onClick={onRemove}>
              حذف
            </button>
          )}
          <a className="btn btn-soft" href={p.portalUrl} target="_blank" rel="noreferrer">
            فتح البوابة
          </a>
        </div>
      </div>
    </article>
  );
}
