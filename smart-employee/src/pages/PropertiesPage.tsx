import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { useStore } from "../lib/store";
import { sar } from "../lib/format";
import { Modal } from "../components/Modal";
import type { PropertyType } from "../data/types";
import "./pages.css";

function statusPill(status: string) {
  if (status === "مؤجرة") return "pill-ok";
  if (status === "تحت الصيانة") return "pill-warn";
  return "pill-info";
}

export function PropertiesPage() {
  const { state, addProperty, cyclePropertyStatus } = useStore();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const list = useMemo(() => {
    const query = q.trim();
    return state.properties.filter(
      (p) => !query || p.name.includes(query) || p.location.includes(query) || p.city.includes(query),
    );
  }, [state.properties, q]);

  const onAdd = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    addProperty({
      name: String(fd.get("name") || "").trim(),
      location: String(fd.get("location") || "").trim(),
      city: String(fd.get("city") || "الرياض"),
      type: String(fd.get("type") || "سكني") as PropertyType,
      price: Number(fd.get("price") || 0),
      area: Number(fd.get("area") || 0),
      rooms: Number(fd.get("rooms") || 1),
    });
    setOpen(false);
  };

  return (
    <div className="stack">
      <PageHeader
        kicker="الأصول"
        title="إدارة العقارات"
        desc="ابحث، حدّث الحالة، أو أضف عقاراً جديداً بخطوات بسيطة."
        actions={
          <>
            <button className="btn btn-ghost" onClick={() => navigate("/data-entry")}>
              إدخال شامل
            </button>
            <button className="btn btn-primary" onClick={() => setOpen(true)}>
              إضافة سريعة
            </button>
          </>
        }
      />
<div className="card block">
        <div className="field">
          <label htmlFor="prop-search">بحث</label>
          <input
            id="prop-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="اسم العقار أو الحي أو المدينة"
          />
        </div>
      </div>

      <div className="cards-grid">
        {list.map((p) => (
          <article key={p.id} className="card property-card">
            <div className="property-top">
              <h3>{p.name}</h3>
              <span className={`pill ${statusPill(p.status)}`}>{p.status}</span>
            </div>
            <p className="muted">{p.location}</p>
            <div className="meta-row">
              <span>{p.type}</span>
              <span>{p.area} م²</span>
              <span>{p.rooms} غرف</span>
            </div>
            <div className="property-foot">
              <strong>{sar(p.price)}</strong>
              <button className="btn btn-ghost" onClick={() => cyclePropertyStatus(p.id)}>
                تغيير الحالة
              </button>
            </div>
          </article>
        ))}
        {!list.length && <div className="empty card">لا توجد عقارات مطابقة</div>}
      </div>

      <Modal open={open} title="إضافة عقار جديد" onClose={() => setOpen(false)}>
        <form className="form-grid" onSubmit={onAdd}>
          <div className="field">
            <label htmlFor="name">اسم العقار</label>
            <input id="name" name="name" required placeholder="مثال: فيلا النرجس" />
          </div>
          <div className="field">
            <label htmlFor="location">الموقع</label>
            <input id="location" name="location" required placeholder="الحي، المدينة" />
          </div>
          <div className="field">
            <label htmlFor="city">المدينة</label>
            <select id="city" name="city" defaultValue="الرياض">
              <option>الرياض</option>
              <option>جدة</option>
              <option>الدمام</option>
              <option>الخبر</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="type">النوع</label>
            <select id="type" name="type" defaultValue="سكني">
              <option>سكني</option>
              <option>تجاري</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="price">قيمة الإيجار السنوي</label>
            <input id="price" name="price" type="number" min={0} required placeholder="45000" />
          </div>
          <div className="field">
            <label htmlFor="area">المساحة م²</label>
            <input id="area" name="area" type="number" min={1} required placeholder="200" />
          </div>
          <div className="field">
            <label htmlFor="rooms">الغرف</label>
            <input id="rooms" name="rooms" type="number" min={1} required placeholder="3" />
          </div>
          <button className="btn btn-primary" type="submit">
            حفظ العقار
          </button>
        </form>
      </Modal>
    </div>
  );
}
