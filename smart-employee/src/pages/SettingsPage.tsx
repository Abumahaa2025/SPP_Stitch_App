import { useStore } from "../lib/store";
import { parsePropertiesCsv } from "../engines";
import "./pages.css";

export function SettingsPage() {
  const { state, resetDemo, importProperties, pushToast } = useStore();

  const onImport = async (file: File | null) => {
    if (!file) return;
    const text = await file.text();
    const result = parsePropertiesCsv(text);
    if (result.errors.length && !result.properties.length) {
      pushToast(result.errors[0], "danger");
      return;
    }
    if (result.properties.length) importProperties(result.properties);
    if (result.errors.length) pushToast(`${result.errors.length} صفوف بها ملاحظات`, "warn");
  };

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <div className="section-kicker">الحساب</div>
          <h2>الإعدادات</h2>
          <p className="muted">إعدادات التشغيل والاستيراد — جاهزة للتوسع السحابي.</p>
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
          <h3>استيراد عقارات CSV</h3>
        </div>
        <p className="muted">
          الأعمدة المدعومة: اسم العقار، الموقع، المدينة، النوع، الإيجار، المساحة، الغرف
          (عربي أو إنجليزي).
        </p>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => onImport(e.target.files?.[0] || null)}
        />
      </section>

      <section className="card block">
        <div className="block-head">
          <h3>البيانات التجريبية</h3>
        </div>
        <p className="muted">التطبيق يحفظ تغييراتك محلياً على هذا الجهاز.</p>
        <button className="btn btn-primary" onClick={resetDemo}>
          إعادة ضبط البيانات
        </button>
      </section>

      <section className="card block">
        <div className="block-head">
          <h3>المحركات المفعّلة</h3>
        </div>
        <ul className="roadmap">
          <li>محرك معرفة المحفظة</li>
          <li>محرك التوصيات التشغيلية</li>
          <li>محرك العقود والمتأخرات</li>
          <li>محرك الحساسات والصيانة</li>
          <li>محرك استيراد CSV</li>
        </ul>
      </section>
    </div>
  );
}
