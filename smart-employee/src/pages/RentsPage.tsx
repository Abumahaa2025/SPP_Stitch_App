import { PageHeader } from "../components/PageHeader";
import { useStore } from "../lib/store";
import { formatDate, sar } from "../lib/format";
import "./pages.css";

function rentPill(status: string) {
  if (status === "مدفوع") return "pill-ok";
  if (status === "متأخر") return "pill-danger";
  return "pill-warn";
}

export function RentsPage() {
  const { state } = useStore();
  return (
    <div className="stack">
      <PageHeader
        kicker="التحصيل"
        title="الإيجارات والدفعات"
        desc="متابعة دفعات الإيجار وحالات التحصيل من قاعدة البيانات."
      />
      <div className="list stack-gap">
        {state.rents.map((r) => (
          <article key={r.id} className="card row-item">
            <div>
              <div className="title-row">
                <h3>{r.tenant}</h3>
                <span className={`pill ${rentPill(r.status)}`}>{r.status}</span>
              </div>
              <p className="muted">
                {r.property} · {r.contractNo}
              </p>
              <div className="meta-row">
                <strong>{sar(r.amount)}</strong>
                <span>استحقاق {formatDate(r.dueDate)}</span>
                {r.method && <span>{r.method}</span>}
              </div>
            </div>
          </article>
        ))}
        {!state.rents.length && <div className="empty card">لا توجد دفعات إيجار</div>}
      </div>
    </div>
  );
}
