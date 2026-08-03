import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Building2,
  ClipboardList,
  Cpu,
  Ellipsis,
  Home,
  LogOut,
  Settings2,
  Sparkles,
  Users,
  Wrench,
  Bell,
} from "lucide-react";
import { useStore } from "../lib/store";
import { ToastStack } from "./Toast";
import "./AppShell.css";

const links = [
  { to: "/", label: "الرئيسية", icon: Home, end: true },
  { to: "/assistant", label: "المساعد", icon: Sparkles },
  { to: "/properties", label: "العقارات", icon: Building2 },
  { to: "/contracts", label: "العقود", icon: ClipboardList },
  { to: "/sensors", label: "الحساسات", icon: Cpu },
  { to: "/maintenance", label: "الصيانة", icon: Wrench },
  { to: "/tenants", label: "المستأجرون", icon: Users },
  { to: "/settings", label: "الإعدادات", icon: Settings2 },
];

const mobileLinks = [
  { to: "/", label: "الرئيسية", icon: Home, end: true },
  { to: "/assistant", label: "المساعد", icon: Sparkles },
  { to: "/properties", label: "العقارات", icon: Building2 },
  { to: "/maintenance", label: "الصيانة", icon: Wrench },
  { to: "/more", label: "المزيد", icon: Ellipsis },
];

export function AppShell() {
  const { state, logout } = useStore();
  const navigate = useNavigate();
  const unread = state.alerts.length;

  return (
    <div className="app-shell">
      <aside className="side-nav card">
        <div className="brand-block">
          <img src="/agent.png" alt="" className="brand-avatar" />
          <div>
            <div className="brand-title">الموظف العقاري الذكي</div>
            <div className="brand-sub muted">مساعد تشغيل العقارات</div>
          </div>
        </div>

        <div className="user-chip">
          <div className="user-avatar">{state.user.initials}</div>
          <div>
            <strong>{state.user.name}</strong>
            <div className="muted">{state.user.role}</div>
          </div>
        </div>

        <nav className="side-links">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
              <l.icon size={18} />
              <span>{l.label}</span>
            </NavLink>
          ))}
        </nav>

        <button
          className="btn btn-ghost logout-btn"
          onClick={() => {
            logout();
            navigate("/login");
          }}
        >
          <LogOut size={16} />
          تسجيل الخروج
        </button>
      </aside>

      <div className="main-column">
        <header className="top-bar card">
          <div>
            <div className="top-kicker muted">لوحة التشغيل</div>
            <h1>مرحباً {state.user.name.split(" ")[0]}</h1>
          </div>
          <div className="top-actions">
            <button className="icon-btn" aria-label="الإشعارات" title={`${unread} تنبيه`}>
              <Bell size={18} />
              {unread > 0 && <span className="badge">{unread}</span>}
            </button>
          </div>
        </header>

        <main className="page-area">
          <Outlet />
        </main>
      </div>

      <nav className="bottom-nav card" aria-label="التنقل السفلي">
        {mobileLinks.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => (isActive ? "bottom-link active" : "bottom-link")}>
            <l.icon size={18} />
            <span>{l.label}</span>
          </NavLink>
        ))}
      </nav>

      <ToastStack />
    </div>
  );
}
