import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type { CreateEmployeeDto } from "./dto/create-employee.dto.js";

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  // Helps to find the employees of a given unit and their opening balance for the next payroll period
  async findEmployeeByUnit(unitId?: number, period?: string) {
    let periodStart: Date | undefined;
    if (period) {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new BadRequestException("Choose a valid payroll month.");
      periodStart = new Date(`${period}-01T00:00:00.000Z`);
    }
    const employees = await this.prisma.employee.findMany({
      where: { active: true, ...(unitId ? { unitId } : {}) },
      include: {
        unit: { select: { id: true, name: true } },
        ...(periodStart ? { payrollRecords: {
          where: { period: { lt: periodStart } },
          orderBy: { period: "desc" as const },
          take: 1,
          select: { closingBalance: true },
        } } : {}),
      },
      orderBy: { name: "asc" },
    });
    if (!period) return employees;
    return employees.map(({ payrollRecords, ...employee }) => ({
      ...employee,
      openingBalance: payrollRecords?.[0]?.closingBalance ?? employee.startingAdvanceBalance,
    }));
  }

  // Creates a new employee record in the table and return that data
  async createEmployeeRecord(input: CreateEmployeeDto) {
    const unit = await this.prisma.unit.findUnique({ where: { id: input.unitId } });
    if (!unit || !unit.active) throw new NotFoundException("Select an active manufacturing unit.");
    
    const existingEmployee = await this.prisma.employee.findFirst({ where: { unitId: input.unitId, name: input.name }, select: { id: true } });
    if (existingEmployee) throw new ConflictException("A worker with this name already exists in this unit.");
    
    try {
      return await this.prisma.employee.create({ data: {
        name: input.name,
        employeeCode: input.employeeCode || null,
        unitId: input.unitId,
        startingAdvanceBalance: new Prisma.Decimal(input.startingAdvanceBalance),
      }, include: { unit: { select: { id: true, name: true } } } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const target = error.meta?.target;
        const targetName = Array.isArray(target) ? target.join(" ") : String(target ?? "");
        if (targetName.toLowerCase().includes("name")) throw new ConflictException("A worker with this name already exists in this unit.");
        throw new ConflictException("That employee code is already used in this unit.");
      }
      throw error;
    }
  }
}
