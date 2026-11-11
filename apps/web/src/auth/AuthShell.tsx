import { useEffect, useState } from "react";
import PayrollApp from "../app/PayrollApp.js";
import { LoginPage } from "./LoginPage.js";
import { API_BASE, currentAuth, refreshAccess, signIn, signOut, subscribeAuth } from "./session.js";
import { waitForApi } from "./wait-for-api.js";

export function AuthShell() {
  const [auth, setAuth] = useState(currentAuth);
  const [checking, setChecking] = useState(true);
  const [signOutError, setSignOutError] = useState("");
  const [checkAttempt, setCheckAttempt] = useState(0);

  useEffect(() => {
    const unsubscribe = subscribeAuth(setAuth);
    const controller = new AbortController();
    setChecking(true);
    setSignOutError("");
    void waitForApi(API_BASE, controller.signal).then(() => refreshAccess()).catch((cause: unknown) => {
      if (controller.signal.aborted) return;
      setSignOutError(cause instanceof TypeError ? "Could not reach the server. Check your connection and try again." : cause instanceof Error ? cause.message : "Could not check your session. Please try again.");
    }).finally(() => { if (!controller.signal.aborted) setChecking(false); });
    return () => { controller.abort(); unsubscribe(); };
  }, [checkAttempt]);

  if (checking) return <main className="login-page"><div className="panel login-panel" role="status">Checking your session…</div></main>;
  if (!auth.session && signOutError) return <main className="login-page"><div className="panel login-panel"><p role="alert">{signOutError}</p><button className="button button-primary" onClick={() => setCheckAttempt((attempt) => attempt + 1)}>Try again</button></div></main>;
  if (!auth.session) return <LoginPage message={auth.message} onLogin={async (username, password) => { await signIn(username, password); setSignOutError(""); }} />;
  return <PayrollApp username={auth.session.username} onSignOut={async () => { try { setSignOutError(""); await signOut(); } catch (cause) { setSignOutError(cause instanceof Error ? cause.message : "Could not sign out."); } }} signOutError={signOutError} />;
}
