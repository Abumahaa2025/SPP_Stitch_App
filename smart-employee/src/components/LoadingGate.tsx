import { useStore } from "../lib/store";
import "./LoadingGate.css";

export function LoadingGate({ children }: { children: React.ReactNode }) {
  const { loading, ready } = useStore();
  if (loading || !ready) {
    return (
      <div className="loading-gate" role="status" aria-live="polite">
        <div className="loading-card card">
          <img src="/agent.png" alt="" className="loading-avatar" />
          <h1>الموظف العقاري الذكي</h1>
          <p className="muted">جاري تحميل البيانات من قاعدة البيانات...</p>
          <div className="loading-bar" aria-hidden>
            <span />
          </div>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
