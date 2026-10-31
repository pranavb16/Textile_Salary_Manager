import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AuthController } from "./auth.controller.js";
import { AuthGuard } from "./auth.guard.js";
import { HealthController } from "./health.controller.js";
import { AuthService } from "./auth.service.js";

@Module({ controllers: [AuthController, HealthController], providers: [AuthService, { provide: APP_GUARD, useClass: AuthGuard }] })
export class AuthModule {}
