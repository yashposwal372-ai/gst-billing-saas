import { ConfigService } from '@nestjs/config';
import { Prisma } from '../generated/prisma/client.js';
import { AuthService } from './auth.service.js';
import { PasswordService } from './password.service.js';
import { TokenService, newToken, tokenHash } from './token.service.js';
import type { DatabaseService } from '../database/database.service.js';
import { safeUserSelect } from '../users/user.select.js';

describe('AuthService (mocked database, real crypto)', () => {
  const passwords = new PasswordService();
  const tokens = new TokenService(new ConfigService({ JWT_SECRET: 'k'.repeat(48) }));
  const user = { id: 'user-1', email: 'owner@example.com', firstName: 'Test', lastName: 'Owner', mobile: null,
    emailVerifiedAt: null, currentBusinessId: null, authVersion: 0, status: 'ACTIVE', passwordHash: '' };
  function setup() {
    const db = {
      user: { create: vi.fn().mockResolvedValue(user), findUnique: vi.fn().mockResolvedValue(user),
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: user.id, email: user.email }),
        update: vi.fn() },
      authSession: { create: vi.fn().mockResolvedValue({ id: 'session-1' }), update: vi.fn(), updateMany: vi.fn() },
      refreshToken: { findUnique: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 1 }), create: vi.fn() },
      passwordResetToken: { findUnique: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 1 }), create: vi.fn() },
      emailVerificationToken: { findUnique: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 1 }), create: vi.fn() },
      $transaction: vi.fn(),
    };
    db.$transaction.mockImplementation((work: (tx: unknown) => Promise<unknown>) => work(db));
    return { db, service: new AuthService(db as unknown as DatabaseService, passwords, tokens) };
  }
  it('hashes signup passwords with Argon2id, normalizes email and returns only selected user fields', async () => {
    const { db, service } = setup();
    const result = await service.signup({ email: ' OWNER@EXAMPLE.COM ', password: 'a secure test passphrase', firstName: 'Test', lastName: 'Owner' });
    const saved = db.user.create.mock.calls[0]![0].data;
    expect(saved.email).toBe('owner@example.com');
    expect(saved.passwordHash).toMatch(/^\$argon2id\$/);
    expect(await passwords.verify(saved.passwordHash, 'a secure test passphrase')).toBe(true);
    expect(saved.passwordHash).not.toContain('a secure test passphrase');
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(db.user.findUniqueOrThrow).toHaveBeenCalledWith({ where: { id: user.id }, select: safeUserSelect });
    const savedSession = db.authSession.create.mock.calls[0]![0].data;
    expect(savedSession.tokens.create.tokenHash).toBe(tokenHash(result.refresh));
    expect(savedSession.tokens.create.tokenHash).not.toBe(result.refresh);
    expect(await tokens.verify(result.access)).toEqual({ userId: user.id, sessionId: 'session-1' });
  });
  it('rejects duplicate email including database uniqueness races', async () => {
    const { db, service } = setup();
    db.user.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: '7' }));
    await expect(service.signup({ email: user.email, password: 'a secure test passphrase', firstName: 'Test', lastName: 'Owner' })).rejects.toThrow('already exists');
  });
  it('logs in using real Argon2 verification', async () => {
    const { db, service } = setup();
    db.user.findUnique.mockResolvedValue({ ...user, passwordHash: await passwords.hash('a secure test passphrase') });
    const result = await service.login({ email: user.email, password: 'a secure test passphrase' });
    expect(await tokens.verify(result.access)).toEqual({ userId: user.id, sessionId: 'session-1' });
  });
  it.each(['missing', 'wrong', 'disabled'])('returns generic credentials error for %s accounts', async (kind) => {
    const { db, service } = setup();
    db.user.findUnique.mockResolvedValue(kind === 'missing' ? null : { ...user,
      status: kind === 'disabled' ? 'DISABLED' : 'ACTIVE', passwordHash: await passwords.hash('a secure test passphrase') });
    await expect(service.login({ email: user.email, password: kind === 'wrong' ? 'incorrect passphrase' : 'a secure test passphrase' })).rejects.toThrow('Invalid email or password');
    expect(db.authSession.create).not.toHaveBeenCalled();
  });
  function refreshRecord() {
    return { id: 'refresh-1', usedAt: null, session: { id: 'session-1', userId: user.id,
      authVersion: 0, user, revokedAt: null, expiresAt: new Date(Date.now() + 100000) } };
  }
  it('rotates refresh tokens atomically and keeps the original session expiration', async () => {
    const { db, service } = setup(); const record = refreshRecord(); const raw = newToken();
    db.refreshToken.findUnique.mockResolvedValue(record);
    const result = await service.refresh(raw);
    expect(result.refresh).not.toBe(raw);
    expect(result.expiresAt).toEqual(record.session.expiresAt);
    expect(db.refreshToken.updateMany).toHaveBeenCalledWith({ where: { id: record.id, usedAt: null }, data: { usedAt: expect.any(Date) } });
    expect(db.refreshToken.create).toHaveBeenCalledWith({ data: { sessionId: 'session-1', tokenHash: tokenHash(result.refresh) } });
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
  });
  it('commits session revocation on refresh reuse or lost atomic claim', async () => {
    const { db, service } = setup();
    db.refreshToken.findUnique.mockResolvedValue(refreshRecord());
    db.refreshToken.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.refresh(newToken())).rejects.toThrow('Invalid or expired session');
    expect(db.authSession.update).toHaveBeenCalledWith({ where: { id: 'session-1' }, data: { revokedAt: expect.any(Date) } });
    expect(db.refreshToken.create).not.toHaveBeenCalled();
  });
  it.each(['expired', 'revoked', 'password-changed', 'disabled'])('rejects %s refresh sessions', async (kind) => {
    const { db, service } = setup(); const record = refreshRecord();
    db.refreshToken.findUnique.mockResolvedValue({ ...record, session: { ...record.session,
      expiresAt: kind === 'expired' ? new Date(0) : record.session.expiresAt,
      revokedAt: kind === 'revoked' ? new Date() : null,
      authVersion: kind === 'password-changed' ? -1 : 0,
      user: { ...user, status: kind === 'disabled' ? 'DISABLED' : 'ACTIVE' } } });
    await expect(service.refresh(newToken())).rejects.toThrow('Invalid');
    expect(db.refreshToken.create).not.toHaveBeenCalled();
  });
  it('revokes logout session, including expired access with valid refresh cookie', async () => {
    const { db, service } = setup();
    db.refreshToken.findUnique.mockResolvedValue({ sessionId: 'session-1' });
    await service.logout(newToken(), 'expired');
    expect(db.authSession.updateMany).toHaveBeenCalledWith({ where: { id: 'session-1', revokedAt: null }, data: { revokedAt: expect.any(Date) } });
  });
  it('stores only hashes for reset and verification tokens with expiration', async () => {
    const { db, service } = setup();
    for (const purpose of ['reset', 'verify'] as const) {
      const raw = await service.issueOneTimeToken(user.email, purpose);
      const delegate = purpose === 'reset' ? db.passwordResetToken : db.emailVerificationToken;
      expect(delegate.create).toHaveBeenCalledWith({ data: { userId: user.id, tokenHash: tokenHash(raw!), expiresAt: expect.any(Date) } });
      expect(delegate.updateMany).toHaveBeenCalled(); // Invalidates previous unused requests.
    }
  });
  it.each(['reset', 'verify'] as const)('does not create %s tokens for nonexistent accounts', async (purpose) => {
    const { db, service } = setup(); db.user.findUnique.mockResolvedValue(null);
    expect(await service.issueOneTimeToken('absent@example.com', purpose)).toBeUndefined();
    expect(db.passwordResetToken.create).not.toHaveBeenCalled();
    expect(db.emailVerificationToken.create).not.toHaveBeenCalled();
  });
  it.each(['expired', 'used', 'missing'])('rejects %s password reset and verification tokens', async (kind) => {
    const { db, service } = setup();
    const record = kind === 'missing' ? null : { id: 'token-1', userId: user.id,
      usedAt: kind === 'used' ? new Date() : null, expiresAt: kind === 'expired' ? new Date(0) : new Date(Date.now() + 100000) };
    db.passwordResetToken.findUnique.mockResolvedValue(record); db.emailVerificationToken.findUnique.mockResolvedValue(record);
    await expect(service.resetPassword(newToken(), 'a new secure passphrase')).rejects.toThrow('Invalid or expired');
    await expect(service.verifyEmail(newToken())).rejects.toThrow('Invalid or expired');
    expect(db.user.update).not.toHaveBeenCalled();
  });
  it('consumes reset once, changes password and invalidates all sessions/version', async () => {
    const { db, service } = setup();
    db.passwordResetToken.findUnique.mockResolvedValue({ id: 'reset-1', userId: user.id, usedAt: null, expiresAt: new Date(Date.now() + 100000) });
    await service.resetPassword(newToken(), 'a new secure passphrase');
    const update = db.user.update.mock.calls[0]![0];
    expect(update.data.authVersion).toEqual({ increment: 1 });
    expect(await passwords.verify(update.data.passwordHash, 'a new secure passphrase')).toBe(true);
    expect(db.authSession.updateMany).toHaveBeenCalled();
    db.passwordResetToken.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.resetPassword(newToken(), 'another new secure passphrase')).rejects.toThrow('Invalid or expired');
    expect(db.user.update).toHaveBeenCalledTimes(1);
  });
  it('consumes verification once and updates emailVerifiedAt', async () => {
    const { db, service } = setup();
    db.emailVerificationToken.findUnique.mockResolvedValue({ id: 'verify-1', userId: user.id, usedAt: null, expiresAt: new Date(Date.now() + 100000) });
    await service.verifyEmail(newToken());
    expect(db.user.update).toHaveBeenCalledWith({ where: { id: user.id }, data: { emailVerifiedAt: expect.any(Date) } });
    db.emailVerificationToken.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.verifyEmail(newToken())).rejects.toThrow('Invalid or expired');
    expect(db.user.update).toHaveBeenCalledTimes(1);
  });
});
