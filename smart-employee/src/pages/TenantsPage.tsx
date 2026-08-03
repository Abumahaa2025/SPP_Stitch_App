import { useMemo, useState } from "react";
import { useStore } from "../lib/store";
import { sar } from "../lib/format";
import "./pages.css";

function tenantPill(status: string) {
  if (status === "نشط") return "pill-ok";
  if (status === "متأخر") return "pill-danger";
  return "pill-muted";
}

export function TenantsPage() {
  const { state } = useStore();
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    const query = q.trim();
    return state.tenants.filter(
      (t) =>
        !query ||
        t.name.includes(query) ||
        t.unit.includes(query) ||
        t.contractNo.includes(query),
    );
  }, [state.tenants, q]);

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <div className="section-kicker">العلاقات</div>
          <h2>سجل المستأجرين</h2>
          <p className="muted">عرض سريع لحالة العقود والمدفوعات المرتبطة بكل مستأجر.</p>
        </div>
      </div>

      <div className="card block">
        <div className="field">
          <label htmlFor="tenant-search">بحث</label>
          <input
            id="tenant-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="اسم المستأجر أو الوحدة أو رقم العقد"
          />
        </div>
      </div>

      <div className="list stack-gap">
        {list.map((t) => (
          <article key={t.id} className="card row-item">
            <div>
              <div className="title-row">
                <h3>{t.name}</h3>
                <span className={`pill ${tenantPill(t.status)}`}>{t.status}</span>
              </div>
              <p className="muted">
                {t.unit} · {t.contractNo}
              </p>
              <div className="meta-row">
                <span>{t.phone}</span>
                <strong>{sar(t.rent)}</strong>
              </div>
            </div>
          </article>
        ))}
        {!list.length && <div className="empty card">لا يوجد مستأجرون مطابقون</div>}
      </div>
    </div>
  );
}
