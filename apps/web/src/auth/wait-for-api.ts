// Probe a read-only endpoint while the hosted API starts, before rotating a session cookie.
export async function waitForApi(base: string, signal: AbortSignal, options: { timeoutMs?: number; retryDelayMs?: number } = {}) {
  const deadline = AbortSignal.timeout(options.timeoutMs ?? 90_000);
  const lifetime = AbortSignal.any([signal, deadline]);
  try {
    while (true) {
      lifetime.throwIfAborted();
      try {
        const response = await fetch(`${base}/health`, {
          cache: "no-store", signal: AbortSignal.any([lifetime, AbortSignal.timeout(10_000)]),
        });
        if (response.ok) {
          const body = await response.json();
          if (body?.status === "ok") return;
          throw new Error("The API health endpoint returned an unexpected response.");
        }
        if (![502, 503, 504].includes(response.status)) {
          throw new Error(`Could not check server availability (${response.status}).`);
        }
      } catch (error) {
        lifetime.throwIfAborted();
        if (!(error instanceof TypeError) && !(error instanceof DOMException && error.name === "TimeoutError")) throw error;
      }
      await new Promise<void>((resolve, reject) => {
        const abort = () => { clearTimeout(timer); reject(lifetime.reason); };
        const timer = setTimeout(() => { lifetime.removeEventListener("abort", abort); resolve(); }, options.retryDelayMs ?? 3_000);
        lifetime.addEventListener("abort", abort, { once: true });
        if (lifetime.aborted) abort();
      });
    }
  } catch (error) {
    if (signal.aborted) throw error;
    if (deadline.aborted) throw new Error("The server is taking longer than expected to start. Please try again.");
    throw error;
  }
}
