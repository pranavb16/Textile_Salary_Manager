import { useEffect, useState } from "react";
import PayrollApp from "../app/PayrollApp.js";
import { LoginPage } from "./LoginPage.js";
import { currentAuth, refreshAccess, signIn, signOut, subscribeAuth } from "./session.js";

export function AuthShell() {
  const [auth, setAuth] = useState(currentAuth);
  const [checking, setChecking] = useState(true);
  const [signOutError, setSignOutError] = useState("");

  useEffect(() => {
    const unsubscribe = subscribeAuth(setAuth);
    void refreshAccess().catch(() => { setSignOutError("Could not reach the server. Please try again."); }).finally(() => setChecking(false));
    return unsubscribe;
  }, []);

  if (checking) return <main className="login-page"><div className="panel login-panel" role="status">Checking your session…</div></main>;
  if (!auth.session) return <LoginPage message={signOutError || auth.message} onLogin={async (username, password) => { await signIn(username, password); setSignOutError(""); }} />;
  return <PayrollApp username={auth.session.username} onSignOut={async () => { try { setSignOutError(""); await signOut(); } catch (cause) { setSignOutError(cause instanceof Error ? cause.message : "Could not sign out."); } }} signOutError={signOutError} />;
}
