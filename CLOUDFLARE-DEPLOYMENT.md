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

The API remains a separate public Render service. Its global authentication guard protects payroll and report routes even when a request bypasses the Pages proxy. Keep database credentials only in Render, never in Pages or `VITE_` variables.
