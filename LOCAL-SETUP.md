# Run on Windows

1. Install Node.js 24.7 or newer and npm, and install the workspace dependencies from PowerShell in this folder:

   ```powershell
   npm ci
   ```

2. Create local environment files if they do not already exist:

   ```powershell
   Copy-Item apps/api/.env.example apps/api/.env
   Copy-Item apps/web/.env.example apps/web/.env
   ```

   In `apps/api/.env`, use the same password for `POSTGRES_PASSWORD` and in `DATABASE_DSN`. Keep the DSN hostname `db`; it lets the API container reach PostgreSQL.

3. Open Docker Desktop and start PostgreSQL and the API:

   ```powershell
   docker compose up -d --build
   ```

4. In a separate PowerShell terminal, start the frontend directly on Windows:

   ```powershell
   npm run dev
   ```

5. Configure the single login account below, then open `http://localhost:5173` in your browser. The API uses `http://localhost:3001/api` and PostgreSQL uses port `5432`.

## Configure the login account

The database password in `apps/api/.env` is for PostgreSQL. It is separate from the website login password. The auth migration creates an empty `auth_accounts` table; the website cannot be accessed until you add the one account.

1. In an interactive PowerShell terminal, run `npm run auth:hash --workspace @salary/api`. Enter and confirm a password of at least 6 characters. The command hides your input and prints an Argon2id hash. Keep the password somewhere safe; it cannot be recovered from the hash. A longer unique password is safer.
2. In DBeaver connected to `salary_management`, run this SQL after replacing the example hash with the generated value. The example username is `admin`; you may choose another username.

   ```sql
   INSERT INTO auth_accounts (id, username, password_hash, updated_at)
   VALUES (1, 'admin', '<paste-generated-argon2id-hash>', NOW());
   ```

3. Sign in with that username and the password you entered in the hash command. The database enforces `id = 1`, so a second account cannot be inserted.

To change the username and password, generate a new hash with the same command and run the following SQL in DBeaver. Replace `new_username` and the hash with your chosen values. Use `admin` as the username if you only want to change the password. The transaction changes both values together, revokes all current sessions, and clears a current 15-minute lockout.

```sql
BEGIN;
UPDATE auth_accounts
SET username = 'new_username',
    password_hash = '<paste-new-argon2id-hash>',
    failed_attempts = 0,
    locked_until = NULL,
    updated_at = NOW()
WHERE id = 1;
DELETE FROM auth_sessions;
COMMIT;
```

Five consecutive wrong passwords lock the account for 15 minutes. A correct login resets the count. Access tokens expire after one hour and refresh automatically while the 24-hour login period remains; at 24 hours, the website requires a new login. Separate devices may be signed in at the same time.

For production, serve the web app and API from the same HTTPS site with `/api` routed to NestJS. The production web build defaults to `/api`; set `VITE_API_BASE_URL` at build time only if you use another URL. Configure `WEB_ORIGIN` to the exact web origin and set `NODE_ENV=production` for the API so refresh cookies require HTTPS. If a trusted reverse proxy forwards client IP addresses, set `TRUST_PROXY_HOPS` to its exact hop count so the IP login limit uses the client IP. Do not expose the production app over plain HTTP.

The frontend runs on the host and reloads when frontend source files change. The API is at `http://localhost:3001/api`. To connect DBeaver from Windows, use PostgreSQL host `localhost`, port `5432`, database `salary_management`, username `salary_app`, and the password in `apps/api/.env`. The DBeaver hostname is `localhost`; keep `db` in `DATABASE_DSN` because that is the hostname Docker containers use to reach each other.

The actual `apps/api/.env` and `apps/web/.env` files are ignored by Git. Commit changes to the `.env.example` files only, and never put real credentials in those examples. To see backend startup output, use `docker compose logs -f api db`. Press Ctrl+C to stop following logs; this does not stop the containers. Stop the Vite frontend separately with Ctrl+C in its terminal.

Stop the containers with `docker compose down`. PostgreSQL data stays in the Docker volume `salary-management_postgres_data` and returns when you start the containers again. **Do not add `-v` to `docker compose down`** unless you want to permanently remove that volume and its data.

The first Docker startup downloads the API and PostgreSQL images, so it may take a few minutes. npm installs frontend packages on the host, and frontend source edits are picked up by Vite without rebuilding a container.

The previous local database was checked during migration: its unit, employee, and payroll tables contained zero rows. The new PostgreSQL database starts empty; add your manufacturing units and workers through the app.
