import { Body, Controller, Get, Post, ValidationPipe } from "@nestjs/common";
import { CreateUnitDto } from "./dto/create-unit.dto.js";
import { UnitsService } from "./units.service.js";

@Controller("units")
export class UnitsController {
  constructor(private readonly units: UnitsService) {}

  @Get()
  getUnitDetails() {
    return this.units.getUnitDetails();
  }

  @Post()
  createUnitDetails(
    @Body(new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    })) input: CreateUnitDto,
  ) {
    return this.units.createUnitDetails(input);
  }
}
