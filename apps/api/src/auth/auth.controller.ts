import { Body, Controller, Get, HttpCode, Post, Req, Res } from "@nestjs/common";
import { AuthService } from "./auth.service.js";
import { Public } from "./auth.guard.js";

function cookieName() { return process.env.NODE_ENV === "production" ? "__Host-salary_refresh" : "salary_refresh"; }
function refreshCookie(request: any) {
  const cookie = request.headers.cookie as string | undefined;
  return cookie?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${cookieName()}=`))?.slice(cookieName().length + 1);
}
function setRefreshCookie(response: any, value: string, expiresAt: Date) {
  response.cookie(cookieName(), value, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/",
    maxAge: Math.max(0, expiresAt.getTime() - Date.now()),
  });
}
function publicTokenResult(result: { username: string; accessToken: string; accessExpiresAt: Date; sessionExpiresAt: Date }) {
  return { username: result.username, accessToken: result.accessToken, accessExpiresAt: result.accessExpiresAt.toISOString(), sessionExpiresAt: result.sessionExpiresAt.toISOString() };
}

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public() @Post("login") @HttpCode(200)
  async login(@Body() body: { username?: string; password?: string }, @Req() request: any, @Res({ passthrough: true }) response: any) {
    this.auth.assertOrigin(request.headers.origin);
    const result = await this.auth.login(body?.username as string, body?.password as string, request.ip);
    setRefreshCookie(response, result.refreshCookie, result.sessionExpiresAt);
    return publicTokenResult(result);
  }

  @Public() @Post("refresh") @HttpCode(200)
  async refresh(@Req() request: any, @Res({ passthrough: true }) response: any) {
    this.auth.assertOrigin(request.headers.origin);
    const result = await this.auth.refresh(refreshCookie(request));
    if (result.refreshCookie) setRefreshCookie(response, result.refreshCookie, result.sessionExpiresAt);
    return publicTokenResult(result);
  }

  @Get("me")
  me(@Req() request: any) { return { username: request.auth.username, sessionExpiresAt: request.auth.sessionExpiresAt.toISOString() }; }

  @Public() @Post("logout") @HttpCode(204)
  async logout(@Req() request: any, @Res({ passthrough: true }) response: any) {
    this.auth.assertOrigin(request.headers.origin);
    await this.auth.logout(refreshCookie(request));
    response.clearCookie(cookieName(), { path: "/", sameSite: "lax", secure: process.env.NODE_ENV === "production", httpOnly: true });
  }
}
