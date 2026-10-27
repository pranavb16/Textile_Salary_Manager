import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env.DATABASE_DSN ?? process.env.DATABASE_URL ?? "postgresql://salary_app:local_dev_password@localhost:5432/salary_management?schema=public" },
});
