import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

export function PageHeader({
  kicker,
  title,
  desc,
  backTo = "/",
  actions,
}: {
  kicker?: string;
  title: string;
  desc?: string;
  backTo?: string;
  actions?: ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <div className="page-head">
      <div className="page-head-main">
        <button className="back-btn" type="button" onClick={() => navigate(backTo)} aria-label="رجوع">
          <ArrowRight size={18} />
          رجوع
        </button>
        {kicker && <div className="section-kicker">{kicker}</div>}
        <h2>{title}</h2>
        {desc && <p className="muted">{desc}</p>}
      </div>
      {actions && <div className="head-actions">{actions}</div>}
    </div>
  );
}
