// Cloudflare Pages routes this function only for requests under /api/.
export async function onRequest({ request, env }) {
  let upstream;
  try {
    upstream = new URL(env.API_UPSTREAM_ORIGIN);
    if (upstream.protocol !== "https:" || upstream.username || upstream.password || upstream.pathname !== "/" || upstream.search || upstream.hash) {
      throw new Error("API_UPSTREAM_ORIGIN must be an HTTPS origin");
    }
  } catch {
    return new Response(JSON.stringify({ message: "The API is not configured." }), {
      status: 503,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  }

  const incoming = new URL(request.url);
  if (!incoming.pathname.startsWith("/api/")) return new Response(null, { status: 404 });
  const target = new URL(`${incoming.pathname}${incoming.search}`, upstream);
  const forwarded = new Request(target, request);

  // Let the outbound connection supply its own transport and host headers.
  for (const name of ["host", "connection", "content-length", "transfer-encoding", "keep-alive", "proxy-connection", "te", "trailer", "upgrade"]) {
    forwarded.headers.delete(name);
  }

  try {
    // Return the response unchanged so Set-Cookie, status, and no-store survive.
    return await fetch(forwarded, { redirect: "manual" });
  } catch {
    return new Response(JSON.stringify({ message: "The API is temporarily unavailable. Please try again." }), {
      status: 502,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  }
}
