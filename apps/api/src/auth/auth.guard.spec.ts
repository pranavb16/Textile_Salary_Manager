import { UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AnnualReportsController } from "../annual-reports/annual-reports.controller.js";
import { EmployeesController } from "../employees/employees.controller.js";
import { PayrollController } from "../payroll/payroll.controller.js";
import { UnitsController } from "../units/units.controller.js";
import { AuthController } from "./auth.controller.js";
import { AuthGuard } from "./auth.guard.js";
import { HealthController } from "./health.controller.js";

function context(controller: Function, handler: Function) {
  return {
    getHandler: () => handler,
    getClass: () => controller,
    switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
  } as never;
}

describe("global authentication guard", () => {
  const auth = { authenticate: async () => { throw new UnauthorizedException(); } };
  const guard = new AuthGuard(auth as never, new Reflector());

  it("requires an access token on every existing payroll and report handler", async () => {
    for (const controller of [UnitsController, EmployeesController, PayrollController, AnnualReportsController]) {
      for (const name of Object.getOwnPropertyNames(controller.prototype).filter((name) => name !== "constructor")) {
        await expect(guard.canActivate(context(controller, controller.prototype[name]))).rejects.toBeInstanceOf(UnauthorizedException);
      }
    }
    await expect(guard.canActivate(context(AuthController, AuthController.prototype.me))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("leaves only authentication bootstrap routes and health public", async () => {
    for (const method of [AuthController.prototype.login, AuthController.prototype.refresh, AuthController.prototype.logout]) {
      await expect(guard.canActivate(context(AuthController, method))).resolves.toBe(true);
    }
    await expect(guard.canActivate(context(HealthController, HealthController.prototype.health))).resolves.toBe(true);
  });
});
