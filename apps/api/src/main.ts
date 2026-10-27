import "reflect-metadata";
import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";

const app = await NestFactory.create(AppModule);
app.setGlobalPrefix("api");
app.enableCors({ origin: process.env.WEB_ORIGIN?.split(",") ?? "http://localhost:5173" });
await app.listen(Number(process.env.PORT ?? 3001), "0.0.0.0");
