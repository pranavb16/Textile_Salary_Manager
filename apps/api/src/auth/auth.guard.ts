import { CanActivate, ExecutionContext, Injectable, SetMetadata } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthService } from "./auth.service.js";

export const Public = () => SetMetadata("publicRoute", true);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService, private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext) {
    if (this.reflector.getAllAndOverride<boolean>("publicRoute", [context.getHandler(), context.getClass()])) return true;
    const request = context.switchToHttp().getRequest();
    const header = request.headers.authorization;
    const match = typeof header === "string" ? /^Bearer ([A-Za-z0-9_-]{43})$/.exec(header) : null;
    request.auth = await this.auth.authenticate(match?.[1]);
    return true;
  }
}
