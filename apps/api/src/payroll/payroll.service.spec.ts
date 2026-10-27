import { jest } from "@jest/globals";
import { BadRequestException } from "@nestjs/common";
import { Prisma } from "../generated/prisma/client.js";
import { PayrollEntryDto } from "./dto/payroll-entry.dto.js";
import { PayrollService } from "./payroll.service.js";
import { calculateClosingBalance, calculateEarnedSalary } from "./payroll-calculation.js";

const tx = {
  employee: { findUnique: jest.fn<(...args: any[]) => Promise<any>>() },
  payrollRecord: {
    findUnique: jest.fn<(...args: any[]) => Promise<any>>(),
    findFirst: jest.fn<(...args: any[]) => Promise<any>>(),
    findMany: jest.fn<(...args: any[]) => Promise<any>>(),
    create: jest.fn<(...args: any[]) => Promise<any>>(),
    update: jest.fn<(...args: any[]) => Promise<any>>(),
    findFirstOrThrow: jest.fn<(...args: any[]) => Promise<any>>(),
  },
};

const prisma = {
  $transaction: jest.fn<(...args: any[]) => Promise<any>>(),
};

function makeInput(overrides: Partial<PayrollEntryDto> = {}) {
  return Object.assign(new PayrollEntryDto(), {
    employeeId: 1,
    period: "2026-10",
    totalDays: 1,
    shift8Days: 1,
    shift12Days: 0,
    shift8Rate: "100",
    shift12Rate: "0",
    cashPaid: "100",
    bankPaid: "0",
    advanceRequested: "0",
    ...overrides,
  });
}

function makeExistingRecord() {
  return {
    id: 10,
    employeeId: 1,
    period: new Date("2026-10-01T00:00:00.000Z"),
    totalDays: 1,
    shift8Days: 1,
    shift12Days: 0,
    shift8Rate: new Prisma.Decimal("100"),
    shift12Rate: new Prisma.Decimal("0"),
    salaryEarned: new Prisma.Decimal("100"),
    cashPaid: new Prisma.Decimal("100"),
    bankPaid: new Prisma.Decimal("0"),
    advanceRequested: new Prisma.Decimal("0"),
    openingBalance: new Prisma.Decimal("0"),
    closingBalance: new Prisma.Decimal("0"),
  };
}

describe("PayrollService", () => {
  let service: PayrollService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PayrollService(prisma as never);
    prisma.$transaction.mockImplementation((operation: (client: typeof tx) => Promise<unknown>) => operation(tx));
    tx.employee.findUnique.mockResolvedValue({
      id: 1,
      active: true,
      startingAdvanceBalance: new Prisma.Decimal("0"),
    });
    tx.payrollRecord.findFirst.mockResolvedValue(null);
    tx.payrollRecord.findMany.mockResolvedValue([]);
  });

  it("creates a payroll record through createPayrollRecord", async () => {
    const input = makeInput();
    const result = { id: 11, ...input };
    tx.payrollRecord.create.mockResolvedValue(result);
    tx.payrollRecord.findFirstOrThrow.mockResolvedValue(result);

    await expect(service.createPayrollRecord(input)).resolves.toBe(result);

    expect(tx.payrollRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        employeeId: 1,
        totalDays: 1,
        salaryEarned: expect.any(Prisma.Decimal),
        openingBalance: expect.any(Prisma.Decimal),
        closingBalance: expect.any(Prisma.Decimal),
      }),
    });
    expect(tx.payrollRecord.findMany).toHaveBeenCalledWith({
      where: { employeeId: 1, period: { gte: new Date("2026-10-01T00:00:00.000Z") } },
      orderBy: [{ period: "asc" }, { id: "asc" }],
    });
  });

  it("updates an existing record through updatePayrollRecord", async () => {
    const input = makeInput({ shift8Rate: "200" });
    const result = { id: 10, ...input };
    const existingRecord = makeExistingRecord();
    tx.payrollRecord.findUnique.mockResolvedValue(existingRecord);
    tx.payrollRecord.findMany.mockResolvedValue([existingRecord]);
    tx.payrollRecord.update.mockResolvedValue(result);
    tx.payrollRecord.findFirstOrThrow.mockResolvedValue(result);

    await expect(service.updatePayrollRecord(10, input)).resolves.toBe(result);

    expect(tx.payrollRecord.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: expect.objectContaining({
        shift8Rate: expect.any(Prisma.Decimal),
        salaryEarned: expect.any(Prisma.Decimal),
        openingBalance: expect.any(Prisma.Decimal),
        closingBalance: expect.any(Prisma.Decimal),
      }),
    });
    expect(tx.payrollRecord.create).not.toHaveBeenCalled();
  });
});

describe("payroll calculations", () => {
  it("allows more than 30 shift days and multiplies both rates correctly", () => {
    const earned = calculateEarnedSalary(8, new Prisma.Decimal("500"), 30, new Prisma.Decimal("800"));
    expect(earned.toString()).toBe("28000");
  });

  it("carries held salary forward and permits it to be paid in a later month", () => {
    const held = calculateClosingBalance({ openingBalance: new Prisma.Decimal(0), newAdvance: new Prisma.Decimal(5000), salaryEarned: new Prisma.Decimal(28000), cashPaid: new Prisma.Decimal(1000), bankPaid: new Prisma.Decimal(18000) });
    expect(held.toString()).toBe("-4000");
    const settled = calculateClosingBalance({ openingBalance: held, newAdvance: new Prisma.Decimal(0), salaryEarned: new Prisma.Decimal(28000), cashPaid: new Prisma.Decimal(4000), bankPaid: new Prisma.Decimal(28000) });
    expect(settled.toString()).toBe("0");
  });

  it("rejects payout greater than earned wages plus held salary", () => {
    expect(() => calculateClosingBalance({ openingBalance: new Prisma.Decimal(0), newAdvance: new Prisma.Decimal(0), salaryEarned: new Prisma.Decimal(20000), cashPaid: new Prisma.Decimal(1000), bankPaid: new Prisma.Decimal(20000) })).toThrow(BadRequestException);
  });
});
