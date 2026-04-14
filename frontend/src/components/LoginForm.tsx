"use client";

import { useState } from "react";
import { useLang } from "@/lib/i18nContext";

type LoginFormProps = {
  onLogin: () => void;
};

const KanbanIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="18" rx="1" />
    <rect x="14" y="3" width="7" height="10" rx="1" />
    <rect x="14" y="17" width="7" height="4" rx="1" />
  </svg>
);

export const LoginForm = ({ onLogin }: LoginFormProps) => {
  const { lang, t, toggleLang } = useLang();
  const [mode, setMode] = useState<"login" | "register">("login");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");
  const [regDisplayName, setRegDisplayName] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const switchMode = (m: "login" | "register") => {
    setMode(m);
    setError("");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (data.success) {
        localStorage.setItem("loggedIn", "true");
        localStorage.setItem("authToken", data.token);
        localStorage.setItem("userId", String(data.user_id));
        onLogin();
      } else {
        setError(t.invalidCredentials);
      }
    } catch {
      setError(t.cannotReachServer);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (regPassword !== regConfirm) { setError(t.passwordsDoNotMatch); return; }
    if (regPassword.length < 6) { setError(t.passwordTooShort); return; }
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: regUsername, password: regPassword, display_name: regDisplayName }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        localStorage.setItem("loggedIn", "true");
        localStorage.setItem("authToken", data.token);
        localStorage.setItem("userId", String(data.user_id));
        onLogin();
      } else {
        setError(data.detail || t.registrationFailed);
      }
    } catch {
      setError(t.cannotReachServer);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "rounded-xl border border-[var(--stroke)] bg-[var(--surface-strong)] px-4 py-3 text-sm text-[var(--navy-dark)] outline-none placeholder:text-[var(--gray-text)]/60 focus:border-[var(--primary-blue)] focus:ring-2 focus:ring-[var(--primary-blue)]/20 transition";
  const labelClass = "text-sm font-semibold text-[var(--navy-dark)]";

  return (
    <div className="flex min-h-screen">
      {/* Left panel — brand */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-[var(--navy-dark)] p-12 lg:flex">
        <div className="pointer-events-none absolute left-0 top-0 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.35)_0%,_rgba(32,157,215,0.08)_55%,_transparent_70%)]" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-[600px] w-[600px] translate-x-1/3 translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(117,57,145,0.4)_0%,_rgba(117,57,145,0.1)_55%,_transparent_75%)]" />
        <div className="pointer-events-none absolute bottom-1/3 left-1/4 h-[200px] w-[200px] rounded-full bg-[radial-gradient(circle,_rgba(236,173,10,0.2)_0%,_transparent_70%)]" />

        <div className="relative flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--primary-blue)]">
            <KanbanIcon />
          </div>
          <span className="font-display text-lg font-semibold text-white">{t.appName}</span>
        </div>

        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--primary-blue)]">
            {t.projectManagement}
          </p>
          <h1 className="mt-4 font-display text-5xl font-semibold leading-tight text-white whitespace-pre-line">
            {t.tagline}
          </h1>
          <p className="mt-5 max-w-sm text-base leading-7 text-white/60">{t.taglineDesc}</p>
          <div className="mt-10 flex flex-wrap gap-3">
            {[t.featMultipleBoards, t.featDragDrop, t.featAI, t.featDarkMode].map((f) => (
              <span key={f} className="rounded-full border border-white/15 bg-white/8 px-4 py-1.5 text-sm font-medium text-white/70">{f}</span>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="h-px w-12 bg-[var(--accent-yellow)]" />
          <p className="mt-4 text-sm text-white/40">{t.taglineFooter}</p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 flex-col items-center justify-center bg-[var(--surface)] px-8 py-12">
        {/* Top bar: mobile logo + lang toggle */}
        <div className="mb-8 flex w-full max-w-sm items-center justify-between">
          <div className="flex items-center gap-3 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--primary-blue)]">
              <KanbanIcon />
            </div>
            <span className="font-display text-lg font-semibold text-[var(--navy-dark)]">{t.appName}</span>
          </div>
          <div className="hidden lg:block" />
          <button
            type="button"
            onClick={toggleLang}
            className="rounded-lg border border-[var(--stroke)] bg-[var(--surface-strong)] px-3 py-1.5 text-xs font-semibold text-[var(--navy-dark)] transition hover:border-[var(--primary-blue)] hover:text-[var(--primary-blue)]"
          >
            {lang === "en" ? "VI" : "EN"}
          </button>
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-7">
            <h2 className="font-display text-2xl font-semibold text-[var(--navy-dark)]">
              {mode === "login" ? t.signIn : t.createAccount}
            </h2>
            <p className="mt-1.5 text-sm text-[var(--gray-text)]">
              {mode === "login" ? t.noAccount : t.hasAccount}{" "}
              <button
                type="button"
                onClick={() => switchMode(mode === "login" ? "register" : "login")}
                className="font-semibold text-[var(--primary-blue)] hover:underline"
              >
                {mode === "login" ? t.register : t.signIn}
              </button>
            </p>
          </div>

          {error && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
              {error}
            </div>
          )}

          {mode === "login" ? (
            <form onSubmit={handleLogin} className="flex flex-col gap-4" data-testid="login-form">
              <div className="flex flex-col gap-1.5">
                <label className={labelClass}>{t.username}</label>
                <input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                  placeholder={t.usernamePlaceholder} className={inputClass} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelClass}>{t.password}</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder={t.passwordPlaceholder} className={inputClass} required />
              </div>
              <button type="submit" disabled={loading}
                className="mt-2 rounded-xl bg-[var(--navy-dark)] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-85 disabled:opacity-60">
                {loading ? t.signingIn : t.signIn}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="flex flex-col gap-4" data-testid="register-form">
              <div className="flex flex-col gap-1.5">
                <label className={labelClass}>{t.username}</label>
                <input type="text" value={regUsername} onChange={(e) => setRegUsername(e.target.value)}
                  placeholder={t.usernamePlaceholder} className={inputClass} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelClass}>{t.displayName} <span className="font-normal text-[var(--gray-text)]">{t.displayNameOptional}</span></label>
                <input type="text" value={regDisplayName} onChange={(e) => setRegDisplayName(e.target.value)}
                  placeholder={t.displayNamePlaceholder} className={inputClass} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelClass}>{t.password}</label>
                <input type="password" value={regPassword} onChange={(e) => setRegPassword(e.target.value)}
                  placeholder={t.passwordPlaceholder} className={inputClass} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelClass}>{t.confirmPassword}</label>
                <input type="password" value={regConfirm} onChange={(e) => setRegConfirm(e.target.value)}
                  placeholder={t.confirmPasswordPlaceholder} className={inputClass} required />
              </div>
              <button type="submit" disabled={loading}
                className="mt-2 rounded-xl bg-[var(--primary-blue)] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-85 disabled:opacity-60">
                {loading ? t.creatingAccount : t.createAccount}
              </button>
            </form>
          )}

          <div className="mt-8 flex items-center gap-3">
            <div className="h-px flex-1 bg-[var(--stroke)]" />
            <span className="text-xs text-[var(--gray-text)]">{t.securedLocally}</span>
            <div className="h-px flex-1 bg-[var(--stroke)]" />
          </div>
        </div>
      </div>
    </div>
  );
};
