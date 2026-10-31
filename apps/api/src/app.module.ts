import { Module } from "@nestjs/common";
import { AnnualReportsModule } from "./annual-reports/annual-reports.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { EmployeesModule } from "./employees/employees.module.js";
import { PayrollModule } from "./payroll/payroll.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";
import { UnitsModule } from "./units/units.module.js";

@Module({ imports: [PrismaModule, AuthModule, UnitsModule, EmployeesModule, PayrollModule, AnnualReportsModule] })
export class AppModule {}
