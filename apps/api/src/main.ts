import "reflect-metadata";
import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";

const app = await NestFactory.create(AppModule);
const trustedProxyHops = Number(process.env.TRUST_PROXY_HOPS ?? 0);
if (!Number.isInteger(trustedProxyHops) || trustedProxyHops < 0) throw new Error("TRUST_PROXY_HOPS must be a nonnegative integer.");
app.getHttpAdapter().getInstance().set("trust proxy", trustedProxyHops);
app.setGlobalPrefix("api");
app.enableCors({ origin: process.env.WEB_ORIGIN?.split(",") ?? ["http://localhost:5173", "http://127.0.0.1:5173"], credentials: true });
app.use((_request: any, response: any, next: () => void) => { response.setHeader("Cache-Control", "no-store"); next(); });
await app.listen(Number(process.env.PORT ?? 3001), "0.0.0.0");
