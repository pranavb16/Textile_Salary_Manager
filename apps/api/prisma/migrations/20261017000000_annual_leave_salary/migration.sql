CREATE TABLE "annual_leave_salaries" (
    "id" SERIAL NOT NULL,
    "employee_id" INTEGER NOT NULL,
    "start_period" DATE NOT NULL,
    "end_period" DATE NOT NULL,
    "record_count" INTEGER NOT NULL,
    "total_leaves" INTEGER NOT NULL,
    "per_day_salary" DECIMAL(14,2) NOT NULL,
    "leave_salary" DECIMAL(14,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "annual_leave_salaries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "annual_leave_salaries_employee_id_start_period_end_period_key" ON "annual_leave_salaries"("employee_id", "start_period", "end_period");
CREATE INDEX "annual_leave_salaries_start_period_end_period_idx" ON "annual_leave_salaries"("start_period", "end_period");
ALTER TABLE "annual_leave_salaries" ADD CONSTRAINT "annual_leave_salaries_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
