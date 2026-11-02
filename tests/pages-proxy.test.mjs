import assert from "node:assert/strict";
import { test } from "node:test";
import { onRequest } from "../functions/api/[[path]].js";

const env = { API_UPSTREAM_ORIGIN: "https://textile-salary-api.onrender.com" };

async function withFetch(mock, run) {
  const original = globalThis.fetch;
  globalThis.fetch = mock;
  try { await run(); }
  finally { globalThis.fetch = original; }
}

test("forwards login body and origin, then returns the secure refresh cookie", async () => {
  const request = new Request("https://textile-salary-web.pages.dev/api/auth/login", {
    method: "POST",
    headers: { origin: "https://textile-salary-web.pages.dev", "content-type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "example" }),
  });
  await withFetch(async (forwarded, options) => {
    assert.equal(forwarded.url, "https://textile-salary-api.onrender.com/api/auth/login");
    assert.equal(forwarded.method, "POST");
    assert.equal(forwarded.headers.get("origin"), "https://textile-salary-web.pages.dev");
    assert.deepEqual(await forwarded.json(), { username: "admin", password: "example" });
    assert.equal(options.redirect, "manual");
    return new Response("{}", {
      status: 200,
      headers: {
        "set-cookie": "__Host-salary_refresh=secret; HttpOnly; Secure; SameSite=Lax; Path=/",
        "cache-control": "no-store",
      },
    });
  }, async () => {
    const response = await onRequest({ request, env });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("set-cookie"), /^__Host-salary_refresh=/);
    assert.equal(response.headers.get("cache-control"), "no-store");
  });
});

test("forwards protected requests with query parameters, token, and cookie", async () => {
  const request = new Request("https://textile-salary-web.pages.dev/api/payroll?unitId=1&period=2026-11", {
    headers: { authorization: "Bearer access-token", cookie: "__Host-salary_refresh=secret" },
  });
  await withFetch(async (forwarded) => {
    assert.equal(forwarded.url, "https://textile-salary-api.onrender.com/api/payroll?unitId=1&period=2026-11");
    assert.equal(forwarded.headers.get("authorization"), "Bearer access-token");
    assert.equal(forwarded.headers.get("cookie"), "__Host-salary_refresh=secret");
    return new Response("Unauthorized", { status: 401 });
  }, async () => {
    const response = await onRequest({ request, env });
    assert.equal(response.status, 401);
  });
});

test("passes logout's cookie deletion back to the browser", async () => {
  const request = new Request("https://textile-salary-web.pages.dev/api/auth/logout", {
    method: "POST",
    headers: { origin: "https://textile-salary-web.pages.dev", cookie: "__Host-salary_refresh=secret" },
  });
  await withFetch(async (forwarded) => {
    assert.equal(forwarded.method, "POST");
    assert.equal(forwarded.headers.get("cookie"), "__Host-salary_refresh=secret");
    return new Response(null, {
      status: 204,
      headers: { "set-cookie": "__Host-salary_refresh=; Max-Age=0; HttpOnly; Secure; SameSite=Lax; Path=/" },
    });
  }, async () => {
    const response = await onRequest({ request, env });
    assert.equal(response.status, 204);
    assert.match(response.headers.get("set-cookie"), /Max-Age=0/);
  });
});

test("rejects an invalid upstream and reports an unavailable API", async () => {
  const request = new Request("https://textile-salary-web.pages.dev/api/health");
  const invalid = await onRequest({ request, env: { API_UPSTREAM_ORIGIN: "http://internal.example" } });
  assert.equal(invalid.status, 503);

  await withFetch(async () => { throw new Error("Connection failed"); }, async () => {
    const unavailable = await onRequest({ request, env });
    assert.equal(unavailable.status, 502);
    assert.equal(unavailable.headers.get("cache-control"), "no-store");
  });
});
