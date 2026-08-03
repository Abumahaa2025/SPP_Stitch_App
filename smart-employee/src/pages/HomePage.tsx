import { useNavigate } from "react-router-dom";
import { AlertTriangle, Building2, ClipboardPlus, FilePlus2, Receipt, Wrench } from "lucide-react";
import { useStore } from "../lib/store";
import { daysLeft, sar } from "../lib/format";
import "./pages.css";

export function HomePage() {
  const { state, pushToast } = useStore();
  const navigate = useNavigate();

  const rented = state.properties.filter((p) => p.status === "مؤجرة").length;
  const vacant = state.properties.filter((p) => p.status === "شاغرة").length;
  const maintenance = state.properties.filter((p) => p.status === "تحت الصيانة").length;
  const occupancy = state.properties.length
    ? Math.round((rented / state.properties.length) * 100)
    : 0;
  const income = state.contracts
    .filter((c) => c.type !== "عقد صيانة")
    .reduce((sum, c) => sum + c.rent, 0);
  const delayed = state.tenants.filter((t) => t.status === "متأخر").reduce((s, t) => s + t.rent, 0);
  const collected = Math.max(income - delayed, 0);
  const expiring = state.contracts.filter((c) => {
    const d = daysLeft(c.end);
    return d <= 30 && d >= 0;
  });

  return (
    <div className="stack">
      <section className="hero-panel card">
        <div>
          <div className="section-kicker">ملخص اليوم</div>
          <h2>وضع المحفظة واضح وجاهز للمتابعة</h2>
          <p className="muted">
            {state.alerts.length
              ? `لديك ${state.alerts.length} تنبيهات تحتاج قراراً سريعاً.`
              : "لا توجد تنبيهات حرجة حالياً."}
          </p>
        </div>
        <div className="occupancy-box">
          <strong>{occupancy}%</strong>
          <span>نسبة الإشغال</span>
          <small className="muted">
            مؤجر {rented} · شاغر {vacant} · صيانة {maintenance}
          </small>
        </div>
      </section>

      <section className="kpi-grid">
        <article className="card kpi">
          <span className="muted">إجمالي الإيجار السنوي</span>
          <strong>{sar(income)}</strong>
        </article>
        <article className="card kpi">
          <span className="muted">المحصّل (تقديري)</span>
          <strong>{sar(collected)}</strong>
          <span className="pill pill-ok">
            {income ? Math.round((collected / income) * 100) : 0}% تحصيل
          </span>
        </article>
        <article className="card kpi">
          <span className="muted">المتأخرات</span>
          <strong className="danger-text">{sar(delayed)}</strong>
        </article>
      </section>

      <section className="card block">
        <div className="block-head">
          <h3>
            <AlertTriangle size={18} /> التنبيهات العاجلة
          </h3>
          <button className="btn btn-ghost" onClick={() => navigate("/sensors")}>
            عرض الكل
          </button>
        </div>
        <div className="list">
          {state.alerts.slice(0, 3).map((a) => (
            <div key={a.id} className={`alert-row alert-${a.level}`}>
              <div>
                <strong>{a.title}</strong>
                <p className="muted">{a.desc}</p>
                <small className="muted">{a.time}</small>
              </div>
              <button className="btn btn-soft" onClick={() => navigate("/maintenance")}>
                متابعة
              </button>
            </div>
          ))}
          {!state.alerts.length && <div className="empty">لا توجد تنبيهات حالياً</div>}
        </div>
      </section>

      {expiring.length > 0 && (
        <section className="card block">
          <div className="block-head">
            <h3>عقود تقترب من الانتهاء</h3>
          </div>
          <div className="list">
            {expiring.map((c) => (
              <div key={c.id} className="row-item">
                <div>
                  <strong>{c.no}</strong>
                  <p className="muted">
                    {c.tenant} · {c.unit}
                  </p>
                </div>
                <span className="pill pill-warn">متبقي {daysLeft(c.end)} يوم</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card block">
        <div className="block-head">
          <h3>إجراءات سريعة</h3>
        </div>
        <div className="quick-grid">
          <button className="quick" onClick={() => navigate("/properties")}>
            <Building2 size={18} /> العقارات
          </button>
          <button className="quick" onClick={() => navigate("/contracts")}>
            <FilePlus2 size={18} /> العقود
          </button>
          <button className="quick" onClick={() => navigate("/maintenance")}>
            <Wrench size={18} /> الصيانة
          </button>
          <button className="quick" onClick={() => navigate("/contracts")}>
            <ClipboardPlus size={18} /> تجديد عقد
          </button>
          <button className="quick" onClick={() => pushToast("تم تجهيز سند قبض تجريبي")}>
            <Receipt size={18} /> سند قبض
          </button>
        </div>
      </section>
    </div>
  );
}
