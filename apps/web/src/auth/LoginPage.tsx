import { useState, type FormEvent } from "react";
import { Building2, Eye, EyeOff, LockKeyhole, LogIn } from "lucide-react";

export function LoginPage({ message, onLogin }: { message: string; onLogin: (username: string, password: string) => Promise<void> }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    try { await onLogin(username.trim(), password); setPassword(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not sign in."); }
    finally { setBusy(false); }
  }

  return <main className="login-page">
    <div className="login-brand"><span className="brand-icon"><Building2 size={22} /></span><div><strong>Textile Salary Manager</strong><small>Monthly payroll · Manufacturing units</small></div></div>
    <section className="panel login-panel" aria-labelledby="login-title">
      <span className="login-symbol"><LockKeyhole size={22} /></span>
      <span className="eyebrow">SECURE ACCESS</span>
      <h1 id="login-title">Sign in</h1>
      <p>Enter your account details to manage payroll and reports.</p>
      {(error || message) && <div className="alert alert-error" role="alert">{error || message}</div>}
      <form onSubmit={(event) => void submit(event)}>
        <label htmlFor="login-username">Username</label>
        <input id="login-username" autoComplete="username" required maxLength={100} value={username} onChange={(event) => setUsername(event.target.value)} autoFocus />
        <label htmlFor="login-password">Password</label>
        <div className="password-input-wrap">
          <input id="login-password" type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
          <button className="password-toggle" type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)}>
            {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
          </button>
        </div>
        <button className="button button-primary" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}<LogIn size={17} /></button>
      </form>
    </section>
  </main>;
}
