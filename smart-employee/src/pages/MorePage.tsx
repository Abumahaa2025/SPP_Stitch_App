import { Link } from "react-router-dom";
import {
  Building2,
  ClipboardList,
  Cpu,
  Database,
  Receipt,
  Settings2,
  Shield,
  Sparkles,
  UserRound,
  Users,
  Wrench,
} from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import "./pages.css";

const items = [
  { to: "/data-entry", title: "إدخال البيانات", desc: "عقار وعقود وإيجارات ومستأجر", icon: Database },
  { to: "/owner", title: "حساب المالك", desc: "هوية المالك وملخص المحفظة", icon: UserRound },
  { to: "/permissions", title: "إدارة الصلاحيات", desc: "الوكلاء والشركاء", icon: Shield },
  { to: "/rents", title: "الإيجارات", desc: "الدفعات والتحصيل", icon: Receipt },
  { to: "/tenants", title: "المستأجرون", desc: "سجل المستأجرين", icon: Users },
  { to: "/contracts", title: "العقود", desc: "التجديد والانتهاء", icon: ClipboardList },
  { to: "/properties", title: "العقارات", desc: "قائمة الأصول", icon: Building2 },
  { to: "/sensors", title: "الحساسات", desc: "القراءات والتنبيهات", icon: Cpu },
  { to: "/maintenance", title: "الصيانة", desc: "الطلبات والفنيون", icon: Wrench },
  { to: "/assistant", title: "المساعد", desc: "قرارات المحرك", icon: Sparkles },
  { to: "/settings", title: "الإعدادات", desc: "الحساب والاستيراد", icon: Settings2 },
];

export function MorePage() {
  return (
    <div className="stack">
      <PageHeader
        kicker="المزيد"
        title="كل الأقسام"
        desc="وصول سريع لكل صفحات التشغيل والصلاحيات وإدخال البيانات."
      />

      <div className="cards-grid">
        {items.map((item) => (
          <Link key={item.to} to={item.to} className="card property-card">
            <div className="property-top">
              <h3>{item.title}</h3>
              <item.icon size={18} />
            </div>
            <p className="muted">{item.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
