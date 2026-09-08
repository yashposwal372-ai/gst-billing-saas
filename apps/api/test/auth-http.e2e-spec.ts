import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/common/configure-app.js';
import { DatabaseService } from '../src/database/database.service.js';
import { TokenService } from '../src/auth/token.service.js';
import { newToken, tokenHash } from '../src/auth/token.service.js';
import { safeUserSelect } from '../src/users/user.select.js';

// HTTP pipeline and service tests with explicit database doubles: not live DB tests.
describe('auth HTTP (mocked database)', () => {
  let app: INestApplication;
  let origin: string;
  const safe = { id: 'a47e868a-cb3e-461f-b356-867d3d2ade59', email: 'owner@example.com', firstName: 'Test', lastName: 'Owner',
    mobile: null, emailVerifiedAt: null, currentBusinessId: null };
  let db: ReturnType<typeof databaseDouble>;
  function databaseDouble() {
    const db = {
      user: { create: vi.fn().mockResolvedValue({ ...safe, authVersion: 0 }), findUnique: vi.fn().mockResolvedValue(null),
        findUniqueOrThrow: vi.fn().mockResolvedValue(safe), update: vi.fn() },
      authSession: { create: vi.fn().mockResolvedValue({ id: '2bfe8626-91d8-4315-84a7-60267e04141c' }),
        findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
      refreshToken: { findUnique: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 1 }), create: vi.fn() },
      emailVerificationToken: { create: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
      passwordResetToken: { create: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
      businessMember: { findUnique: vi.fn() }, $transaction: vi.fn(),
    };
    db.$transaction.mockImplementation((work: (tx: unknown) => Promise<unknown>) => work(db));
    return db;
  }
  beforeEach(async () => {
    db = databaseDouble();
    const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(DatabaseService).useValue(db).compile();
    app = module.createNestApplication(); app.useLogger(false); configureApp(app); await app.init();
    origin = app.get(ConfigService).getOrThrow<string>('FRONTEND_URL');
  });
  afterEach(async () => { await app?.close(); });
  const post = (path: string) => request(app.getHttpServer()).post('/api/v1' + path).set('Origin', origin).set('X-CSRF-Protection', '1');
  async function accessCookie(overrides: Record<string, unknown> = {}) {
    const sessionId = '2bfe8626-91d8-4315-84a7-60267e04141c';
    const access = await app.get(TokenService).sign(safe.id, sessionId);
    db.authSession.findUnique.mockResolvedValue({
      id: sessionId, userId: safe.id, expiresAt: new Date(Date.now() + 100000), revokedAt: null, authVersion: 0,
      user: { ...safe, authVersion: 0, status: 'ACTIVE' }, ...overrides,
    });
    return 'gst_access=' + access;
  }
  it('rejects cross-origin writes and missing CSRF headers before database access', async () => {
    await request(app.getHttpServer()).post('/api/v1/auth/signup').send({}).expect(403);
    await post('/auth/signup').set('Origin', 'https://evil.example').send({}).expect(403);
    expect(db.user.create).not.toHaveBeenCalled();
  });
  it('sets HttpOnly auth cookies and never includes tokens/hashes in signup JSON', async () => {
    const result = await post('/auth/signup').send({ email: ' OWNER@EXAMPLE.COM ', firstName: 'Test', lastName: 'Owner', password: 'a strong test passphrase' }).expect(201);
    expect(result.body).toEqual({ user: safe, emailDelivery: 'not_configured' });
    expect(String(result.headers['set-cookie'])).toContain('HttpOnly');
    expect(String(result.headers['set-cookie'])).toContain('SameSite=Lax');
    expect(result.headers['cache-control']).toBe('no-store');
    expect(db.user.create.mock.calls[0]![0].data.email).toBe('owner@example.com');
    expect(db.user.findUniqueOrThrow).toHaveBeenCalledWith({ where: { id: safe.id }, select: safeUserSelect });
  });
  it('rejects unknown signup fields and short passwords', async () => {
    await post('/auth/signup').send({ email: safe.email, firstName: 'Test', lastName: 'Owner', password: 'short', role: 'OWNER' }).expect(400);
    expect(db.user.create).not.toHaveBeenCalled();
  });
  it('requires authentication for me and business routes', async () => {
    await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
    await request(app.getHttpServer()).get('/api/v1/businesses/current').expect(401);
    await post('/businesses').send({}).expect(401);
  });
  it('returns safe current user and rejects a revoked session even with valid JWT', async () => {
    const cookie = await accessCookie();
    const result = await request(app.getHttpServer()).get('/api/v1/auth/me').set('Cookie', cookie).expect(200);
    expect(result.body).toEqual({ user: safe });
    await accessCookie({ revokedAt: new Date() });
    await request(app.getHttpServer()).get('/api/v1/auth/me').set('Cookie', cookie).expect(401);
  });
  it('denies tenant membership mismatches and rejects client tenant assignment', async () => {
    const cookie = await accessCookie({ user: { ...safe, currentBusinessId: 'business-b', status: 'ACTIVE', authVersion: 0 } });
    db.businessMember.findUnique.mockResolvedValue(null);
    await request(app.getHttpServer()).get('/api/v1/businesses/current').set('Cookie', cookie).expect(403);
    await post('/businesses').set('Cookie', cookie).send({ businessId: 'business-b', userId: 'other' }).expect(400);
  });
  it('rotates refresh cookie then revokes a replayed refresh family', async () => {
    const raw = newToken(); const sessionId = 'session-1';
    db.refreshToken.findUnique.mockResolvedValue({ id: 'refresh-1', tokenHash: tokenHash(raw), usedAt: null,
      session: { id: sessionId, userId: safe.id, revokedAt: null, expiresAt: new Date(Date.now() + 100000),
        authVersion: 0, user: { ...safe, status: 'ACTIVE', authVersion: 0 } } });
    const result = await post('/auth/refresh').set('Cookie', 'gst_refresh=' + raw).expect(200);
    expect(result.body).toEqual({ status: 'ok' });
    expect(String(result.headers['set-cookie'])).not.toContain('gst_refresh=' + raw + ';');
    db.refreshToken.updateMany.mockResolvedValue({ count: 0 });
    await post('/auth/refresh').set('Cookie', 'gst_refresh=' + raw).expect(401);
    expect(db.authSession.update).toHaveBeenCalledWith({ where: { id: sessionId }, data: { revokedAt: expect.any(Date) } });
  });
  it('logout revokes the session and clears cookies', async () => {
    db.refreshToken.findUnique.mockResolvedValue({ sessionId: 'session-1' });
    const result = await post('/auth/logout').set('Cookie', 'gst_refresh=' + newToken()).expect(200);
    expect(db.authSession.updateMany).toHaveBeenCalled();
    expect(String(result.headers['set-cookie'])).toContain('Expires=Thu, 01 Jan 1970');
  });
  it('forgot password does not reveal account existence or leak tokens', async () => {
    const absent = await post('/auth/forgot-password').send({ email: 'missing@example.com' }).expect(200);
    db.user.findUnique.mockResolvedValue({ ...safe, status: 'ACTIVE' });
    const present = await post('/auth/forgot-password').send({ email: safe.email }).expect(200);
    expect(absent.body).toEqual(present.body);
    expect(Object.keys(present.body)).toEqual(['message']);
    expect(db.passwordResetToken.create).toHaveBeenCalled();
  });
  it('returns generic login errors, and invalid reset/verification token errors', async () => {
    await post('/auth/login').send({ email: safe.email, password: 'wrong test passphrase' }).expect(401);
    await post('/auth/reset-password').send({ token: newToken(), password: 'a new test passphrase' }).expect(400);
    await post('/auth/verify-email').send({ token: newToken() }).expect(400);
  });
  it('rate limits repeated sensitive endpoint calls with an isolated store per app', async () => {
    for (let i = 0; i < 30; i++) await post('/auth/login').send({}).expect(400);
    const result = await post('/auth/login').send({}).expect(429);
    expect(result.body.message).toContain('Too many attempts');
    expect(result.headers['retry-after']).toBeDefined();
  });
});
