import { jest } from "@jest/globals";
import { PayrollEntryDto } from "./dto/payroll-entry.dto.js";
import { PayrollController } from "./payroll.controller.js";

describe("PayrollController", () => {
  const payroll = {
    findForUnitAndMonth: jest.fn<(...args: any[]) => Promise<unknown>>(),
    createPayrollRecord: jest.fn<(input: PayrollEntryDto) => Promise<unknown>>(),
    updatePayrollRecord: jest.fn<(id: number, input: PayrollEntryDto) => Promise<unknown>>(),
  };
  let controller: PayrollController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new PayrollController(payroll as never);
  });

  it("delegates the GET request to the service with unit and month", async () => {
    const result = [{ id: 1 }];
    payroll.findForUnitAndMonth.mockResolvedValue(result);

    await expect(controller.findForUnitAndMonth(3, "2026-10")).resolves.toBe(result);
    expect(payroll.findForUnitAndMonth).toHaveBeenCalledWith(3, "2026-10");
  });

  it("delegates the POST request to createPayrollRecord", async () => {
    const input = Object.assign(new PayrollEntryDto(), { employeeId: 3, period: "2026-10" });
    const result = { id: 1 };
    payroll.createPayrollRecord.mockResolvedValue(result);

    await expect(controller.create(input)).resolves.toBe(result);
    expect(payroll.createPayrollRecord).toHaveBeenCalledWith(input);
  });

  it("delegates the PUT request to updatePayrollRecord with the record id", async () => {
    const input = Object.assign(new PayrollEntryDto(), { employeeId: 3, period: "2026-10" });
    const result = { id: 7 };
    payroll.updatePayrollRecord.mockResolvedValue(result);

    await expect(controller.update(7, input)).resolves.toBe(result);
    expect(payroll.updatePayrollRecord).toHaveBeenCalledWith(7, input);
  });
});
