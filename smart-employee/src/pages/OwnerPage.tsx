import { useState, type FormEvent } from "react";
import { PageHeader } from "../components/PageHeader";
import { useStore } from "../lib/store";
import "./pages.css";

export function OwnerPage() {
  const { state, updateOwner } = useStore();
  const [editing, setEditing] = useState(false);

  const onSave = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    updateOwner({
      name: String(fd.get("name") || "").trim(),
      phone: String(fd.get("phone") || "").trim(),
      email: String(fd.get("email") || "").trim(),
      company: String(fd.get("company") || "").trim() || undefined,
      city: String(fd.get("city") || "الرياض"),
    });
    setEditing(false);
  };

  return (
    <div className="stack">
      <PageHeader
        kicker="حساب المالك"
        title="لوحة المالك"
        desc="بيانات المالك وملخص المحفظة والصلاحيات المرتبطة."
        actions={
          <button className="btn btn-primary" onClick={() => setEditing((v) => !v)}>
            {editing ? "إلغاء" : "تعديل البيانات"}
          </button>
        }
      />

      <section className="card block">
        <div className="block-head">
          <h3>هوية المالك</h3>
        </div>
        {!editing ? (
          <div className="settings-grid">
            <div>
              <div className="muted">الاسم</div>
              <strong>{state.owner.name || "— غير مُدخل"}</strong>
            </div>
            <div>
              <div className="muted">الجوال</div>
              <strong>{state.owner.phone || "—"}</strong>
            </div>
            <div>
              <div className="muted">البريد</div>
              <strong>{state.owner.email || "—"}</strong>
            </div>
            <div>
              <div className="muted">الشركة</div>
              <strong>{state.owner.company || "—"}</strong>
            </div>
            <div>
              <div className="muted">المدينة</div>
              <strong>{state.owner.city}</strong>
            </div>
            <div>
              <div className="muted">عدد الوكلاء</div>
              <strong>{state.agents.length}</strong>
            </div>
          </div>
        ) : (
          <form className="form-grid" onSubmit={onSave}>
            <div className="field">
              <label htmlFor="name">الاسم *</label>
              <input id="name" name="name" required defaultValue={state.owner.name} />
            </div>
            <div className="field">
              <label htmlFor="phone">الجوال *</label>
              <input id="phone" name="phone" required defaultValue={state.owner.phone} />
            </div>
            <div className="field">
              <label htmlFor="email">البريد *</label>
              <input id="email" name="email" type="email" required defaultValue={state.owner.email} />
            </div>
            <div className="field">
              <label htmlFor="company">
                الشركة <span className="opt">(اختياري)</span>
              </label>
              <input id="company" name="company" defaultValue={state.owner.company || ""} />
            </div>
            <div className="field">
              <label htmlFor="city">المدينة *</label>
              <input id="city" name="city" required defaultValue={state.owner.city} />
            </div>
            <button className="btn btn-primary" type="submit">
              حفظ في قاعدة البيانات
            </button>
          </form>
        )}
      </section>

      <section className="card block">
        <div className="block-head">
          <h3>ملخص سريع</h3>
        </div>
        <div className="meta-row">
          <span>{state.properties.length} عقار</span>
          <span>{state.contracts.length} عقد</span>
          <span>{state.tenants.length} مستأجر</span>
          <span>{state.rents.length} دفعة إيجار</span>
        </div>
      </section>
    </div>
  );
}
