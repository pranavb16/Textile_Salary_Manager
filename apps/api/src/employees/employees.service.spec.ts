import { jest } from "@jest/globals";
import { NotFoundException } from "@nestjs/common";
import { EmployeesService } from "./employees.service.js";

describe("EmployeesService", () => {
  const prisma = { unit: { findUnique: jest.fn() }, employee: { create: jest.fn(), findMany: jest.fn() } };
  let service: EmployeesService;
  beforeEach(() => { jest.clearAllMocks(); service = new EmployeesService(prisma as never); });

  it("refuses to assign an employee to a missing unit", async () => {
    prisma.unit.findUnique.mockResolvedValue(null);
    await expect(service.createEmployeeRecord({ name: "Worker", unitId: 99, employeeCode: null, startingAdvanceBalance: "0" })).rejects.toBeInstanceOf(NotFoundException);
  });

  it("filters active employee records by unit", async () => {
    prisma.employee.findMany.mockResolvedValue([]);
    await service.findEmployeeByUnit(3);
    expect(prisma.employee.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { active: true, unitId: 3 } }));
  });
});
