# Textile Salary Management

A local web app for monthly worker payroll, organized by manufacturing unit. The backend uses NestJS modules and Prisma, the database uses PostgreSQL, and the frontend uses React, Vite, and shared Zod validation contracts.

## Start locally

Install dependencies once, and create the local environment files if they do not exist:

```powershell
npm ci
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env
```

Start PostgreSQL and the API in Docker:

```powershell
docker compose up -d --build
```

In a separate terminal, start the frontend on the host:

```powershell
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The API is at `http://localhost:3001/api`. Stop the frontend with Ctrl+C and stop the API/database containers with `docker compose down`; this keeps the PostgreSQL volume and its payroll data. Do not use `docker compose down -v` unless you intend to erase the database.

See [LOCAL-SETUP.md](LOCAL-SETUP.md) for launch, stop, and data notes.

## Project layout

- `apps/api`: NestJS controllers, services, modules, specs, Prisma schema, and migrations.
- `apps/web`: React payroll interface, Vite configuration, and styles.
- `packages/contracts`: shared Zod schemas and TypeScript types used by the API and UI.
- `docker-compose.yml`: local PostgreSQL and API services; the Vite frontend runs directly on the host; no hosting or publishing is configured.

## Payroll rules

- Payroll is unique per worker and month. Workers are selected from the chosen unit.
- For regular payroll entries, working days and shift days are whole numbers; no calendar-month maximum is imposed. The 8-hour and 12-hour shift days must add up to total working days, and earned salary is the sum of each shift's days multiplied by its rate.
- For a Mender entry, select the Mender checkbox and enter the metres mended and the rate in paise per metre. Salary in rupees is metres multiplied by the rate and divided by 100, rounded to the nearest paisa. The monthly report shows a dash for days.
- Cash and bank payments are recorded separately. Unpaid salary reduces an outstanding advance or becomes a negative held-salary balance carried forward. A requested new advance increases the outstanding balance.
- Editing a historical month recalculates later balances for that worker in the same database transaction.

## Annual Salary Report

Open the **Annual Salary Report** tab, choose a unit and a start month within the 15 calendar months ending at that unit's latest saved payroll month, then select **Calculate Leave Salary**. Workers with at least one payroll record in the period appear. Leave days default to 1 for 1–3 records, 2 for 4–8 records, or 3 for 9 or more records; you can edit the number of days. Enter a whole-number per-day salary for each worker and select **Save Data** before **Generate Report**.

The report adds stored salary earned for each worker across the inclusive period. It shows each worker's closing advance from their latest payroll record in that period. Enter positive regular and Mender bonus rates up to 100%. The Mender rate applies to workers whose names end with the word “Mender”; the regular rate applies to the other workers. Both fields start blank whenever a unit is selected. Diwali Bonus is the applicable rate applied to salary earned, rounded to two decimal places. Earned Leave Salary is saved leave days × per-day salary. Final Bonus is their sum, rounded to the nearest whole rupee (50 paise rounds up); the report total sums those rounded worker amounts. **Print / Save PDF** uses the browser's print dialog. When a new payroll month extends the period, the prior per-day rates are carried forward for review and leave data must be saved again.

## Build and specs

```powershell
npm ci
npm run build
npm test
```

These commands require the workspace dependencies on the host. The Docker workflow installs its own locked dependencies in the containers.
