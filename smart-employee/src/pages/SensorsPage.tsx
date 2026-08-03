import { useStore } from "../lib/store";
import "./pages.css";

function sensorPill(status: string) {
  if (status === "يعمل") return "pill-ok";
  if (status === "تنبيه") return "pill-warn";
  return "pill-danger";
}

export function SensorsPage() {
  const { state, simulateSensors } = useStore();

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <div className="section-kicker">المراقبة</div>
          <h2>لوحة المستشعرات</h2>
          <p className="muted">تابع حالة الحساسات والتنبيهات الميدانية بسرعة.</p>
        </div>
        <button className="btn btn-primary" onClick={simulateSensors}>
          تحديث القراءة
        </button>
      </div>

      <section className="card block">
        <div className="block-head">
          <h3>سجل الإنذارات</h3>
        </div>
        <div className="list">
          {state.alerts.map((a) => (
            <div key={a.id} className={`alert-row alert-${a.level}`}>
              <div>
                <strong>{a.title}</strong>
                <p className="muted">{a.desc}</p>
                <small className="muted">{a.time}</small>
              </div>
            </div>
          ))}
          {!state.alerts.length && <div className="empty">لا توجد إنذارات</div>}
        </div>
      </section>

      <div className="cards-grid">
        {state.sensors.map((s) => (
          <article key={s.id} className="card property-card">
            <div className="property-top">
              <h3>{s.type}</h3>
              <span className={`pill ${sensorPill(s.status)}`}>{s.status}</span>
            </div>
            <p className="muted">{s.unit}</p>
            <div className="meta-row">
              <span>{s.city}</span>
              <strong>{s.reading}</strong>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
