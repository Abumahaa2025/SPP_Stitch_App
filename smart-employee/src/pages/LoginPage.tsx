import { useState } from "react";
import type { FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useStore } from "../lib/store";
import "./LoginPage.css";

export function LoginPage() {
  const { state, login } = useStore();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  if (state.loggedIn) return <Navigate to="/" replace />;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const ok = login(username, password);
    setError(!ok);
    if (ok) navigate("/");
  };

  return (
    <div className="login-page">
      <div className="login-card card">
        <img src="/agent.png" alt="الموظف العقاري الذكي" className="login-agent" />
        <h1>الموظف العقاري الذكي</h1>
        <p className="muted">سجّل دخولك لإدارة عقاراتك وربطها بمنصة إيجار</p>

        <form onSubmit={onSubmit} className="login-form">
          <div className="field">
            <label htmlFor="username">الجوال أو البريد</label>
            <input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="05xxxxxxxx"
              autoComplete="username"
            />
          </div>
          <div className="field">
            <label htmlFor="password">كلمة المرور</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>
          {error && <div className="login-error">أدخل الجوال وكلمة المرور للمتابعة</div>}
          <button className="btn btn-primary" type="submit">
            تسجيل الدخول
          </button>
        </form>
      </div>
    </div>
  );
}
