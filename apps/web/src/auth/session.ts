export const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? "/api" : "http://localhost:3001/api");

type Session = { username: string; accessToken: string; accessExpiresAt: string; sessionExpiresAt: string };
type Snapshot = { session: Session | null; message: string };
let snapshot: Snapshot = { session: null, message: "" };
const listeners = new Set<(value: Snapshot) => void>();
let refreshInFlight: Promise<Session | null> | null = null;
let renewalTimer: number | undefined;
let expiryTimer: number | undefined;

export function currentAuth() { return snapshot; }
export function subscribeAuth(listener: (value: Snapshot) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
function publish(value: Snapshot) {
  snapshot = value;
  for (const listener of listeners) listener(value);
}
function clearAuth(message = "") {
  window.clearTimeout(renewalTimer);
  window.clearTimeout(expiryTimer);
  publish({ session: null, message });
}
function remember(session: Session) {
  window.clearTimeout(renewalTimer);
  window.clearTimeout(expiryTimer);
  publish({ session, message: "" });
  const remaining = Date.parse(session.sessionExpiresAt) - Date.now();
  if (remaining <= 0) { clearAuth("Session expired. Please sign in again."); return; }
  expiryTimer = window.setTimeout(() => clearAuth("Session expired. Please sign in again."), remaining);
  const renewal = Date.parse(session.accessExpiresAt) - Date.now() - 60_000;
  if (renewal > 0 && renewal < remaining) renewalTimer = window.setTimeout(() => { void refreshAccess().catch(() => { /* Retried on the next request. */ }); }, renewal);
}
async function authResponse(response: Response) {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(typeof body.message === "string" ? body.message : "Could not sign in. Please try again.");
  }
  return response.json() as Promise<Session>;
}

export async function signIn(username: string, password: string) {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, password }),
  });
  const session = await authResponse(response);
  remember(session);
}

export function refreshAccess(): Promise<Session | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const response = await fetch(`${API_BASE}/auth/refresh`, { method: "POST", credentials: "include" });
      if (response.status === 401) { clearAuth(snapshot.session ? "Session expired. Please sign in again." : ""); return null; }
      const session = await authResponse(response);
      remember(session);
      return session;
    } catch (error) {
      clearAuth("Could not renew your session. Please sign in again.");
      throw error;
    }
  })().finally(() => { refreshInFlight = null; });
  return refreshInFlight;
}

export async function signOut() {
  const response = await fetch(`${API_BASE}/auth/logout`, { method: "POST", credentials: "include" });
  if (!response.ok) throw new Error("Could not sign out. Please try again.");
  clearAuth();
}

export async function authorizedRequest(path: string, init?: RequestInit): Promise<Response> {
  let session = snapshot.session;
  if (!session || Date.parse(session.accessExpiresAt) <= Date.now()) session = await refreshAccess();
  if (!session) throw new Error("Session expired. Please sign in again.");
  const send = (accessToken: string) => fetch(`${API_BASE}${path}`, {
    ...init, credentials: "include", headers: { "content-type": "application/json", ...init?.headers, authorization: `Bearer ${accessToken}` },
  });
  let response = await send(session.accessToken);
  if (response.status === 401) {
    session = await refreshAccess();
    if (!session) throw new Error("Session expired. Please sign in again.");
    response = await send(session.accessToken);
    if (response.status === 401) clearAuth("Session expired. Please sign in again.");
  }
  return response;
}
