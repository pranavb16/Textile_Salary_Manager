import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type { PayrollEntryDto } from "./dto/payroll-entry.dto.js";
import { calculateClosingBalance, calculateEarnedSalary, calculateMenderEarnedSalary } from "./payroll-calculation.js";

function periodDate(period: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new BadRequestException("Select a valid payroll month.");
  return new Date(`${period}-01T00:00:00.000Z`);
}

function toEntry(input: PayrollEntryDto) {
  const isMender = input.isMender === true;
  const mendingMetres = isMender ? new Prisma.Decimal(input.mendingMetres!) : null;
  const mendingRate = isMender ? new Prisma.Decimal(input.mendingRate!) : null;
  const shift8Rate = new Prisma.Decimal(isMender ? 0 : input.shift8Rate);
  const shift12Rate = new Prisma.Decimal(isMender ? 0 : input.shift12Rate);
  return {
    employeeId: input.employeeId,
    period: periodDate(input.period),
    isMender,
    mendingMetres,
    mendingRate,
    totalDays: isMender ? 0 : input.totalDays,
    shift8Days: isMender ? 0 : input.shift8Days,
    shift12Days: isMender ? 0 : input.shift12Days,
    shift8Rate,
    shift12Rate,
    salaryEarned: isMender ? calculateMenderEarnedSalary(mendingMetres!, mendingRate!) : calculateEarnedSalary(input.shift8Days, shift8Rate, input.shift12Days, shift12Rate),
    cashPaid: new Prisma.Decimal(input.cashPaid),
    bankPaid: new Prisma.Decimal(input.bankPaid),
    advanceRequested: new Prisma.Decimal(input.advanceRequested),
  };
}

type StoredPayrollRecord = ReturnType<typeof toEntry> & {
  id: number;
  openingBalance: Prisma.Decimal;
  closingBalance: Prisma.Decimal;
};

function payrollRecordChanged(
  record: StoredPayrollRecord,
  data: ReturnType<typeof toEntry>,
  balances: { openingBalance: Prisma.Decimal; closingBalance: Prisma.Decimal },
) {
  return record.employeeId !== data.employeeId
    || record.period.getTime() !== data.period.getTime()
    || record.isMender !== data.isMender
    || (record.mendingMetres === null ? data.mendingMetres !== null : data.mendingMetres === null || !record.mendingMetres.equals(data.mendingMetres))
    || (record.mendingRate === null ? data.mendingRate !== null : data.mendingRate === null || !record.mendingRate.equals(data.mendingRate))
    || record.totalDays !== data.totalDays
    || record.shift8Days !== data.shift8Days
    || record.shift12Days !== data.shift12Days
    || !record.shift8Rate.equals(data.shift8Rate)
    || !record.shift12Rate.equals(data.shift12Rate)
    || !record.salaryEarned.equals(data.salaryEarned)
    || !record.cashPaid.equals(data.cashPaid)
    || !record.bankPaid.equals(data.bankPaid)
    || !record.advanceRequested.equals(data.advanceRequested)
    || !record.openingBalance.equals(balances.openingBalance)
    || !record.closingBalance.equals(balances.closingBalance);
}

@Injectable()
export class PayrollService {
  constructor(private readonly prisma: PrismaService) {}
  
  // Method to find the payroll records for a specific unit and month
  async findForUnitAndMonth(unitId: number, period: string) {
    const start = periodDate(period);   // Extracts the first day of the month and converts it to a Date object in UTC.
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
    const records = await this.prisma.payrollRecord.findMany({
      where: { period: { gte: start, lt: end }, employee: { unitId } },
      include: { employee: { select: { id: true, name: true, employeeCode: true } } },
      orderBy: { employee: { name: "asc" } },
    });
    return records;
  }

  async createPayrollRecord(input: PayrollEntryDto) { return this.savePayrollRecord(input); }

  async updatePayrollRecord(id: number, input: PayrollEntryDto) { return this.savePayrollRecord(input, id); }

  private async savePayrollRecord(input: PayrollEntryDto, editId?: number) {
    const proposed = toEntry(input);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const employee = await tx.employee.findUnique({ where: { id: input.employeeId } });
        if (!employee || !employee.active) throw new NotFoundException("Please select an active worker.");

        const hasEditId = editId !== undefined;
        const edited = editId !== undefined
          ? await tx.payrollRecord.findUnique({ where: { id: editId } })
          : null;
        if (hasEditId && !edited) throw new NotFoundException("Payroll record was not found for this worker.");
        if (edited && edited.employeeId !== input.employeeId) {
          throw new BadRequestException("A payroll record cannot be moved to a different worker.");
        }

        const affectedStart = edited && edited.period.getTime() < proposed.period.getTime()
          ? edited.period
          : proposed.period;
        const priorRecord = await tx.payrollRecord.findFirst({
          where: { employeeId: input.employeeId, period: { lt: affectedStart } },
          orderBy: { period: "desc" },
          select: { closingBalance: true },
        });
        const records = await tx.payrollRecord.findMany({
          where: { employeeId: input.employeeId, period: { gte: affectedStart } },
          orderBy: [{ period: "asc" }, { id: "asc" }],
        });
        if (hasEditId && !records.some((record) => record.id === editId)) {
          throw new NotFoundException("Payroll record was not found for this worker.");
        }
        if (records.some((record) => record.period.getTime() === proposed.period.getTime() && record.id !== editId)) {
          throw new ConflictException("A payroll record already exists for this worker and month.");
        }

        const entries: Array<{
          id?: number;
          original?: StoredPayrollRecord;
          data: typeof proposed;
        }> = records.map((record) => ({
          id: record.id,
          original: record,
          data: record.id === editId ? proposed : {
            employeeId: record.employeeId,
            period: record.period,
            isMender: record.isMender,
            mendingMetres: record.mendingMetres,
            mendingRate: record.mendingRate,
            totalDays: record.totalDays,
            shift8Days: record.shift8Days,
            shift12Days: record.shift12Days,
            shift8Rate: record.shift8Rate,
            shift12Rate: record.shift12Rate,
            salaryEarned: record.salaryEarned,
            cashPaid: record.cashPaid,
            bankPaid: record.bankPaid,
            advanceRequested: record.advanceRequested,
          },
        }));
        // Used for creation of a new record
        if (!hasEditId) entries.push({ data: proposed });
        entries.sort((a, b) => a.data.period.getTime() - b.data.period.getTime() || (a.id ?? 0) - (b.id ?? 0));

        let openingBalance = priorRecord?.closingBalance ?? employee.startingAdvanceBalance;
        const calculated = entries.map((entry) => {
          const closingBalance = calculateClosingBalance({
            openingBalance,
            newAdvance: entry.data.advanceRequested,
            salaryEarned: entry.data.salaryEarned,
            cashPaid: entry.data.cashPaid,
            bankPaid: entry.data.bankPaid,
          });
          const balances = { openingBalance, closingBalance };
          openingBalance = closingBalance;   // Resulting closing balance becomes the next month's opening balance.
          return { ...entry, balances };
        });

        for (const entry of calculated) {
          if (entry.id) {
            if (entry.original && payrollRecordChanged(entry.original, entry.data, entry.balances)) {
              await tx.payrollRecord.update({ where: { id: entry.id }, data: { ...entry.data, ...entry.balances } });
            }
          } else {
            await tx.payrollRecord.create({ data: { ...entry.data, ...entry.balances } });
          }
        }
        return tx.payrollRecord.findFirstOrThrow({
          where: { employeeId: input.employeeId, period: proposed.period },
          include: { employee: { select: { id: true, name: true, employeeCode: true } } },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") throw new ConflictException("A payroll record already exists for this worker and month.");
        if (error.code === "P2034") throw new ConflictException("This worker's payroll changed at the same time. Reload the month and try again.");
      }
      throw error;
    }
  }
}
