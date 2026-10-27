import { BadRequestException, Body, Controller, Get, ParseIntPipe, Put, Query } from "@nestjs/common";
import { annualLeaveSaveSchema } from "@salary/contracts";
import { AnnualReportsService } from "./annual-reports.service.js";

@Controller("annual-reports")
export class AnnualReportsController {
  constructor(private readonly reports: AnnualReportsService) {}

  @Get("options")
  getOptions(@Query("unitId", ParseIntPipe) unitId: number) { return this.reports.getMonthOptions(unitId); }

  @Get("leave")
  calculateLeaveData(@Query("unitId", ParseIntPipe) unitId: number, @Query("startPeriod") startPeriod: string) {
    return this.reports.calculateLeaveData(unitId, startPeriod);
  }

  @Put("leave")
  saveLeaveData(@Query("unitId", ParseIntPipe) unitId: number, @Query("startPeriod") startPeriod: string, @Body() body: unknown) {
    const parsed = annualLeaveSaveSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? "Check leave salary inputs.");
    return this.reports.saveLeaveData(unitId, startPeriod, parsed.data);
  }

  @Get()
  getAnnualReport(@Query("unitId", ParseIntPipe) unitId: number, @Query("startPeriod") startPeriod: string, @Query("bonusRate") bonusRate: string, @Query("menderBonusRate") menderBonusRate: string) {
    return this.reports.getAnnualReport(unitId, startPeriod, bonusRate, menderBonusRate);
  }
}
