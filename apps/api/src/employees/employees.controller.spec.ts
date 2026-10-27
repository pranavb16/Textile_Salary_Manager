import { jest } from "@jest/globals";
import { CreateEmployeeDto } from "./dto/create-employee.dto.js";
import { EmployeesController } from "./employees.controller.js";

describe("EmployeesController", () => {
  const employees = {
    findEmployeeByUnit: jest.fn<(...args: any[]) => Promise<unknown>>(),
    createEmployeeRecord: jest.fn<(input: CreateEmployeeDto) => Promise<unknown>>(),
  };
  let controller: EmployeesController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new EmployeesController(employees as never);
  });

  it("delegates the GET request to findEmployeeByUnit", async () => {
    const result = [{ id: 1 }];
    employees.findEmployeeByUnit.mockResolvedValue(result);

    await expect(controller.findEmployeeByUnit(3, "2026-10")).resolves.toBe(result);
    expect(employees.findEmployeeByUnit).toHaveBeenCalledWith(3, "2026-10");
  });

  it("delegates the POST request to createEmployeeRecord", async () => {
    const input = Object.assign(new CreateEmployeeDto(), {
      name: "Worker",
      unitId: 3,
      startingAdvanceBalance: "0",
    });
    const result = { id: 1 };
    employees.createEmployeeRecord.mockResolvedValue(result);

    await expect(controller.createEmployeeRecord(input)).resolves.toBe(result);
    expect(employees.createEmployeeRecord).toHaveBeenCalledWith(input);
  });
});
