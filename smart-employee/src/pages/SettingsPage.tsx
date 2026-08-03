import { useStore } from "../lib/store";
import "./pages.css";

export function SettingsPage() {
  const { state, resetDemo } = useStore();

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <div className="section-kicker">الحساب</div>
          <h2>الإعدادات</h2>
          <p className="muted">إعدادات أساسية للتجربة الحالية — جاهزة للتوسع لاحقاً.</p>
        </div>
      </div>

      <section className="card block">
        <div className="block-head">
          <h3>الملف الشخصي</h3>
        </div>
        <div className="settings-grid">
          <div>
            <div className="muted">الاسم</div>
            <strong>{state.user.name}</strong>
          </div>
          <div>
            <div className="muted">الدور</div>
            <strong>{state.user.role}</strong>
          </div>
          <div>
            <div className="muted">اللغة</div>
            <strong>العربية (السعودية)</strong>
          </div>
          <div>
            <div className="muted">العملة</div>
            <strong>ر.س</strong>
          </div>
        </div>
      </section>

      <section className="card block">
        <div className="block-head">
          <h3>البيانات التجريبية</h3>
        </div>
        <p className="muted">
          التطبيق يحفظ تغييراتك محلياً على هذا الجهاز. يمكنك إعادة ضبط البيانات التجريبية في أي وقت.
        </p>
        <button className="btn btn-primary" onClick={resetDemo}>
          إعادة ضبط البيانات
        </button>
      </section>

      <section className="card block">
        <div className="block-head">
          <h3>خارطة الطريق</h3>
        </div>
        <ul className="roadmap">
          <li>محرك عقود ومتأخرات حتمي</li>
          <li>استيراد ملفات Excel / Google Sheets</li>
          <li>مساعد توصيات ذكي</li>
          <li>بوابة مستأجر وفني</li>
          <li>تقارير تنفيذية PDF</li>
        </ul>
      </section>
    </div>
  );
}
