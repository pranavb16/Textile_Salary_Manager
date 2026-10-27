# Run on Windows

1. Install Node.js and npm, and install the workspace dependencies from PowerShell in this folder:

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

5. Open `http://localhost:5173` in your browser. The API uses `http://localhost:3001/api` and PostgreSQL uses port `5432`.

The frontend runs on the host and reloads when frontend source files change. The API is at `http://localhost:3001/api`. To connect DBeaver from Windows, use PostgreSQL host `localhost`, port `5432`, database `salary_management`, username `salary_app`, and the password in `apps/api/.env`. The DBeaver hostname is `localhost`; keep `db` in `DATABASE_DSN` because that is the hostname Docker containers use to reach each other.

The actual `apps/api/.env` and `apps/web/.env` files are ignored by Git. Commit changes to the `.env.example` files only, and never put real credentials in those examples. To see backend startup output, use `docker compose logs -f api db`. Press Ctrl+C to stop following logs; this does not stop the containers. Stop the Vite frontend separately with Ctrl+C in its terminal.

Stop the containers with `docker compose down`. PostgreSQL data stays in the Docker volume `salary-management_postgres_data` and returns when you start the containers again. **Do not add `-v` to `docker compose down`** unless you want to permanently remove that volume and its data.

The first Docker startup downloads the API and PostgreSQL images, so it may take a few minutes. npm installs frontend packages on the host, and frontend source edits are picked up by Vite without rebuilding a container.

The previous local database was checked during migration: its unit, employee, and payroll tables contained zero rows. The new PostgreSQL database starts empty; add your manufacturing units and workers through the app.
