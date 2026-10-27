import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Query, ValidationPipe } from "@nestjs/common";
import { PayrollEntryDto } from "./dto/payroll-entry.dto.js";
import { PayrollService } from "./payroll.service.js";

@Controller("payroll")
export class PayrollController {
  constructor(private readonly payroll: PayrollService) {}

  @Get()
  findForUnitAndMonth(
    @Query("unitId", ParseIntPipe) unitId: number,
    @Query("period") period: string,
  ) {
    return this.payroll.findForUnitAndMonth(unitId, period);
  }

  @Post()
  create(
    @Body(new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    })) input: PayrollEntryDto,
  ) {
    return this.payroll.createPayrollRecord(input);
  }

  @Put(":id")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body(new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    })) input: PayrollEntryDto,
  ) {
    return this.payroll.updatePayrollRecord(id, input);
  }
}
