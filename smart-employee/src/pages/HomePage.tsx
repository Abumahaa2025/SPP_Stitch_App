import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Building2, ClipboardPlus, FilePlus2, Receipt, Sparkles, Wrench } from "lucide-react";
import { useStore } from "../lib/store";
import { daysLeft, sar } from "../lib/format";
import { buildDailyBrief, buildKnowledge, buildRecommendations } from "../engines";
import "./pages.css";

export function HomePage() {
  const { state, pushToast } = useStore();
  const navigate = useNavigate();

  const knowledge = useMemo(() => buildKnowledge(state), [state]);
  const suggestions = useMemo(() => buildRecommendations(state, knowledge), [state, knowledge]);
  const brief = useMemo(() => buildDailyBrief(state, knowledge, suggestions), [state, knowledge, suggestions]);

  return (
    <div className="stack">
      <section className="hero-panel card">
        <div>
          <div className="section-kicker">{brief.greeting}</div>
          <h2>{brief.headline}</h2>
          <p className="muted">صحة المحفظة {knowledge.healthScore}/100 · {brief.points[1]}</p>
        </div>
        <div className="occupancy-box">
          <strong>{knowledge.occupancyRate}%</strong>
          <span>نسبة الإشغال</span>
          <small className="muted">
            مؤجر {knowledge.rentedCount} · شاغر {knowledge.vacantCount} · صيانة {knowledge.maintenanceCount}
          </small>
        </div>
      </section>

      <section className="kpi-grid">
        <article className="card kpi">
          <span className="muted">إجمالي الإيجار السنوي</span>
          <strong>{sar(knowledge.annualRent)}</strong>
        </article>
        <article className="card kpi">
          <span className="muted">المحصّل (تقديري)</span>
          <strong>{sar(knowledge.collectedEstimate)}</strong>
          <span className="pill pill-ok">{knowledge.collectionRate}% تحصيل</span>
        </article>
        <article className="card kpi">
          <span className="muted">المتأخرات</span>
          <strong className="danger-text">{sar(knowledge.arrearsTotal)}</strong>
        </article>
      </section>

      <section className="card block">
        <div className="block-head">
          <h3>
            <Sparkles size={18} /> قرارات المحرك اليوم
          </h3>
          <button className="btn btn-ghost" onClick={() => navigate("/assistant")}>
            المساعد
          </button>
        </div>
        <div className="list">
          {brief.focus.map((s) => (
            <div key={s.id} className="row-item">
              <div>
                <div className="title-row">
                  <strong>{s.title}</strong>
                  <span className={`pill ${s.priority === "حرج" ? "pill-danger" : s.priority === "مهم" ? "pill-warn" : "pill-info"}`}>
                    {s.priority}
                  </span>
                </div>
                <p className="muted">{s.reason}</p>
                <small className="muted">{s.action} · ثقة {s.confidence}%</small>
              </div>
              <button className="btn btn-soft" onClick={() => navigate(s.route)}>
                تنفيذ
              </button>
            </div>
          ))}
          {!brief.focus.length && <div className="empty">لا قرارات عاجلة حالياً</div>}
        </div>
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

      {knowledge.expiringContracts.length > 0 && (
        <section className="card block">
          <div className="block-head">
            <h3>عقود تقترب من الانتهاء</h3>
          </div>
          <div className="list">
            {knowledge.expiringContracts.map((c) => (
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
