import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { useStore } from "../lib/store";
import "./pages.css";

export function AlertsPage() {
  const {
    state,
    notifyTenantRenewal,
    ownerApproveEjarRenewal,
    submitEjarRenewal,
    resolveAlert,
    refreshOperationalAlerts,
  } = useStore();
  const navigate = useNavigate();

  const openAlerts = state.alerts.filter((a) => !a.resolved);

  const runAction = (type: string, payload?: Record<string, string>) => {
    if (type === "notify_tenant_renewal" && payload?.contractId) {
      notifyTenantRenewal(payload.contractId);
      return;
    }
    if (type === "owner_approve_ejar" && payload?.renewalId) {
      ownerApproveEjarRenewal(payload.renewalId);
      return;
    }
    if (type === "submit_ejar" && payload?.renewalId) {
      submitEjarRenewal(payload.renewalId);
      return;
    }
    if (type === "open_contract") {
      navigate("/contracts");
      return;
    }
    if (type === "open_tenant") {
      navigate("/tenants");
    }
  };

  return (
    <div className="stack">
      <PageHeader
        kicker="التنبيهات"
        title="إدارة التنبيهات والحلول"
        desc="تنبيهات تشغيلية مع اقتراحات وحلول قابلة للتنفيذ — مثل تجديد العقود عبر إيجار."
        actions={
          <button className="btn btn-primary" type="button" onClick={refreshOperationalAlerts}>
            تحديث التنبيهات
          </button>
        }
      />

      <div className="list stack-gap">
        {openAlerts.map((a) => (
          <article key={a.id} className={`card block alert-row alert-${a.level}`}>
            <div style={{ width: "100%" }}>
              <div className="title-row">
                <h3>{a.title}</h3>
                <span className={`pill ${a.level === "danger" ? "pill-danger" : a.level === "warn" ? "pill-warn" : "pill-info"}`}>
                  {a.level === "danger" ? "حرج" : a.level === "warn" ? "مهم" : "معلومة"}
                </span>
              </div>
              <p className="muted">{a.desc}</p>
              {a.suggestion && (
                <p>
                  <strong>الاقتراح:</strong> {a.suggestion}
                </p>
              )}
              <small className="muted">{a.time}</small>
              <div className="head-actions" style={{ marginTop: 12 }}>
                {(a.actions || []).map((act) => (
                  <button
                    key={act.id}
                    type="button"
                    className="btn btn-soft"
                    onClick={() => runAction(act.type, act.payload)}
                  >
                    {act.label}
                  </button>
                ))}
                <button type="button" className="btn btn-ghost" onClick={() => resolveAlert(a.id)}>
                  تم التعامل
                </button>
              </div>
            </div>
          </article>
        ))}
        {!openAlerts.length && (
          <div className="empty card">لا توجد تنبيهات حالياً — أضف عقوداً أو حدّث التنبيهات</div>
        )}
      </div>
    </div>
  );
}
