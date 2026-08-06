import { useState } from "react";
import type { FormEvent } from "react";
import { PageHeader } from "../components/PageHeader";
import { useStore } from "../lib/store";
import { Modal } from "../components/Modal";
import "./pages.css";

function maintPill(status: string) {
  if (status === "مكتمل") return "pill-ok";
  if (status === "قيد التنفيذ") return "pill-info";
  return "pill-warn";
}

export function MaintenancePage() {
  const { state, addMaintenance, advanceMaintenance, addTechnician } = useStore();
  const [reqOpen, setReqOpen] = useState(false);
  const [techOpen, setTechOpen] = useState(false);

  const onReq = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    addMaintenance({
      desc: String(fd.get("desc") || "").trim(),
      type: String(fd.get("type") || "سباكة"),
      property: String(fd.get("property") || "").trim(),
    });
    setReqOpen(false);
  };

  const onTech = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    addTechnician({
      name: String(fd.get("name") || "").trim(),
      phone: String(fd.get("phone") || "").trim(),
      specialty: String(fd.get("specialty") || "سباكة"),
    });
    setTechOpen(false);
  };

  return (
    <div className="stack">
      <PageHeader
        kicker="التشغيل"
        title="الصيانة والفنيون"
        desc="أنشئ الطلب، عيّن فنياً، وتابع الحالة حتى الإكمال."
        actions={
          <>
            <button className="btn btn-ghost" onClick={() => setTechOpen(true)}>
            إضافة فني
          </button>
            <button className="btn btn-primary" onClick={() => setReqOpen(true)}>
            طلب صيانة
          </button>
          </>
        }
      />
<section className="card block">
        <div className="block-head">
          <h3>الفنيون المتاحون</h3>
        </div>
        <div className="cards-grid">
          {state.technicians.map((t) => (
            <article key={t.id} className="card property-card">
              <div className="property-top">
                <h3>{t.name}</h3>
                <span className="pill pill-ok">{t.rating.toFixed(1)}</span>
              </div>
              <p className="muted">{t.specialty}</p>
              <div className="meta-row">
                <span>{t.phone}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="card block">
        <div className="block-head">
          <h3>طلبات الصيانة</h3>
        </div>
        <div className="list">
          {state.maintenance.map((m) => (
            <div key={m.id} className="row-item">
              <div>
                <div className="title-row">
                  <strong>#{m.no}</strong>
                  <span className={`pill ${maintPill(m.status)}`}>{m.status}</span>
                </div>
                <p className="muted">
                  {m.desc} · {m.type} · {m.property}
                </p>
                <small className="muted">الفني: {m.tech}</small>
              </div>
              {m.status !== "مكتمل" && (
                <button className="btn btn-soft" onClick={() => advanceMaintenance(m.id)}>
                  تقدم الحالة
                </button>
              )}
            </div>
          ))}
          {!state.maintenance.length && <div className="empty">لا توجد طلبات</div>}
        </div>
      </section>

      <Modal open={reqOpen} title="طلب صيانة جديد" onClose={() => setReqOpen(false)}>
        <form className="form-grid" onSubmit={onReq}>
          <div className="field">
            <label htmlFor="property">العقار</label>
            <input id="property" name="property" required placeholder="فيلا الياسمين" />
          </div>
          <div className="field">
            <label htmlFor="type">النوع</label>
            <select id="type" name="type" defaultValue="سباكة">
              <option>سباكة</option>
              <option>كهرباء</option>
              <option>تكييف</option>
              <option>نجارة</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="desc">وصف المشكلة</label>
            <textarea id="desc" name="desc" required placeholder="اشرح المشكلة باختصار" />
          </div>
          <button className="btn btn-primary" type="submit">
            إرسال الطلب
          </button>
        </form>
      </Modal>

      <Modal open={techOpen} title="إضافة فني" onClose={() => setTechOpen(false)}>
        <form className="form-grid" onSubmit={onTech}>
          <div className="field">
            <label htmlFor="name">الاسم</label>
            <input id="name" name="name" required />
          </div>
          <div className="field">
            <label htmlFor="phone">الجوال</label>
            <input id="phone" name="phone" required placeholder="05xxxxxxxx" />
          </div>
          <div className="field">
            <label htmlFor="specialty">التخصص</label>
            <select id="specialty" name="specialty" defaultValue="سباكة">
              <option>سباكة</option>
              <option>كهرباء</option>
              <option>تكييف</option>
              <option>نجارة</option>
            </select>
          </div>
          <button className="btn btn-primary" type="submit">
            حفظ الفني
          </button>
        </form>
      </Modal>
    </div>
  );
}
