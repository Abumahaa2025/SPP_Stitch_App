import { Link } from "react-router-dom";
import { Cpu, Settings2, Users } from "lucide-react";
import "./pages.css";

export function MorePage() {
  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <div className="section-kicker">المزيد</div>
          <h2>أقسام إضافية</h2>
          <p className="muted">الوصول السريع للمستأجرين والحساسات والإعدادات.</p>
        </div>
      </div>

      <div className="cards-grid">
        <Link to="/assistant" className="card property-card">
          <div className="property-top">
            <h3>المساعد</h3>
          </div>
          <p className="muted">قرارات المحرك والتوصيات</p>
        </Link>
        <Link to="/tenants" className="card property-card">
          <div className="property-top">
            <h3>المستأجرون</h3>
            <Users size={18} />
          </div>
          <p className="muted">سجل المستأجرين وحالة السداد</p>
        </Link>
        <Link to="/sensors" className="card property-card">
          <div className="property-top">
            <h3>الحساسات</h3>
            <Cpu size={18} />
          </div>
          <p className="muted">القراءات والتنبيهات الميدانية</p>
        </Link>
        <Link to="/contracts" className="card property-card">
          <div className="property-top">
            <h3>العقود</h3>
          </div>
          <p className="muted">التجديد والانتهاء</p>
        </Link>
        <Link to="/settings" className="card property-card">
          <div className="property-top">
            <h3>الإعدادات</h3>
            <Settings2 size={18} />
          </div>
          <p className="muted">الحساب والبيانات التجريبية</p>
        </Link>
      </div>
    </div>
  );
}
