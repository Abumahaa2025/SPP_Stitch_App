import { useState } from "react";
import type { FormEvent } from "react";
import { PageHeader } from "../components/PageHeader";
import { useStore } from "../lib/store";
import { daysLeft, formatDate, sar } from "../lib/format";
import { Modal } from "../components/Modal";
import type { ContractType } from "../data/types";
import "./pages.css";

export function ContractsPage() {
  const { state, addContract, renewContract } = useStore();
  const [open, setOpen] = useState(false);

  const onAdd = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    addContract({
      unit: String(fd.get("unit") || "").trim(),
      property: String(fd.get("property") || "").trim(),
      tenant: String(fd.get("tenant") || "").trim(),
      end: String(fd.get("end") || ""),
      type: String(fd.get("type") || "إيجار سكني") as ContractType,
      rent: Number(fd.get("rent") || 0),
    });
    setOpen(false);
  };

  return (
    <div className="stack">
      <PageHeader
        kicker="الالتزامات"
        title="إدارة العقود"
        desc="تابع نهاية العقود وجدّدها قبل انتهاء المدة."
        actions={
          <>
            <button className="btn btn-primary" onClick={() => setOpen(true)}>
          إضافة عقد
        </button>
          </>
        }
      />
<div className="list stack-gap">
        {state.contracts.map((c) => {
          const left = daysLeft(c.end);
          const pill =
            left < 0 ? "pill-danger" : left <= 30 ? "pill-warn" : "pill-ok";
          const label = left < 0 ? "منتهي" : left <= 30 ? `متبقي ${left} يوم` : "ساري";
          return (
            <article key={c.id} className="card row-item contract-card">
              <div>
                <div className="title-row">
                  <h3>{c.no}</h3>
                  <span className={`pill ${pill}`}>{label}</span>
                </div>
                <p className="muted">
                  {c.tenant} · {c.unit} · {c.property}
                </p>
                <div className="meta-row">
                  <span>{c.type}</span>
                  <span>ينتهي {formatDate(c.end)}</span>
                  {c.rent > 0 && <span>{sar(c.rent)}</span>}
                </div>
              </div>
              <button className="btn btn-soft" onClick={() => renewContract(c.id)}>
                تجديد سنة
              </button>
            </article>
          );
        })}
      </div>

      <Modal open={open} title="إضافة عقد جديد" onClose={() => setOpen(false)}>
        <form className="form-grid" onSubmit={onAdd}>
          <div className="field">
            <label htmlFor="unit">الوحدة</label>
            <input id="unit" name="unit" required placeholder="شقة 210" />
          </div>
          <div className="field">
            <label htmlFor="property">العقار</label>
            <input id="property" name="property" required placeholder="برج الأعمال" />
          </div>
          <div className="field">
            <label htmlFor="tenant">المستأجر</label>
            <input id="tenant" name="tenant" required placeholder="الاسم" />
          </div>
          <div className="field">
            <label htmlFor="type">نوع العقد</label>
            <select id="type" name="type" defaultValue="إيجار سكني">
              <option>إيجار سكني</option>
              <option>إيجار تجاري</option>
              <option>عقد صيانة</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="end">تاريخ الانتهاء</label>
            <input id="end" name="end" type="date" required />
          </div>
          <div className="field">
            <label htmlFor="rent">قيمة الإيجار السنوي</label>
            <input id="rent" name="rent" type="number" min={0} defaultValue={0} />
          </div>
          <button className="btn btn-primary" type="submit">
            حفظ العقد
          </button>
        </form>
      </Modal>
    </div>
  );
}
