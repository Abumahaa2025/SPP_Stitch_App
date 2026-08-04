import { useState, type FormEvent } from "react";
import { PageHeader } from "../components/PageHeader";
import { useStore } from "../lib/store";
import type { PermissionKey } from "../data/types";
import "./pages.css";

const ALL_PERMS: PermissionKey[] = [
  "إدارة العقود",
  "تحصيل الإيجارات",
  "إدارة الصيانة",
  "خدمات الكهرباء",
  "خدمات المياه",
  "إدارة العقارات",
];

export function PermissionsPage() {
  const { state, addAgent, toggleAgentPermission, pushToast } = useStore();
  const [selected, setSelected] = useState<PermissionKey[]>(["إدارة العقود"]);

  const onAdd = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") || "").trim();
    const phone = String(fd.get("phone") || "").trim();
    const role = String(fd.get("role") || "وكيل").trim();
    if (!name || !phone) return;
    if (!selected.length) {
      pushToast("اختر صلاحية واحدة على الأقل", "warn");
      return;
    }
    addAgent({ name, phone, role, permissions: selected });
    e.currentTarget.reset();
    setSelected(["إدارة العقود"]);
  };

  return (
    <div className="stack">
      <PageHeader
        kicker="الصلاحيات"
        title="إدارة الوكلاء والصلاحيات"
        desc="أضف وكيلاً أو شريكاً وحدد صلاحياته للوصول إلى أجزاء التشغيل."
      />

      <section className="card block">
        <div className="block-head">
          <h3>إضافة وكيل / شريك</h3>
        </div>
        <form className="form-grid" onSubmit={onAdd}>
          <div className="field">
            <label htmlFor="name">اسم الوكيل *</label>
            <input id="name" name="name" required placeholder="أدخل اسم الوكيل" />
          </div>
          <div className="field">
            <label htmlFor="phone">رقم الجوال *</label>
            <input id="phone" name="phone" required placeholder="05xxxxxxxx" />
          </div>
          <div className="field">
            <label htmlFor="role">المسمى *</label>
            <input id="role" name="role" required defaultValue="وكيل تشغيل" />
          </div>
          <div>
            <div className="muted" style={{ marginBottom: 8, fontWeight: 700 }}>
              تحديد الصلاحيات
            </div>
            <div className="perm-grid">
              {ALL_PERMS.map((p) => (
                <label key={p} className={`perm-chip ${selected.includes(p) ? "on" : ""}`}>
                  <input
                    type="checkbox"
                    checked={selected.includes(p)}
                    onChange={() =>
                      setSelected((prev) =>
                        prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
                      )
                    }
                  />
                  {p}
                </label>
              ))}
            </div>
          </div>
          <button className="btn btn-primary" type="submit">
            + إضافة وكيل
          </button>
        </form>
      </section>

      <section className="card block">
        <div className="block-head">
          <h3>الصلاحيات النشطة</h3>
        </div>
        <div className="meta-row">
          <span>{state.agents.length} وكيل</span>
          <span>{state.agents.filter((a) => a.permissions.includes("تحصيل الإيجارات")).length} تحصيل</span>
          <span>{state.agents.filter((a) => a.status === "بانتظار الموافقة").length} بانتظار</span>
        </div>
      </section>

      <div className="list stack-gap">
        {state.agents.map((a) => (
          <article key={a.id} className="card row-item contract-card">
            <div>
              <div className="title-row">
                <h3>{a.name}</h3>
                <span className={`pill ${a.status === "نشط" ? "pill-ok" : "pill-warn"}`}>{a.status}</span>
              </div>
              <p className="muted">
                {a.role} · {a.phone}
              </p>
              <div className="perm-grid" style={{ marginTop: 10 }}>
                {ALL_PERMS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`perm-chip ${a.permissions.includes(p) ? "on" : ""}`}
                    onClick={() => toggleAgentPermission(a.id, p)}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <small className="muted">رابط الوصول: {a.accessLink}</small>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
