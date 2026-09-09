import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/common/configure-app.js';
import { DatabaseService } from '../src/database/database.service.js';
import { TokenService } from '../src/auth/token.service.js';
import { Prisma } from '../src/generated/prisma/client.js';

describe('dashboard HTTP (database double, real auth guard)', () => {
  let app: INestApplication;
  let cookie: string;
  const user = { id: 'user-a', currentBusinessId: 'business-a', status: 'ACTIVE', authVersion: 0 };
  const session = { id: 'session-a', userId: user.id, user, expiresAt: new Date(Date.now() + 600000), revokedAt: null, authVersion: 0 };
  const membership = { role: 'OWNER', business: { id: 'business-a', name: 'Authorized business', onboardingCompletedAt: new Date(), _count: { customers: 3, suppliers: 2 } } };
  const db = { product: {count:vi.fn(),fields:{minimumStock:'minimumStock'}}, invoice: { aggregate: vi.fn() }, businessDocument: { aggregate: vi.fn() }, authSession: { findUnique: vi.fn() }, businessMember: { findUnique: vi.fn() } };
  beforeEach(async () => {
    vi.resetAllMocks();
    db.product.count.mockResolvedValueOnce(5).mockResolvedValueOnce(2);
    db.invoice.aggregate
      .mockResolvedValueOnce({ _sum: { grandTotal: new Prisma.Decimal('12.34') } })
      .mockResolvedValueOnce({ _sum: { grandTotal: new Prisma.Decimal('123.45') } })
      .mockResolvedValue({ _sum: { grandTotal: new Prisma.Decimal('123.45') } });
    db.businessDocument.aggregate.mockResolvedValue({ _sum: { grandTotal: new Prisma.Decimal('234.56') } });
    db.authSession.findUnique.mockResolvedValue(session);
    db.businessMember.findUnique.mockResolvedValue(membership);
    const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(DatabaseService).useValue(db).compile();
    app = module.createNestApplication(); app.useLogger(false); configureApp(app); await app.init();
    cookie = 'gst_access=' + await app.get(TokenService).sign(user.id, session.id);
  });
  afterEach(async () => { await app.close(); });
  const get = (query = '') => request(app.getHttpServer()).get('/api/v1/dashboard/summary' + query).set('Cookie', cookie);
  it('requires authentication', async () => {
    await request(app.getHttpServer()).get('/api/v1/dashboard/summary').expect(401);
    expect(db.businessMember.findUnique).not.toHaveBeenCalled();
  });
  it('returns authorized business and truthful unavailable metrics without sensitive details', async () => {
    const result = await get().expect(200);
    expect(result.body.business).toEqual({ id: 'business-a', name: 'Authorized business', role: 'OWNER', onboardingCompleted: true });
    expect(result.body.dataStatus).toBe('not_available');
    const { customers, suppliers, products, lowStock, todaySales, monthlySales, totalPurchases, ...future } = result.body.metrics;
    expect(customers).toBe(3);
    expect(suppliers).toBe(2);
    expect(products).toBe(5);expect(lowStock).toBe(2);
    expect(todaySales).toBe('12.34');
    expect(monthlySales).toBe('123.45');
    expect(totalPurchases).toBe('234.56');
    expect(db.product.count.mock.calls[0]![0].where).toMatchObject({businessId:user.currentBusinessId,type:"PRODUCT",isActive:true,business:{memberships:{some:{userId:user.id,role:"OWNER"}}}});
    expect(Object.values(future).every((value) => value === null)).toBe(true);
    expect(db.businessMember.findUnique.mock.calls[0]![0].select.business.select._count.select).toEqual({customers:{where:{isActive:true}},suppliers:{where:{isActive:true}}});
    expect(result.body.recentActivity).toEqual([]);
    expect(Object.values(result.body.charts).every((value) => Array.isArray(value) && value.length === 0)).toBe(true);
    expect(result.headers['cache-control']).toBe('no-store');
    expect(db.businessMember.findUnique.mock.calls[0]![0].where).toEqual({ userId_businessId: { userId: user.id, businessId: user.currentBusinessId } });
    expect(db.invoice.aggregate.mock.calls[0]![0].where).toMatchObject({ businessId: user.currentBusinessId, status: 'FINALIZED' });
  });
  it.each([null, { ...membership, role: 'MEMBER' }])('rejects missing or non-owner membership: %j', async (value) => {
    db.businessMember.findUnique.mockResolvedValue(value);
    await get().expect(403);
  });
  it('rejects revoked sessions', async () => {
    db.authSession.findUnique.mockResolvedValue({ ...session, revokedAt: new Date() });
    await get().expect(401);
  });
  it('rejects client tenant spoofing', async () => {
    await get('?businessId=business-b').expect(400);
    expect(db.businessMember.findUnique).not.toHaveBeenCalled();
  });
  it('returns missing-business state for onboarding without querying membership', async () => {
    db.authSession.findUnique.mockResolvedValue({ ...session, user: { ...user, currentBusinessId: null } });
    expect((await get().expect(200)).body.business).toBeNull();
    expect(db.businessMember.findUnique).not.toHaveBeenCalled();
  });
  it('acknowledges a valid empty custom date range', async () => {
    const result = await get('?period=custom&start=2026-04-01&end=2026-09-08').expect(200);
    expect(result.body.filter).toEqual({ period: 'custom', start: '2026-04-01', end: '2026-09-08', timezone: 'Asia/Kolkata' });
  });
  it.each(['?period=unknown', '?period=custom', '?period=custom&start=2026-02-30&end=2026-03-01',
    '?period=custom&start=2026-09-08&end=2026-04-01', '?start=2026-01-01'])('rejects invalid filters %s', async (query) => {
    await get(query).expect(400);
  });
});
