import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { useStore } from "../lib/store";
import { buildDailyBrief, buildKnowledge, buildRecommendations } from "../engines";
import { sar } from "../lib/format";
import "./pages.css";

export function AssistantPage() {
  const { state } = useStore();
  const navigate = useNavigate();
  const knowledge = useMemo(() => buildKnowledge(state), [state]);
  const suggestions = useMemo(() => buildRecommendations(state, knowledge), [state, knowledge]);
  const brief = useMemo(() => buildDailyBrief(state, knowledge, suggestions), [state, knowledge, suggestions]);

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <div className="section-kicker">المحرك الذكي</div>
          <h2>المساعد العقاري</h2>
          <p className="muted">{brief.greeting} — توصيات مبنية على قواعد تشغيل حتمية.</p>
        </div>
      </div>

      <section className="card block">
        <div className="block-head">
          <h3>
            <Sparkles size={18} /> ملخص المحرك
          </h3>
        </div>
        <p>
          <strong>{brief.headline}</strong>
        </p>
        <ul className="roadmap">
          {brief.points.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <div className="meta-row" style={{ marginTop: 12 }}>
          <span>صحة المحفظة {knowledge.healthScore}/100</span>
          <span>تحصيل {knowledge.collectionRate}%</span>
          <span>متأخرات {sar(knowledge.arrearsTotal)}</span>
        </div>
      </section>

      <section className="card block">
        <div className="block-head">
          <h3>كل التوصيات</h3>
        </div>
        <div className="list">
          {suggestions.map((s) => (
            <div key={s.id} className="row-item">
              <div>
                <div className="title-row">
                  <strong>{s.title}</strong>
                  <span className={`pill ${s.priority === "حرج" ? "pill-danger" : s.priority === "مهم" ? "pill-warn" : "pill-info"}`}>
                    {s.priority}
                  </span>
                </div>
                <p className="muted">{s.reason}</p>
                <small className="muted">
                  {s.action} · الأثر: {s.impact} · ثقة {s.confidence}%
                </small>
              </div>
              <button className="btn btn-primary" onClick={() => navigate(s.route)}>
                اذهب
              </button>
            </div>
          ))}
          {!suggestions.length && <div className="empty">لا توصيات حالياً — المحفظة هادئة</div>}
        </div>
      </section>
    </div>
  );
}
