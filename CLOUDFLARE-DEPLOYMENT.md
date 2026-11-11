# Deploy the web app with Cloudflare Pages

The Vite site runs on Cloudflare Pages. Requests from its browser to `/api/*` pass through `functions/api/[[path]].js` to the separately deployed NestJS API. The proxy keeps the refresh cookie on the Pages hostname. It forwards request bodies, query strings, `Origin`, `Authorization`, and `Cookie` headers, and returns the API response, including `Set-Cookie`, without changing it.

## Prepare the API

1. Deploy the API as a Render Node web service from the repository root. Use Node 24 and these commands:

   ```text
   Build: npm ci --include=dev && npm run contracts:build && npm run db:generate --workspace @salary/api && npm run build --workspace @salary/api
   Start: npm run db:migrate --workspace @salary/api && npm run start --workspace @salary/api
   ```

2. Set `DATABASE_DSN` to the production PostgreSQL connection string and `NODE_ENV=production`. The build command uses `npm ci --include=dev` because Nest and Prisma build tools are development dependencies that npm otherwise omits when `NODE_ENV=production`. Render supplies `PORT`. Set `WEB_ORIGIN` to the exact production Pages origin, for example `https://textile-salary-web.pages.dev`. Do not include a trailing slash. Do not use the local Compose database hostname `db` in the production connection string.
3. Run the existing account setup from `LOCAL-SETUP.md` against the production database after migrations complete. If you are moving existing data, back it up and verify the imported row counts before using the production site.

## Configure Pages

1. Connect the same GitHub repository to Cloudflare Pages. Keep the Pages project root at the **repository root** so `functions/` is discovered and npm workspaces can access `packages/contracts`.
2. Set the production branch and these build settings:

   ```text
   Build command: npm run contracts:build && npm run build --workspace @salary/web
   Build output directory: apps/web/dist
   NODE_VERSION: 24
   VITE_API_BASE_URL: /api
   ```

3. Add the Pages environment variable `API_UPSTREAM_ORIGIN=https://YOUR-API.onrender.com`. Use only the HTTPS origin: no `/api`, path, query string, or trailing API endpoint. Configure it separately for preview deployments if you use them.
4. Deploy the latest commit. `apps/web/public/_routes.json` limits Pages Function invocations to `/api/*`; static site requests remain static.
5. If the Pages hostname changed from the value in Render's `WEB_ORIGIN`, update `WEB_ORIGIN` and redeploy the API. Preview hostnames must also be allowed explicitly if you want their login to work.

## Verify after deployment

- `GET https://YOUR-PAGES.pages.dev/api/health` returns 200.
- `GET https://YOUR-PAGES.pages.dev/api/units` without a bearer token returns 401.
- Sign in through the Pages URL. In browser developer tools, confirm the login response sets a `Secure`, `HttpOnly`, `__Host-salary_refresh` cookie for the **Pages hostname**.
- Reload the page, save a test payroll record, and sign out. Confirm refresh works after reload and protected requests return 401 after logout.
- Test once after the free Render service has been idle; its first request can take longer while it wakes.

## Troubleshoot intermittent sign-in errors

The page first calls `POST /api/auth/refresh` to restore an existing session. A 401 on that request when signed out is normal. Other failures can come from Pages, the Render service, origin settings, or the database. The health endpoint checks that the API process responds; it does not verify a database query or the authentication flow.

In browser developer tools, open Network, reload the page, and inspect the refresh request's status and response. Compare `GET /api/health` on the Pages hostname with `GET /api/health` on the Render hostname at the same time, and check Render logs for that time. Never share cookies, tokens, credentials, or database connection strings.

- A Pages 503 saying the API is not configured means `API_UPSTREAM_ORIGIN` is missing or invalid in that Pages environment. A Pages 502 indicates the proxy could not reach the upstream.
- A 403 saying the origin is not allowed means `WEB_ORIGIN` on Render must include the exact browser origin, including scheme and hostname. Configure preview origins separately as needed.
- A 500 on refresh or login requires checking Render logs, including database and migration errors. A successful health check alone does not rule these out.
- If failures occur after inactivity and the Render service uses the free instance type, check its spin-up logs. Render spins free services down after 15 minutes without inbound traffic; startup can take about a minute. A paid instance avoids idle spin-down. Retest both health URLs after it has started.

The API remains a separate public Render service. Its global authentication guard protects payroll and report routes even when a request bypasses the Pages proxy. Keep database credentials only in Render, never in Pages or `VITE_` variables.
