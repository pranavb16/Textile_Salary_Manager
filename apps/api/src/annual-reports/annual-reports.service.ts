import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { AnnualLeaveSaveInput } from "@salary/contracts";
import { annualBonusRateSchema } from "@salary/contracts";
import { Prisma } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";

// Utility functions for date handling and leave calculations
function monthDate(period: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new BadRequestException("Choose a valid start month.");
  return new Date(`${period}-01T00:00:00.000Z`);
}

function monthString(date: Date) { return date.toISOString().slice(0, 7); }

function addMonths(date: Date, count: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + count, 1));
}

function defaultLeaves(count: number) { return count <= 3 ? 1 : count <= 8 ? 2 : 3; }
function isMender(name: string) { return /(?:^|\s)mender$/i.test(name.trim()); }

@Injectable()
export class AnnualReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private async latestMonthRecordForUnit(unitId: number) {
    if (!Number.isInteger(unitId) || unitId <= 0) throw new BadRequestException("Choose a valid unit.");
    const unit = await this.prisma.unit.findUnique({ where: { id: unitId }, select: { id: true, name: true, active: true } });
    if (!unit || !unit.active) throw new NotFoundException("Select an active manufacturing unit.");
    const latest = await this.prisma.payrollRecord.findFirst({
      where: { employee: { unitId } }, orderBy: { period: "desc" }, select: { period: true },
    });
    return { unit, latest: latest?.period ?? null };
  }

  async getMonthOptions(unitId: number) {
    const { latest } = await this.latestMonthRecordForUnit(unitId);
    return { latestPeriod: latest ? monthString(latest) : null, earliestPeriod: latest ? monthString(addMonths(latest, -14)) : null };
  }

  private async findLeaveContext(unitId: number, startPeriod: string) {
    const { unit, latest } = await this.latestMonthRecordForUnit(unitId);
    if (!latest) throw new BadRequestException("This unit has no payroll records yet.");
    const start = monthDate(startPeriod);
    if (start < addMonths(latest, -14) || start > latest) {
      throw new BadRequestException("Choose a start month within the latest 15 payroll months.");
    }
    const records = await this.prisma.payrollRecord.findMany({
      where: { period: { gte: start, lt: addMonths(latest, 1) }, employee: { unitId } },
      select: { employeeId: true, period: true, salaryEarned: true, closingBalance: true, employee: { select: { id: true, name: true, employeeCode: true } } },
    });
    const workers = new Map<number, { employeeId: number; name: string; employeeCode: string | null; recordCount: number; salaryEarned: Prisma.Decimal; latestRecordPeriod: Date; closingAdvance: Prisma.Decimal }>();
    for (const record of records) {
      const current = workers.get(record.employeeId);
      if (current) {
        current.recordCount += 1;
        current.salaryEarned = current.salaryEarned.plus(record.salaryEarned);
        if (record.period > current.latestRecordPeriod) {
          current.latestRecordPeriod = record.period;
          current.closingAdvance = record.closingBalance;
        }
      } else {
        workers.set(record.employeeId, { employeeId: record.employeeId, name: record.employee.name, employeeCode: record.employee.employeeCode, recordCount: 1, salaryEarned: record.salaryEarned, latestRecordPeriod: record.period, closingAdvance: record.closingBalance });
      }
    }
    return { unit, start, latest, workers: [...workers.values()].sort((a, b) => a.name.localeCompare(b.name) || a.employeeId - b.employeeId) };
  }

  async calculateLeaveData(unitId: number, startPeriod: string) {
    const context = await this.findLeaveContext(unitId, startPeriod);
    const ids = context.workers.map((worker) => worker.employeeId);
    const saved = ids.length ? await this.prisma.annualLeaveSalary.findMany({
      where: { employeeId: { in: ids }, startPeriod: context.start, endPeriod: { lte: context.latest } },
      orderBy: { endPeriod: "desc" },
    }) : [];
    const byEmployee = new Map<number, typeof saved>();
    for (const item of saved) byEmployee.set(item.employeeId, [...(byEmployee.get(item.employeeId) ?? []), item]);
    return {
      unit: { id: context.unit.id, name: context.unit.name },
      startPeriod: monthString(context.start), endPeriod: monthString(context.latest),
      workers: context.workers.map((worker) => {
        const records = byEmployee.get(worker.employeeId) ?? [];
        const exact = records.find((item) => item.endPeriod.getTime() === context.latest.getTime() && item.recordCount === worker.recordCount);
        const previous = records[0];
        return {
          employeeId: worker.employeeId, name: worker.name, employeeCode: worker.employeeCode,
          recordCount: worker.recordCount,
          totalLeaves: exact?.totalLeaves ?? defaultLeaves(worker.recordCount),
          perDaySalary: (exact ?? previous)?.perDaySalary.toFixed(0) ?? "",
          saved: Boolean(exact),
        };
      }),
    };
  }

  async saveLeaveData(unitId: number, startPeriod: string, input: AnnualLeaveSaveInput) {
    const context = await this.findLeaveContext(unitId, startPeriod);
    if (input.endPeriod !== monthString(context.latest) || context.workers.some((worker) => input.workers.find((item) => item.employeeId === worker.employeeId)?.recordCount !== worker.recordCount)) {
      throw new ConflictException("Payroll changed. Reload and calculate leave salary again.");
    }
    if (input.workers.length !== context.workers.length) throw new BadRequestException("Enter leave salary for every worker in this period.");
    const byId = new Map(input.workers.map((worker) => [worker.employeeId, worker]));
    if (byId.size !== context.workers.length || context.workers.some((worker) => !byId.has(worker.employeeId))) {
      throw new BadRequestException("The worker list has changed. Reload and calculate leave salary again.");
    }
    await this.prisma.$transaction(context.workers.map((worker) => {
      const values = byId.get(worker.employeeId)!;
      const perDaySalary = new Prisma.Decimal(values.perDaySalary);
      const data = { recordCount: worker.recordCount, totalLeaves: values.totalLeaves, perDaySalary, leaveSalary: perDaySalary.times(values.totalLeaves) };
      return this.prisma.annualLeaveSalary.upsert({
        where: { employeeId_startPeriod_endPeriod: { employeeId: worker.employeeId, startPeriod: context.start, endPeriod: context.latest } },
        create: { employeeId: worker.employeeId, startPeriod: context.start, endPeriod: context.latest, ...data },
        update: data,
      });
    }));
    return this.calculateLeaveData(unitId, startPeriod);
  }

  async getAnnualReport(unitId: number, startPeriod: string, bonusRateInput: string, menderBonusRateInput: string) {
    const parsedRate = annualBonusRateSchema.safeParse(bonusRateInput);
    if (!parsedRate.success) throw new BadRequestException(parsedRate.error.issues[0]?.message ?? "Enter a valid bonus rate.");
    const parsedMenderRate = annualBonusRateSchema.safeParse(menderBonusRateInput);
    if (!parsedMenderRate.success) throw new BadRequestException(parsedMenderRate.error.issues[0]?.message ?? "Enter a valid Mender bonus rate.");
    const bonusRate = new Prisma.Decimal(parsedRate.data);
    const menderBonusRate = new Prisma.Decimal(parsedMenderRate.data);
    const context = await this.findLeaveContext(unitId, startPeriod);
    const saved = await this.prisma.annualLeaveSalary.findMany({
      where: { employeeId: { in: context.workers.map((worker) => worker.employeeId) }, startPeriod: context.start, endPeriod: context.latest },
    });
    const byId = new Map(saved.map((item) => [item.employeeId, item]));
    if (context.workers.some((worker) => byId.get(worker.employeeId)?.recordCount !== worker.recordCount)) {
      throw new ConflictException("Save leave salary for every worker before generating this report.");
    }
    // Calculation of main logic here
    let salaryTotal = new Prisma.Decimal(0);
    let diwaliTotal = new Prisma.Decimal(0);
    let leaveTotal = new Prisma.Decimal(0);
    let closingAdvanceTotal = new Prisma.Decimal(0);
    let finalBonusTotal = new Prisma.Decimal(0);
    const appliedRates = new Set<string>();
    const rows = context.workers.map((worker) => {
      const leave = byId.get(worker.employeeId)!;
      const workerBonusRate = isMender(worker.name) ? menderBonusRate : bonusRate;
      const diwaliBonus = worker.salaryEarned.times(workerBonusRate.dividedBy(100)).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
      const earnedLeaveSalary = leave.leaveSalary;
      const finalBonus = diwaliBonus.plus(earnedLeaveSalary).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
      appliedRates.add(workerBonusRate.toFixed(2));
      salaryTotal = salaryTotal.plus(worker.salaryEarned);
      diwaliTotal = diwaliTotal.plus(diwaliBonus);
      leaveTotal = leaveTotal.plus(earnedLeaveSalary);
      closingAdvanceTotal = closingAdvanceTotal.plus(worker.closingAdvance);
      finalBonusTotal = finalBonusTotal.plus(finalBonus);
      return {
        employeeId: worker.employeeId, name: worker.name, employeeCode: worker.employeeCode,
        salaryEarned: worker.salaryEarned.toFixed(2), bonusRate: `${workerBonusRate.toFixed(2)}%`,
        diwaliBonus: diwaliBonus.toFixed(2), earnedLeaveSalary: earnedLeaveSalary.toFixed(2), closingAdvance: worker.closingAdvance.toFixed(2),
        finalBonus: finalBonus.toFixed(0),
      };
    });
    return {
      unit: { id: context.unit.id, name: context.unit.name },
      startPeriod: monthString(context.start), endPeriod: monthString(context.latest), rows,
      totals: { salaryEarned: salaryTotal.toFixed(2), bonusRate: appliedRates.size === 1 ? `${[...appliedRates][0]}%` : appliedRates.size > 1 ? "Varies" : "—", diwaliBonus: diwaliTotal.toFixed(2), earnedLeaveSalary: leaveTotal.toFixed(2), closingAdvance: closingAdvanceTotal.toFixed(2), finalBonus: finalBonusTotal.toFixed(0) },
    };
  }
}
