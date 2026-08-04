import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  ChevronDown,
  ClipboardList,
  Cpu,
  Database,
  KeyRound,
  Receipt,
  Shield,
  Sparkles,
  UserRound,
  Users,
  Wrench,
  Bell,
} from "lucide-react";
import { useStore } from "../lib/store";
import { daysLeft, sar } from "../lib/format";
import { buildDailyBrief, buildKnowledge, buildRecommendations } from "../engines";
import "./pages.css";

type MenuItem = { label: string; to: string; desc: string };

const opsMenus: { id: string; title: string; icon: typeof Building2; items: MenuItem[] }[] = [
  {
    id: "assets",
    title: "العقارات والعقود",
    icon: Building2,
    items: [
      { label: "إدخال بيانات عقار", to: "/data-entry", desc: "عقار + عقد + إيجار + مستأجر" },
      { label: "العقارات", to: "/properties", desc: "قائمة الأصول وحالاتها" },
      { label: "العقود", to: "/contracts", desc: "تجديد ومتابعة الانتهاء" },
    ],
  },
  {
    id: "finance",
    title: "الإيجارات والتحصيل",
    icon: Receipt,
    items: [
      { label: "الإيجارات", to: "/rents", desc: "الدفعات وحالة التحصيل" },
      { label: "المستأجرون", to: "/tenants", desc: "سجل المستأجرين" },
    ],
  },
  {
    id: "ejar",
    title: "إيجار والتنبيهات",
    icon: Shield,
    items: [
      { label: "ربط منصة إيجار", to: "/ejar", desc: "إشعارات وتجديد العقود" },
      { label: "إدارة التنبيهات", to: "/alerts", desc: "حلول واقتراحات قابلة للتنفيذ" },
      { label: "الصلاحيات", to: "/permissions", desc: "الوكلاء والشركاء" },
    ],
  },
  {
    id: "ops",
    title: "التشغيل والصيانة",
    icon: Wrench,
    items: [
      { label: "الصيانة", to: "/maintenance", desc: "الطلبات والفنيون" },
      { label: "الحساسات", to: "/sensors", desc: "التنبيهات الميدانية" },
      { label: "المساعد", to: "/assistant", desc: "قرارات المحرك" },
    ],
  },
];

export function HomePage() {
  const { state, saving } = useStore();
  const navigate = useNavigate();
  const [openMenu, setOpenMenu] = useState<string | null>("assets");

  const knowledge = useMemo(() => buildKnowledge(state), [state]);
  const suggestions = useMemo(() => buildRecommendations(state, knowledge), [state, knowledge]);
  const brief = useMemo(() => buildDailyBrief(state, knowledge, suggestions), [state, knowledge, suggestions]);

  return (
    <div className="stack">
      <section className="hero-panel card">
        <div>
          <div className="section-kicker">{brief.greeting}</div>
          <h2>{brief.headline}</h2>
          <p className="muted">
            صحة المحفظة {knowledge.healthScore}/100 · {brief.points[1]}
            {saving ? " · جاري مزامنة قاعدة البيانات..." : ""}
          </p>
        </div>
        <div className="occupancy-box">
          <strong>{knowledge.occupancyRate}%</strong>
          <span>نسبة الإشغال</span>
          <small className="muted">
            مؤجر {knowledge.rentedCount} · شاغر {knowledge.vacantCount} · صيانة {knowledge.maintenanceCount}
          </small>
        </div>
      </section>

      <section className="home-top-actions">
        <button className="card home-action" onClick={() => navigate("/owner")}>
          <UserRound size={20} />
          <div>
            <strong>حساب المالك</strong>
            <p className="muted">{state.owner.name || "أدخل بيانات المالك"}</p>
          </div>
        </button>
        <button className="card home-action" onClick={() => navigate("/permissions")}>
          <Shield size={20} />
          <div>
            <strong>إدارة الصلاحيات</strong>
            <p className="muted">{state.agents.length} وكيل / شريك</p>
          </div>
        </button>
        <button className="card home-action primary-action" onClick={() => navigate("/data-entry")}>
          <Database size={20} />
          <div>
            <strong>إدخال البيانات</strong>
            <p className="muted">حفظ مباشر في قاعدة البيانات</p>
          </div>
        </button>
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
          <h3>الأساسيات — وصول سريع</h3>
        </div>
        <div className="accordion-list">
          {opsMenus.map((menu) => {
            const open = openMenu === menu.id;
            const Icon = menu.icon;
            return (
              <div key={menu.id} className={`accordion ${open ? "open" : ""}`}>
                <button
                  type="button"
                  className="accordion-trigger"
                  onClick={() => setOpenMenu(open ? null : menu.id)}
                  aria-expanded={open}
                >
                  <span className="accordion-title">
                    <Icon size={18} />
                    {menu.title}
                  </span>
                  <ChevronDown size={18} className={`chev ${open ? "up" : ""}`} />
                </button>
                {open && (
                  <div className="accordion-body">
                    {menu.items.map((item) => (
                      <button
                        key={item.to}
                        type="button"
                        className="accordion-link"
                        onClick={() => navigate(item.to)}
                      >
                        <strong>{item.label}</strong>
                        <span className="muted">{item.desc}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
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
          {brief.focus.slice(0, 3).map((s) => (
            <div key={s.id} className="row-item">
              <div>
                <div className="title-row">
                  <strong>{s.title}</strong>
                  <span className={`pill ${s.priority === "حرج" ? "pill-danger" : s.priority === "مهم" ? "pill-warn" : "pill-info"}`}>
                    {s.priority}
                  </span>
                </div>
                <p className="muted">{s.reason}</p>
              </div>
              <button className="btn btn-soft" onClick={() => navigate(s.route)}>
                تنفيذ
              </button>
            </div>
          ))}
          {!brief.focus.length && <div className="empty">لا قرارات عاجلة حالياً</div>}
        </div>
      </section>

      {knowledge.expiringContracts.length > 0 && (
        <section className="card block">
          <div className="block-head">
            <h3>
              <ClipboardList size={18} /> عقود تقترب من الانتهاء
            </h3>
          </div>
          <div className="list">
            {knowledge.expiringContracts.slice(0, 3).map((c) => (
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

      <section className="quick-links card block">
        <div className="block-head">
          <h3>روابط مباشرة</h3>
        </div>
        <div className="quick-grid">
          <button className="quick" onClick={() => navigate("/properties")}>
            <Building2 size={18} /> العقارات
          </button>
          <button className="quick" onClick={() => navigate("/contracts")}>
            <ClipboardList size={18} /> العقود
          </button>
          <button className="quick" onClick={() => navigate("/rents")}>
            <Receipt size={18} /> الإيجارات
          </button>
          <button className="quick" onClick={() => navigate("/tenants")}>
            <Users size={18} /> المستأجرون
          </button>
          <button className="quick" onClick={() => navigate("/maintenance")}>
            <Wrench size={18} /> الصيانة
          </button>
          <button className="quick" onClick={() => navigate("/sensors")}>
            <Cpu size={18} /> الحساسات
          </button>
          <button className="quick" onClick={() => navigate("/ejar")}>
            <ClipboardList size={18} /> إيجار
          </button>
          <button className="quick" onClick={() => navigate("/alerts")}>
            <Bell size={18} /> التنبيهات
          </button>
          <button className="quick" onClick={() => navigate("/permissions")}>
            <KeyRound size={18} /> الصلاحيات
          </button>
          <button className="quick" onClick={() => navigate("/owner")}>
            <UserRound size={18} /> المالك
          </button>
        </div>
      </section>
    </div>
  );
}
