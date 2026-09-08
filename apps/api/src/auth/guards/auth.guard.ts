import { Injectable, UnauthorizedException, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { DatabaseService } from '../../database/database.service.js';
import { safeUserSelect, type AuthContext } from '../../users/user.select.js';
import { TokenService } from '../token.service.js';
import { cookieNames, readCookie } from '../auth.cookies.js';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly tokens: TokenService, private readonly db: DatabaseService, private readonly config: ConfigService) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request & { auth?: AuthContext }>();
    const access = readCookie(req, cookieNames(this.config.get('NODE_ENV') === 'production').access);
    if (!access) throw new UnauthorizedException('Authentication required');
    let claims: { userId: string; sessionId: string };
    try { claims = await this.tokens.verify(access); } catch { throw new UnauthorizedException('Authentication required'); }
    const session = await this.db.authSession.findUnique({ where: { id: claims.sessionId },
      include: { user: { select: { ...safeUserSelect, status: true, authVersion: true } } } });
    if (!session || session.userId !== claims.userId || session.revokedAt ||
        session.expiresAt <= new Date() || session.user.status !== 'ACTIVE' ||
        session.authVersion !== session.user.authVersion) throw new UnauthorizedException('Authentication required');
    const { status: _status, authVersion: _version, ...user } = session.user;
    req.auth = { user, sessionId: session.id };
    return true;
  }
}
