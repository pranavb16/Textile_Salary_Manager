import { jest } from "@jest/globals";
import { BadRequestException, ConflictException } from "@nestjs/common";
import { Prisma } from "../generated/prisma/client.js";
import { AnnualReportsService } from "./annual-reports.service.js";

const latest = new Date("2026-10-01T00:00:00.000Z");
const prisma = {
  unit: { findUnique: jest.fn<(...args: any[]) => Promise<any>>() },
  payrollRecord: { findFirst: jest.fn<(...args: any[]) => Promise<any>>(), findMany: jest.fn<(...args: any[]) => Promise<any>>() },
  annualLeaveSalary: { findMany: jest.fn<(...args: any[]) => Promise<any>>(), upsert: jest.fn<(...args: any[]) => Promise<any>>() },
  $transaction: jest.fn<(...args: any[]) => Promise<any>>(),
};

function record(employeeId: number, name: string, salary: string, period = "2026-10-01", closingBalance = "0") {
  return { employeeId, period: new Date(`${period}T00:00:00.000Z`), salaryEarned: new Prisma.Decimal(salary), closingBalance: new Prisma.Decimal(closingBalance), employee: { id: employeeId, name, employeeCode: null } };
}

describe("AnnualReportsService", () => {
  let service: AnnualReportsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AnnualReportsService(prisma as never);
    prisma.unit.findUnique.mockResolvedValue({ id: 2, name: "Weaving", active: true });
    prisma.payrollRecord.findFirst.mockResolvedValue({ period: latest });
    prisma.payrollRecord.findMany.mockResolvedValue([]);
    prisma.annualLeaveSalary.findMany.mockResolvedValue([]);
    prisma.$transaction.mockImplementation(async (items: Promise<unknown>[]) => Promise.all(items));
  });

  it("offers exactly 15 calendar months ending at the unit's latest month", async () => {
    await expect(service.getMonthOptions(2)).resolves.toEqual({ earliestPeriod: "2025-08", latestPeriod: "2026-10" });
    expect(prisma.payrollRecord.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { employee: { unitId: 2 } }, orderBy: { period: "desc" } }));
  });

  it("returns an empty option range when the unit has no payroll", async () => {
    prisma.payrollRecord.findFirst.mockResolvedValue(null);
    await expect(service.getMonthOptions(2)).resolves.toEqual({ earliestPeriod: null, latestPeriod: null });
  });

  it("rejects an invalid or out-of-window start month", async () => {
    await expect(service.calculateLeaveData(2, "2025-07")).rejects.toThrow(BadRequestException);
    await expect(service.calculateLeaveData(2, "2026-11")).rejects.toThrow(BadRequestException);
    await expect(service.calculateLeaveData(2, "2026-13")).rejects.toThrow(BadRequestException);
  });

  it("counts only records in the inclusive unit period and applies each leave threshold", async () => {
    prisma.payrollRecord.findMany.mockResolvedValue([
      ...Array.from({ length: 8 }, () => record(1, "Asha", "100")),
      record(2, "Bina", "300"),
      ...Array.from({ length: 4 }, () => record(3, "Chitra", "100")),
      ...Array.from({ length: 9 }, () => record(4, "Diya", "100")),
    ]);
    const data = await service.calculateLeaveData(2, "2025-08");
    expect(prisma.payrollRecord.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { period: { gte: new Date("2025-08-01T00:00:00.000Z"), lt: new Date("2026-11-01T00:00:00.000Z") }, employee: { unitId: 2 } },
    }));
    expect(data.workers).toEqual([
      expect.objectContaining({ name: "Asha", recordCount: 8, totalLeaves: 2, saved: false }),
      expect.objectContaining({ name: "Bina", recordCount: 1, totalLeaves: 1, saved: false }),
      expect.objectContaining({ name: "Chitra", recordCount: 4, totalLeaves: 2, saved: false }),
      expect.objectContaining({ name: "Diya", recordCount: 9, totalLeaves: 3, saved: false }),
    ]);
  });

  it("carries a saved per-day rate into a later report but recalculates leave days", async () => {
    prisma.payrollRecord.findMany.mockResolvedValue(Array.from({ length: 9 }, () => record(1, "Asha", "100")));
    prisma.annualLeaveSalary.findMany.mockResolvedValue([{ employeeId: 1, startPeriod: new Date("2025-08-01T00:00:00.000Z"), endPeriod: new Date("2026-09-01T00:00:00.000Z"), recordCount: 8, totalLeaves: 2, perDaySalary: new Prisma.Decimal(750) }]);
    const data = await service.calculateLeaveData(2, "2025-08");
    expect(data.workers[0]).toMatchObject({ totalLeaves: 3, perDaySalary: "750", saved: false });
  });

  it("uses the latest in-period closing advance and rounds each final bonus before totals", async () => {
    prisma.payrollRecord.findMany.mockResolvedValue([record(1, "Asha", "100.01", "2025-08-01", "200"), record(1, "Asha", "50.02", "2026-10-01", "-400"), record(2, "Bina", "1.00", "2026-09-01", "75")]);
    prisma.annualLeaveSalary.findMany.mockResolvedValue([
      { employeeId: 1, recordCount: 2, totalLeaves: 2, perDaySalary: new Prisma.Decimal(100), leaveSalary: new Prisma.Decimal(200) },
      { employeeId: 2, recordCount: 1, totalLeaves: 1, perDaySalary: new Prisma.Decimal(50), leaveSalary: new Prisma.Decimal(50) },
    ]);
    const result = await service.getAnnualReport(2, "2025-08", "8.33", "8.33");
    expect(result.rows).toEqual([
      expect.objectContaining({ name: "Asha", salaryEarned: "150.03", bonusRate: "8.33%", diwaliBonus: "12.50", earnedLeaveSalary: "200.00", closingAdvance: "-400.00", finalBonus: "213" }),
      expect.objectContaining({ name: "Bina", salaryEarned: "1.00", bonusRate: "8.33%", diwaliBonus: "0.08", earnedLeaveSalary: "50.00", closingAdvance: "75.00", finalBonus: "50" }),
    ]);
    expect(result.totals).toEqual({ salaryEarned: "151.03", bonusRate: "8.33%", diwaliBonus: "12.58", earnedLeaveSalary: "250.00", closingAdvance: "-325.00", finalBonus: "263" });
  });

  it("applies the separate rate only to workers whose names end with the word Mender", async () => {
    prisma.payrollRecord.findMany.mockResolvedValue([
      record(1, "Asha", "1000"),
      record(2, "Manish Mender", "1000"),
      record(3, "Mender Helper", "1000"),
    ]);
    prisma.annualLeaveSalary.findMany.mockResolvedValue([
      { employeeId: 1, recordCount: 1, leaveSalary: new Prisma.Decimal(0) },
      { employeeId: 2, recordCount: 1, leaveSalary: new Prisma.Decimal(0) },
      { employeeId: 3, recordCount: 1, leaveSalary: new Prisma.Decimal(0) },
    ]);

    const result = await service.getAnnualReport(2, "2025-08", "8", "12");

    expect(result.rows.map(({ name, bonusRate, diwaliBonus }) => ({ name, bonusRate, diwaliBonus }))).toEqual([
      { name: "Asha", bonusRate: "8.00%", diwaliBonus: "80.00" },
      { name: "Manish Mender", bonusRate: "12.00%", diwaliBonus: "120.00" },
      { name: "Mender Helper", bonusRate: "8.00%", diwaliBonus: "80.00" },
    ]);
    expect(result.totals.bonusRate).toBe("Varies");
  });

  it("saves edited leave days and a whole-number per-day rate for the exact period", async () => {
    prisma.payrollRecord.findMany.mockResolvedValue([record(1, "Asha", "100")]);
    prisma.annualLeaveSalary.upsert.mockResolvedValue({ id: 1 });
    await service.saveLeaveData(2, "2025-08", { endPeriod: "2026-10", workers: [{ employeeId: 1, recordCount: 1, totalLeaves: 4, perDaySalary: "750" }] });
    expect(prisma.annualLeaveSalary.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { employeeId_startPeriod_endPeriod: { employeeId: 1, startPeriod: new Date("2025-08-01T00:00:00.000Z"), endPeriod: latest } },
      create: expect.objectContaining({ totalLeaves: 4, leaveSalary: new Prisma.Decimal(3000) }),
    }));
  });

  it("rejects saving a form loaded before the end month or record count changed", async () => {
    prisma.payrollRecord.findMany.mockResolvedValue([record(1, "Asha", "100")]);
    await expect(service.saveLeaveData(2, "2025-08", { endPeriod: "2026-09", workers: [{ employeeId: 1, recordCount: 1, totalLeaves: 2, perDaySalary: "750" }] })).rejects.toThrow(ConflictException);
    await expect(service.saveLeaveData(2, "2025-08", { endPeriod: "2026-10", workers: [{ employeeId: 1, recordCount: 2, totalLeaves: 2, perDaySalary: "750" }] })).rejects.toThrow(ConflictException);
    expect(prisma.annualLeaveSalary.upsert).not.toHaveBeenCalled();
  });

  it("requires current saved leave data for every worker", async () => {
    prisma.payrollRecord.findMany.mockResolvedValue([record(1, "Asha", "100")]);
    await expect(service.getAnnualReport(2, "2025-08", "8.33", "8.33")).rejects.toThrow(ConflictException);
  });
});
