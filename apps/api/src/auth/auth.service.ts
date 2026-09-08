import { ConflictException, Injectable, Logger, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { Prisma, type User } from '../generated/prisma/client.js';
import { safeUserSelect } from '../users/user.select.js';
import { PasswordService } from './password.service.js';
import { TokenService, newToken, tokenHash, SESSION_MS } from './token.service.js';
import type { SignupDto, LoginDto } from './dto/auth.dto.js';

type Purpose = 'reset' | 'verify';
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(private readonly db: DatabaseService, private readonly passwords: PasswordService, private readonly tokens: TokenService) {}

  private async serial<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try { return await this.db.$transaction(work, { isolationLevel: 'Serializable' }); }
      catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034' && attempt < 2) continue;
        throw error;
      }
    }
  }
  private async session(tx: Prisma.TransactionClient, user: Pick<User, 'id' | 'authVersion'>) {
    const refresh = newToken();
    const expiresAt = new Date(Date.now() + SESSION_MS);
    const session = await tx.authSession.create({ data: { userId: user.id, authVersion: user.authVersion,
      expiresAt, tokens: { create: { tokenHash: tokenHash(refresh) } } } });
    return { sessionId: session.id, refresh, expiresAt };
  }
  async signup(dto: SignupDto) {
    const passwordHash = await this.passwords.hash(dto.password);
    try {
      const result = await this.db.$transaction(async (tx) => {
        const user = await tx.user.create({ data: {
          email: dto.email.trim().toLowerCase(), firstName: dto.firstName, lastName: dto.lastName,
          mobile: dto.mobile, passwordHash,
        } });
        const session = await this.session(tx, user);
        await tx.emailVerificationToken.create({ data: { userId: user.id, tokenHash: tokenHash(newToken()),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) } });
        return { user: await tx.user.findUniqueOrThrow({ where: { id: user.id }, select: safeUserSelect }), ...session };
      });
      this.logger.log({ event: 'auth.signup', userId: result.user.id });
      return { ...result, access: await this.tokens.sign(result.user.id, result.sessionId) };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new ConflictException('An account with this email already exists');
      throw error;
    }
  }
  async login(dto: LoginDto) {
    const user = await this.db.user.findUnique({ where: { email: dto.email.trim().toLowerCase() } });
    if (!user) {
      await this.passwords.verifyMissingUser(dto.password);
      throw new UnauthorizedException('Invalid email or password');
    }
    const valid = await this.passwords.verify(user.passwordHash, dto.password);
    if (!valid || user.status !== 'ACTIVE') throw new UnauthorizedException('Invalid email or password');
    const session = await this.db.$transaction((tx) => this.session(tx, user));
    this.logger.log({ event: 'auth.login', userId: user.id });
    return { ...session, access: await this.tokens.sign(user.id, session.sessionId),
      user: await this.db.user.findUniqueOrThrow({ where: { id: user.id }, select: safeUserSelect }) };
  }
  async refresh(raw: string | undefined) {
    if (!raw || !/^[A-Za-z0-9_-]{43}$/.test(raw)) throw new UnauthorizedException('Invalid session');
    const result = await this.serial(async (tx) => {
      const token = await tx.refreshToken.findUnique({ where: { tokenHash: tokenHash(raw) }, include: { session: { include: { user: true } } } });
      if (!token) return null;
      const { session } = token;
      if (session.revokedAt || session.expiresAt <= new Date() || session.user.status !== 'ACTIVE' ||
          session.authVersion !== session.user.authVersion) return null;
      const consumed = await tx.refreshToken.updateMany({ where: { id: token.id, usedAt: null }, data: { usedAt: new Date() } });
      if (consumed.count !== 1) {
        await tx.authSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
        return null; // Commit revocation before reporting replay.
      }
      const refresh = newToken();
      await tx.refreshToken.create({ data: { sessionId: session.id, tokenHash: tokenHash(refresh) } });
      return { sessionId: session.id, userId: session.userId, refresh, expiresAt: session.expiresAt };
    });
    if (!result) throw new UnauthorizedException('Invalid or expired session');
    return { ...result, access: await this.tokens.sign(result.userId, result.sessionId) };
  }
  async logout(refresh: string | undefined, access: string | undefined) {
    let sessionId: string | undefined;
    if (refresh && /^[A-Za-z0-9_-]{43}$/.test(refresh)) {
      sessionId = (await this.db.refreshToken.findUnique({ where: { tokenHash: tokenHash(refresh) } }))?.sessionId;
    }
    if (!sessionId && access) {
      try { sessionId = (await this.tokens.verify(access)).sessionId; } catch { /* Idempotent logout */ }
    }
    if (sessionId) {
      await this.db.authSession.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: new Date() } });
      this.logger.log({ event: 'auth.logout', sessionId });
    }
  }
  // Raw tokens are consumed only by the explicit local CLI. HTTP controllers never return them.
  async issueOneTimeToken(email: string, purpose: Purpose): Promise<string | undefined> {
    const user = await this.db.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!user || user.status !== 'ACTIVE' || (purpose === 'verify' && user.emailVerifiedAt)) return;
    const raw = newToken();
    const data = { userId: user.id, tokenHash: tokenHash(raw),
      expiresAt: new Date(Date.now() + (purpose === 'reset' ? 30 * 60 * 1000 : 24 * 60 * 60 * 1000)) };
    await this.serial(async (tx) => {
      if (purpose === 'reset') {
        await tx.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
        await tx.passwordResetToken.create({ data });
      } else {
        await tx.emailVerificationToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
        await tx.emailVerificationToken.create({ data });
      }
    });
    this.logger.log({ event: 'auth.token_prepared', purpose, userId: user.id, delivery: 'not_configured' });
    return raw;
  }
  async resetPassword(raw: string, password: string) {
    const passwordHash = await this.passwords.hash(password);
    const valid = await this.serial(async (tx) => {
      const token = await tx.passwordResetToken.findUnique({ where: { tokenHash: tokenHash(raw) } });
      if (!token || token.usedAt || token.expiresAt <= new Date()) return false;
      const used = await tx.passwordResetToken.updateMany({ where: { id: token.id, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
      if (used.count !== 1) return false;
      await tx.user.update({ where: { id: token.userId }, data: { passwordHash, authVersion: { increment: 1 } } });
      await tx.authSession.updateMany({ where: { userId: token.userId, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.passwordResetToken.updateMany({ where: { userId: token.userId, usedAt: null }, data: { usedAt: new Date() } });
      return true;
    });
    if (!valid) throw new BadRequestException('Invalid or expired reset token');
    this.logger.log({ event: 'auth.password_reset' });
  }
  async verifyEmail(raw: string) {
    const valid = await this.serial(async (tx) => {
      const token = await tx.emailVerificationToken.findUnique({ where: { tokenHash: tokenHash(raw) } });
      if (!token || token.usedAt || token.expiresAt <= new Date()) return false;
      const used = await tx.emailVerificationToken.updateMany({ where: { id: token.id, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
      if (used.count !== 1) return false;
      await tx.user.update({ where: { id: token.userId }, data: { emailVerifiedAt: new Date() } });
      await tx.emailVerificationToken.updateMany({ where: { userId: token.userId, usedAt: null }, data: { usedAt: new Date() } });
      return true;
    });
    if (!valid) throw new BadRequestException('Invalid or expired verification token');
  }
}
