import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { DatabaseService } from '../src/database/database.service.js';
import { configureApp } from '../src/common/configure-app.js';
import { AuthService } from '../src/auth/auth.service.js';
import { PasswordService } from '../src/auth/password.service.js';
import { tokenHash } from '../src/auth/token.service.js';

// Opt-in real PostgreSQL suite. Never substitutes mocks or resets a database.
// Apply migrations to a dedicated *_test database first, then set TEST_DATABASE_URL.
describe.skipIf(!process.env.TEST_DATABASE_URL)('auth/onboarding (real PostgreSQL)', () => {
  let app: INestApplication; let db: DatabaseService; let origin: string;
  const emails: string[] = []; const businesses: string[] = [];
  beforeAll(async () => {
    const url = process.env.TEST_DATABASE_URL!;
    if (!new URL(url).pathname.endsWith('_test')) throw new Error('TEST_DATABASE_URL must name a dedicated *_test database');
    db = new DatabaseService(new ConfigService({ DATABASE_URL: url }));
    await db.$connect();
    const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(DatabaseService).useValue(db).compile();
    app = module.createNestApplication(); app.useLogger(false); configureApp(app); await app.init();
    origin = app.get(ConfigService).getOrThrow<string>('FRONTEND_URL');
  });
  afterAll(async () => {
    if (db) {
      // Delete only records this run created, never truncate/reset.
      await db.user.deleteMany({ where: { email: { in: emails } } });
      await db.business.deleteMany({ where: { id: { in: businesses } } });
    }
    await app?.close(); await db?.$disconnect();
  });
  const post = (path: string) => request(app.getHttpServer()).post('/api/v1' + path).set('Origin', origin).set('X-CSRF-Protection', '1');
  const cookies = (response: { headers: Record<string, unknown> }) => (response.headers['set-cookie'] as string[]).map((cookie) => cookie.split(';')[0]!).join('; ');
  const data = { name: 'Test business', ownerName: 'Test Owner', businessType: 'PROPRIETORSHIP', gstRegistered: false,
    mobile: '9876543210', email: 'test@example.com', addressLine1: '10 Test Street', state: 'Maharashtra',
    stateCode: '27', city: 'Pune', pincode: '411001', invoicePrefix: 'INV', financialYear: '2026-27', gstMode: 'NOT_APPLICABLE' };
  it('persists signup, enforces ownership, rotates/revokes sessions, resets password and verifies email', async () => {
    const email = randomUUID() + '@phase2.example'; emails.push(email);
    const signup = await post('/auth/signup').send({ email, password: 'a strong test passphrase', firstName: 'Test', lastName: 'Owner' }).expect(201);
    const originalCookies = cookies(signup);
    const user = await db.user.findUniqueOrThrow({ where: { email } });
    expect(await app.get(PasswordService).verify(user.passwordHash, 'a strong test passphrase')).toBe(true);
    await post('/auth/signup').send({ email, password: 'a strong test passphrase', firstName: 'Test', lastName: 'Owner' }).expect(409);
    await request(app.getHttpServer()).get('/api/v1/auth/me').set('Cookie', originalCookies).expect(200);
    const created = await post('/businesses').set('Cookie', originalCookies).send(data).expect(201);
    businesses.push(created.body.business.id);
    expect(await db.businessMember.findUnique({ where: { userId_businessId: { userId: user.id, businessId: created.body.business.id } } })).toMatchObject({ role: 'OWNER' });
    await post('/businesses').set('Cookie', originalCookies).send(data).expect(409);
    const otherEmail = randomUUID() + '@phase2.example'; emails.push(otherEmail);
    const other = await post('/auth/signup').send({ email: otherEmail, password: 'a strong test passphrase', firstName: 'Other', lastName: 'Owner' }).expect(201);
    await request(app.getHttpServer()).patch('/api/v1/businesses/current').set('Origin', origin).set('X-CSRF-Protection', '1').set('Cookie', cookies(other)).send(data).expect(403);
    const rotated = await post('/auth/refresh').set('Cookie', originalCookies).expect(200);
    await post('/auth/refresh').set('Cookie', originalCookies).expect(401); // Replay revokes family.
    await request(app.getHttpServer()).get('/api/v1/auth/me').set('Cookie', cookies(rotated)).expect(401);
    const login = await post('/auth/login').send({ email, password: 'a strong test passphrase' }).expect(200);
    const raw = await app.get(AuthService).issueOneTimeToken(email, 'reset');
    expect(await db.passwordResetToken.findUnique({ where: { tokenHash: tokenHash(raw!) } })).toBeTruthy();
    await post('/auth/reset-password').send({ token: raw, password: 'a different strong passphrase' }).expect(200);
    await post('/auth/reset-password').send({ token: raw, password: 'a different strong passphrase' }).expect(400);
    await request(app.getHttpServer()).get('/api/v1/auth/me').set('Cookie', cookies(login)).expect(401);
    await post('/auth/login').send({ email, password: 'a strong test passphrase' }).expect(401);
    const newLogin = await post('/auth/login').send({ email, password: 'a different strong passphrase' }).expect(200);
    const verification = await app.get(AuthService).issueOneTimeToken(email, 'verify');
    await post('/auth/verify-email').send({ token: verification }).expect(200);
    await post('/auth/verify-email').send({ token: verification }).expect(400);
    expect((await db.user.findUniqueOrThrow({ where: { email } })).emailVerifiedAt).not.toBeNull();
    await post('/auth/logout').set('Cookie', cookies(newLogin)).expect(200);
    await request(app.getHttpServer()).get('/api/v1/auth/me').set('Cookie', cookies(newLogin)).expect(401);
  });
});
