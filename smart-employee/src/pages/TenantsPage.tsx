import { useMemo, useState } from "react";
import { PageHeader } from "../components/PageHeader";
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
      <PageHeader
        kicker="العلاقات"
        title="سجل المستأجرين"
        desc="عرض سريع لحالة العقود والمدفوعات المرتبطة بكل مستأجر."
      />
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
                {t.email && <span>{t.email}</span>}
                {t.nationalId && <span>هوية {t.nationalId}</span>}
                {t.deposit ? <span>تأمين {sar(t.deposit)}</span> : null}
              </div>
              {t.notes && <small className="muted">ملاحظة: {t.notes}</small>}
            </div>
          </article>
        ))}
        {!list.length && <div className="empty card">لا يوجد مستأجرون مطابقون</div>}
      </div>
    </div>
  );
}
