import { jest } from "@jest/globals";
import { BadRequestException } from "@nestjs/common";
import { AnnualReportsController } from "./annual-reports.controller.js";

describe("AnnualReportsController", () => {
  const reports = {
    getMonthOptions: jest.fn<(...args: any[]) => Promise<any>>(),
    calculateLeaveData: jest.fn<(...args: any[]) => Promise<any>>(),
    saveLeaveData: jest.fn<(...args: any[]) => Promise<any>>(),
    getAnnualReport: jest.fn<(...args: any[]) => Promise<any>>(),
  };
  let controller: AnnualReportsController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new AnnualReportsController(reports as never);
  });

  it("forwards the unit to the month options service", async () => {
    const result = { earliestPeriod: "2025-08", latestPeriod: "2026-10" };
    reports.getMonthOptions.mockResolvedValue(result);

    await expect(controller.getOptions(2)).resolves.toBe(result);
    expect(reports.getMonthOptions).toHaveBeenCalledWith(2);
  });

  it("forwards the unit and start month to leave data calculation", async () => {
    const result = { startPeriod: "2025-08", endPeriod: "2026-10", workers: [] };
    reports.calculateLeaveData.mockResolvedValue(result);

    await expect(controller.calculateLeaveData(2, "2025-08")).resolves.toBe(result);
    expect(reports.calculateLeaveData).toHaveBeenCalledWith(2, "2025-08");
  });

  it("validates leave data before forwarding it to the service", async () => {
    const input = {
      endPeriod: "2026-10",
      workers: [{ employeeId: 7, recordCount: 4, totalLeaves: 2, perDaySalary: "750" }],
    };
    const result = { workers: input.workers };
    reports.saveLeaveData.mockResolvedValue(result);

    await expect(controller.saveLeaveData(2, "2025-08", input)).resolves.toBe(result);
    expect(reports.saveLeaveData).toHaveBeenCalledWith(2, "2025-08", input);
  });

  it("rejects invalid leave data without calling the service", async () => {
    const invalidInput = {
      endPeriod: "2026-13",
      workers: [{ employeeId: 7, recordCount: 4, totalLeaves: 2, perDaySalary: "750.50" }],
    };

    expect(() => controller.saveLeaveData(2, "2025-08", invalidInput)).toThrow(BadRequestException);
    expect(reports.saveLeaveData).not.toHaveBeenCalled();
  });

  it("forwards report selection and bonus rate to the service", async () => {
    const result = { rows: [], totals: {} };
    reports.getAnnualReport.mockResolvedValue(result);

    await expect(controller.getAnnualReport(2, "2025-08", "8.33", "10.00")).resolves.toBe(result);
    expect(reports.getAnnualReport).toHaveBeenCalledWith(2, "2025-08", "8.33", "10.00");
  });
});
