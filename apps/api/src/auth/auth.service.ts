import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { ForbiddenException, HttpException, HttpStatus, Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { hashPassword, verifyPassword } from "./password.js";

export const ACCESS_LIFETIME_MS = 60 * 60 * 1000;
export const SESSION_LIFETIME_MS = 24 * ACCESS_LIFETIME_MS;
export const LOCK_LIFETIME_MS = 15 * 60 * 1000;
const REFRESH_GRACE_MS = 10 * 1000;
const MAX_FAILURES = 5;
const invalidCredentials = "Invalid username or password.";
const lockedMessage = "Too many login attempts. Try again in 15 minutes.";

function token() { return randomBytes(32).toString("base64url"); }
function digest(value: string) { return createHash("sha256").update(value).digest("hex"); }
function sameHash(left: string, right: string) {
  return /^[a-f0-9]{64}$/.test(left) && /^[a-f0-9]{64}$/.test(right) && timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}
function accessExpiry(now: Date, sessionExpiry: Date) {
  return new Date(Math.min(now.getTime() + ACCESS_LIFETIME_MS, sessionExpiry.getTime()));
}
type AuthOutcome = { kind: "invalid" } | { kind: "locked" } | { kind: "success"; username: string; accessToken: string; accessExpiresAt: Date; sessionExpiresAt: Date; refreshCookie: string };

@Injectable()
export class AuthService {
  private dummyPasswordHash?: Promise<string>;
  constructor(private readonly prisma: PrismaService) {}

  assertOrigin(origin: string | undefined) {
    const allowed = (process.env.WEB_ORIGIN ?? "http://localhost:5173,http://127.0.0.1:5173").split(",").map((item) => item.trim());
    if (!origin || !allowed.includes(origin)) throw new ForbiddenException("Request origin is not allowed.");
  }

  async login(username: string, password: string, ip: string) {
    if (typeof username !== "string" || typeof password !== "string" || username.length > 100 || password.length > 1024) {
      throw new UnauthorizedException(invalidCredentials);
    }
    const result: AuthOutcome = await this.prisma.$transaction(async (tx) => {
      // One account means one short database lock can serialize all login counters.
      // Return an integer so Prisma never tries to decode PostgreSQL's void lock result.
      await tx.$queryRaw`SELECT 1::integer AS acquired FROM pg_advisory_xact_lock(918271)`;
      const now = new Date();
      await tx.authAccessToken.deleteMany({ where: { expiresAt: { lte: now } } });
      await tx.authSession.deleteMany({ where: { expiresAt: { lte: now } } });
      await tx.authIpLimit.deleteMany({ where: { updatedAt: { lt: new Date(now.getTime() - SESSION_LIFETIME_MS) } } });
      const account = await tx.authAccount.findUnique({ where: { id: 1 } });
      const ipHash = digest(ip || "unknown");
      if (!account || username.trim() !== account.username) {
        const limit = await tx.authIpLimit.findUnique({ where: { ipHash } });
        if (limit?.lockedUntil && limit.lockedUntil > now) return { kind: "locked" };
        this.dummyPasswordHash ??= hashPassword(randomBytes(32).toString("base64url"));
        await verifyPassword(password, await this.dummyPasswordHash);
        const attempts = (limit?.lockedUntil ? 0 : limit?.failedAttempts ?? 0) + 1;
        await tx.authIpLimit.upsert({
          where: { ipHash },
          create: { ipHash, failedAttempts: attempts, lockedUntil: attempts >= MAX_FAILURES ? new Date(now.getTime() + LOCK_LIFETIME_MS) : null },
          update: { failedAttempts: attempts, lockedUntil: attempts >= MAX_FAILURES ? new Date(now.getTime() + LOCK_LIFETIME_MS) : null },
        });
        return { kind: attempts >= MAX_FAILURES ? "locked" : "invalid" };
      }
      if (account.lockedUntil && account.lockedUntil > now) return { kind: "locked" };
      const valid = await verifyPassword(password, account.passwordHash);
      if (!valid) {
        const attempts = (account.lockedUntil ? 0 : account.failedAttempts) + 1;
        await tx.authAccount.update({ where: { id: 1 }, data: {
          failedAttempts: attempts,
          lockedUntil: attempts >= MAX_FAILURES ? new Date(now.getTime() + LOCK_LIFETIME_MS) : null,
        } });
        return { kind: attempts >= MAX_FAILURES ? "locked" : "invalid" };
      }
      await tx.authAccount.update({ where: { id: 1 }, data: { failedAttempts: 0, lockedUntil: null } });
      await tx.authIpLimit.deleteMany({ where: { ipHash } });
      const sessionExpiresAt = new Date(now.getTime() + SESSION_LIFETIME_MS);
      const accessExpiresAt = accessExpiry(now, sessionExpiresAt);
      const accessToken = token();
      const refreshToken = token();
      const sessionId = randomUUID();
      await tx.authSession.create({ data: {
        id: sessionId, accountId: 1, refreshTokenHash: digest(refreshToken), expiresAt: sessionExpiresAt,
        accessTokens: { create: { hash: digest(accessToken), expiresAt: accessExpiresAt } },
      } });
      return { kind: "success", username: account.username, accessToken, accessExpiresAt, sessionExpiresAt, refreshCookie: `${sessionId}.${refreshToken}` };
    });
    if (result.kind === "locked") throw new HttpException(lockedMessage, HttpStatus.TOO_MANY_REQUESTS);
    if (result.kind === "invalid") throw new UnauthorizedException(invalidCredentials);
    return result;
  }

  async authenticate(accessToken: string | undefined) {
    if (!accessToken || !/^[A-Za-z0-9_-]{43}$/.test(accessToken)) throw new UnauthorizedException();
    const record = await this.prisma.authAccessToken.findUnique({ where: { hash: digest(accessToken) }, include: { session: { include: { account: true } } } });
    const now = new Date();
    if (!record || record.expiresAt <= now || record.session.expiresAt <= now) throw new UnauthorizedException();
    return { username: record.session.account.username, sessionId: record.sessionId, sessionExpiresAt: record.session.expiresAt };
  }

  async refresh(cookie: string | undefined) {
    const parsed = this.parseRefresh(cookie);
    if (!parsed) throw new UnauthorizedException();
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM auth_sessions WHERE id = CAST(${parsed.id} AS uuid) FOR UPDATE`;
      const session = await tx.authSession.findUnique({ where: { id: parsed.id }, include: { account: true } });
      const now = new Date();
      if (!session || session.expiresAt <= now) return null;
      const suppliedHash = digest(parsed.secret);
      const current = sameHash(suppliedHash, session.refreshTokenHash);
      const recentPrevious = Boolean(session.previousRefreshTokenHash && session.previousRefreshUntil && session.previousRefreshUntil > now && sameHash(suppliedHash, session.previousRefreshTokenHash));
      if (!current && !recentPrevious) return null;
      const accessToken = token();
      const accessExpiresAt = accessExpiry(now, session.expiresAt);
      await tx.authAccessToken.create({ data: { hash: digest(accessToken), sessionId: session.id, expiresAt: accessExpiresAt } });
      let refreshCookie: string | undefined;
      if (current) {
        const replacement = token();
        await tx.authSession.update({ where: { id: session.id }, data: {
          refreshTokenHash: digest(replacement), previousRefreshTokenHash: session.refreshTokenHash,
          previousRefreshUntil: new Date(now.getTime() + REFRESH_GRACE_MS),
        } });
        refreshCookie = `${session.id}.${replacement}`;
      }
      return { username: session.account.username, accessToken, accessExpiresAt, sessionExpiresAt: session.expiresAt, refreshCookie };
    });
    if (!result) throw new UnauthorizedException();
    return result;
  }

  async logout(cookie: string | undefined) {
    const parsed = this.parseRefresh(cookie);
    if (!parsed) return;
    const session = await this.prisma.authSession.findUnique({ where: { id: parsed.id } });
    const suppliedHash = digest(parsed.secret);
    if (session && (sameHash(suppliedHash, session.refreshTokenHash) || Boolean(session.previousRefreshTokenHash && sameHash(suppliedHash, session.previousRefreshTokenHash)))) {
      await this.prisma.authSession.deleteMany({ where: { id: parsed.id } });
    }
  }

  private parseRefresh(cookie: string | undefined) {
    const match = /^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\.([A-Za-z0-9_-]{43})$/.exec(cookie ?? "");
    return match ? { id: match[1], secret: match[2] } : null;
  }
}
