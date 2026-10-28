ALTER TABLE "payroll_records"
  ADD COLUMN "is_mender" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "mending_metres" DECIMAL(14,2),
  ADD COLUMN "mending_rate" DECIMAL(14,2);
