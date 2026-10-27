import { Module } from "@nestjs/common";
import { AnnualReportsController } from "./annual-reports.controller.js";
import { AnnualReportsService } from "./annual-reports.service.js";

@Module({ controllers: [AnnualReportsController], providers: [AnnualReportsService] })
export class AnnualReportsModule {}
