CREATE TABLE "units" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "employees" (
    "id" SERIAL NOT NULL,
    "unit_id" INTEGER NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "employee_code" VARCHAR(40),
    "starting_advance_balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payroll_records" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "period" DATE NOT NULL,
    "total_days" INTEGER NOT NULL,
    "shift_8_days" INTEGER NOT NULL,
    "shift_12_days" INTEGER NOT NULL,
    "shift_8_rate" DECIMAL(14,2) NOT NULL,
    "shift_12_rate" DECIMAL(14,2) NOT NULL,
    "salary_earned" DECIMAL(14,2) NOT NULL,
    "cash_paid" DECIMAL(14,2) NOT NULL,
    "bank_paid" DECIMAL(14,2) NOT NULL,
    "advance_requested" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "opening_balance" DECIMAL(14,2) NOT NULL,
    "closing_balance" DECIMAL(14,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "payroll_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "units_name_key" ON "units"("name");
CREATE UNIQUE INDEX "employees_unit_id_employee_code_key" ON "employees"("unit_id", "employee_code");
CREATE INDEX "employees_unit_id_active_name_idx" ON "employees"("unit_id", "active", "name");
CREATE UNIQUE INDEX "payroll_records_employee_id_period_key" ON "payroll_records"("employee_id", "period");
CREATE INDEX "payroll_records_period_employee_id_idx" ON "payroll_records"("period", "employee_id");

ALTER TABLE "employees" ADD CONSTRAINT "employees_unit_id_fkey"
  FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payroll_records" ADD CONSTRAINT "payroll_records_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
