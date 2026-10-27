import { Body, Controller, Get, ParseIntPipe, Post, Query, ValidationPipe } from "@nestjs/common";
import { CreateEmployeeDto } from "./dto/create-employee.dto.js";
import { EmployeesService } from "./employees.service.js";

@Controller("employees")
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Get()
  findEmployeeByUnit(
    @Query("unitId", new ParseIntPipe({ optional: true })) unitId?: number,
    @Query("period") period?: string,
  ) {
    return this.employees.findEmployeeByUnit(unitId, period);
  }

  @Post()
  createEmployeeRecord(
    @Body(new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    })) input: CreateEmployeeDto,
  ) {
    return this.employees.createEmployeeRecord(input);
  }
}
