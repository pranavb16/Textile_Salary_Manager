import assert from "node:assert/strict";
import { test } from "node:test";
import { waitForApi } from "../apps/web/src/auth/wait-for-api.ts";

async function withFetch(mock, run) {
  const original = globalThis.fetch;
  globalThis.fetch = mock;
  try { await run(); } finally { globalThis.fetch = original; }
}

test("waits through gateway and network failures until the API is ready", async () => {
  let calls = 0;
  await withFetch(async (url, init) => {
    assert.equal(url, "/api/health");
    assert.equal(init.cache, "no-store");
    calls++;
    if (calls === 1) return new Response("Starting", { status: 502 });
    if (calls === 2) throw new TypeError("Network error");
    return Response.json({ status: "ok" });
  }, () => waitForApi("/api", new AbortController().signal, { retryDelayMs: 0 }));
  assert.equal(calls, 3);
});

test("reports permanent configuration errors without retrying", async () => {
  await withFetch(async () => new Response(null, { status: 403 }), () =>
    assert.rejects(waitForApi("/api", new AbortController().signal), /403/));
});

test("does not treat a static HTML page as a ready API", async () => {
  await withFetch(async () => new Response("<html>"), () =>
    assert.rejects(waitForApi("/api", new AbortController().signal)));
});

test("allows a new attempt after a bounded startup wait", async () => {
  await withFetch(async () => new Response(null, { status: 503 }), () =>
    assert.rejects(waitForApi("/api", new AbortController().signal, { timeoutMs: 20, retryDelayMs: 1 }), /taking longer/));
});

test("stops polling when the checking screen unmounts", async () => {
  const controller = new AbortController();
  let calls = 0;
  await withFetch(async () => { calls++; controller.abort(); return new Response(null, { status: 502 }); }, () =>
    assert.rejects(waitForApi("/api", controller.signal, { retryDelayMs: 0 }), { name: "AbortError" }));
  assert.equal(calls, 1);
});
