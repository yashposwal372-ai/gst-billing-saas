import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/common/configure-app.js';
import { DatabaseService } from '../src/database/database.service.js';
import { TokenService } from '../src/auth/token.service.js';
import { Prisma } from '../src/generated/prisma/client.js';

describe.each(['customers', 'suppliers'] as const)(
  '%s HTTP (database doubles, real guards/services)',
  (kind) => {
    let app: INestApplication, cookie: string;
    const id = '11111111-1111-4111-8111-111111111111';
    const user = {
      id: 'owner-a',
      currentBusinessId: 'business-a',
      status: 'ACTIVE',
      authVersion: 0,
    };
    const session = {
      id: 'session-a',
      userId: user.id,
      user,
      expiresAt: new Date(Date.now() + 600000),
      revokedAt: null,
      authVersion: 0,
    };
    const code = kind === 'customers' ? 'customerCode' : 'supplierCode';
    const counter =
      kind === 'customers' ? 'nextCustomerNumber' : 'nextSupplierNumber';
    const body = {
      displayName: 'Market Traders',
      phone: '9876543210',
      addressLine1: '12 Market Road',
      city: 'Pune',
      state: 'Maharashtra',
      stateCode: '27',
      pincode: '411001',
      openingBalance: '123.45',
    };
    const stored = {
      ...body,
      id,
      businessId: 'business-a',
      [code]: 'TEST-000001',
      openingBalance: new Prisma.Decimal('123.45'),
      openingBalanceType: 'RECEIVABLE',
      gstRegistered: false,
      gstin: null,
      pan: null,
      businessName: null,
      contactPerson: null,
      email: null,
      whatsappNumber: null,
      addressLine2: null,
      notes: null,
      paymentTermsDays: 0,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...(kind === 'customers'
        ? {
            customerType: 'INDIVIDUAL',
            shippingSameAsBilling: true,
            shippingAddressLine1: null,
            shippingAddressLine2: null,
            shippingCity: null,
            shippingState: null,
            shippingStateCode: null,
            shippingPincode: null,
            creditLimit: null,
          }
        : {
            bankName: 'Test Bank',
            accountHolderName: 'Owner',
            accountNumber: '123456789',
            ifsc: 'ABCD0123456',
            upiId: null,
          }),
    };
    const delegate = {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
      findFirstOrThrow: vi.fn(),
      updateMany: vi.fn(),
    };
    const db = {
      authSession: { findUnique: vi.fn() },
      businessMember: { findUnique: vi.fn() },
      business: { update: vi.fn() },
      customer: delegate,
      invoice: { aggregate: vi.fn() },
      businessDocument: { aggregate: vi.fn(), count: vi.fn() },
      paymentAllocation: { aggregate: vi.fn() },
      supplier: delegate,
      $transaction: vi.fn(),
    };
    beforeEach(async () => {
      vi.resetAllMocks();
      db.authSession.findUnique.mockResolvedValue(session);
      db.businessMember.findUnique.mockResolvedValue({ role: 'OWNER' });
      db.business.update.mockResolvedValue({ [counter]: 1 });
      db.invoice.aggregate.mockResolvedValue({ _sum: { grandTotal: new Prisma.Decimal('456.78') }, _count: { id: 3 } });
      db.businessDocument.aggregate.mockResolvedValue({ _sum: { grandTotal: new Prisma.Decimal('345.67') } });
      db.businessDocument.count.mockResolvedValue(4);
      db.paymentAllocation.aggregate.mockResolvedValue({ _sum: { amount: new Prisma.Decimal('111.11') } });
      db.$transaction.mockImplementation((fn) => fn(db));
      delegate.create.mockImplementation(({ data }) => ({
        ...stored,
        ...data,
      }));
      delegate.findFirst.mockResolvedValue(stored);
      delegate.findFirstOrThrow.mockResolvedValue(stored);
      delegate.updateMany.mockResolvedValue({ count: 1 });
      delegate.count.mockResolvedValue(42);
      delegate.findMany.mockResolvedValue([]);
      const module = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(DatabaseService)
        .useValue(db)
        .compile();
      app = module.createNestApplication();
      app.useLogger(false);
      configureApp(app);
      await app.init();
      cookie =
        'gst_access=' + (await app.get(TokenService).sign(user.id, session.id));
    });
    afterEach(async () => app.close());
    const client = () => request(app.getHttpServer());
    const get = (suffix = '') =>
      client()
        .get('/api/v1/' + kind + suffix)
        .set('Cookie', cookie);
    const post = (value: object) =>
      client()
        .post('/api/v1/' + kind)
        .set('Cookie', cookie)
        .set('Origin', 'http://localhost:3000')
        .set('X-CSRF-Protection', '1')
        .send(value);
    const patch = (value: object) =>
      client()
        .patch('/api/v1/' + kind + '/' + id)
        .set('Cookie', cookie)
        .set('Origin', 'http://localhost:3000')
        .set('X-CSRF-Protection', '1')
        .send(value);
    const deactivate = () =>
      client()
        .delete('/api/v1/' + kind + '/' + id)
        .set('Cookie', cookie)
        .set('Origin', 'http://localhost:3000')
        .set('X-CSRF-Protection', '1');
    it('requires authentication', async () => {
      await client()
        .get('/api/v1/' + kind)
        .expect(401);
      expect(delegate.findMany).not.toHaveBeenCalled();
    });
    it('requires write origin and CSRF header', async () => {
      await client()
        .post('/api/v1/' + kind)
        .set('Cookie', cookie)
        .send(body)
        .expect(403);
      await client()
        .delete('/api/v1/' + kind + '/' + id)
        .set('Cookie', cookie)
        .expect(403);
    });
    it('rejects revoked sessions', async () => {
      db.authSession.findUnique.mockResolvedValue({
        ...session,
        revokedAt: new Date(),
      });
      await get().expect(401);
    });
    it('creates with authorized tenant, atomic code and exact decimals', async () => {
      const result = await post(body).expect(201);
      expect(result.body.profile[code]).toBe(
        (kind === 'customers' ? 'CUS' : 'SUP') + '-000001',
      );
      expect(result.body.profile.openingBalance).toBe('123.45');
      expect(result.body.profile.businessId).toBeUndefined();
      expect(db.business.update.mock.calls[0]![0]).toEqual({
        where: { id: 'business-a' },
        data: { [counter]: { increment: 1 } },
        select: { [counter]: true },
      });
      expect(delegate.create.mock.calls[0]![0].data.businessId).toBe(
        'business-a',
      );
    });
    it.each(['businessId', 'tenantId', 'customerCode', 'supplierCode'])(
      'rejects body spoof %s',
      async (field) => {
        await post({ ...body, [field]: 'evil' }).expect(400);
        expect(delegate.create).not.toHaveBeenCalled();
      },
    );
    it('rejects query spoofing', async () => {
      await get('?businessId=business-b').expect(400);
    });
    it.each([null, { role: 'MEMBER' }])(
      'rejects unauthorized memberships %j',
      async (membership) => {
        db.businessMember.findUnique.mockResolvedValue(membership);
        await get().expect(403);
        await post(body).expect(403);
        await patch({ displayName: 'Changed' }).expect(403);
        await deactivate().expect(403);
      },
    );
    it('requires onboarding business', async () => {
      db.authSession.findUnique.mockResolvedValue({
        ...session,
        user: { ...user, currentBusinessId: null },
      });
      await get().expect(403);
    });
    it('scopes list/count and whitelists pagination, filters, search and sort', async () => {
      const result = await get(
        '?page=2&pageSize=20&search=Market&status=inactive&gstRegistered=true&state=Maharashtra&sortBy=code&sortOrder=desc',
      ).expect(200);
      expect(result.body).toMatchObject({
        page: 2,
        pageSize: 20,
        total: 42,
        totalPages: 3,
      });
      const args = delegate.findMany.mock.calls[0]![0];
      expect(args).toMatchObject({
        skip: 20,
        take: 20,
        where: {
          businessId: 'business-a',
          business: {
            memberships: { some: { userId: 'owner-a', role: 'OWNER' } },
          },
          isActive: false,
          gstRegistered: true,
          state: { equals: 'Maharashtra', mode: 'insensitive' },
        },
        orderBy: [{ [code]: 'desc' }, { id: 'asc' }],
      });
      expect(args.where.OR).toContainEqual({
        [code]: { contains: 'Market', mode: 'insensitive' },
      });
      expect(delegate.count.mock.calls[0]![0].where).toEqual(args.where);
      expect(args.select.accountNumber).toBeUndefined();
      expect(args.select.notes).toBeUndefined();
    });
    it.each([
      '?page=0',
      '?pageSize=101',
      '?sortBy=bankName',
      '?sortOrder=bad',
      '?gstRegistered=1',
      '?page=1.5',
    ])('rejects invalid query %s', async (query) => {
      await get(query).expect(400);
    });
    it('returns detail with empty ledger and current Phase 7 party totals', async () => {
      const result = await get('/' + id).expect(200);
      expect(result.body.ledgerEntries).toEqual([]);
      expect(result.body.activity).toEqual([]);
      if (kind === 'customers') {
        expect(result.body.summary.totalSales).toBe('456.78');
        expect(result.body.summary.invoiceCount).toBe(3);
        expect(result.body.summary.totalPaid).toBe('111.11');
        expect(result.body.summary.outstanding).toBe('345.67');
      } else {
        expect(result.body.summary.totalPurchases).toBe('345.67');
        expect(result.body.summary.purchaseCount).toBe(4);
        expect(result.body.summary.amountPaid).toBe('111.11');
        expect(result.body.summary.amountPayable).toBe('234.56');
      }
      expect(delegate.findFirst.mock.calls[0]![0].where).toMatchObject({
        id,
        businessId: 'business-a',
        business: {
          memberships: { some: { userId: 'owner-a', role: 'OWNER' } },
        },
      });
    });
    it('does not read, update or deactivate another tenant record', async () => {
      delegate.findFirst.mockResolvedValue(null);
      await get('/' + id).expect(404);
      await patch({ displayName: 'Changed' }).expect(404);
      await deactivate().expect(404);
      expect(delegate.updateMany).not.toHaveBeenCalled();
    });
    it('supports partial update without clearing omitted fields', async () => {
      await patch({ displayName: 'New name' }).expect(200);
      expect(delegate.updateMany.mock.calls[0]![0]).toMatchObject({
        where: { id, businessId: 'business-a' },
        data: { displayName: 'New name', phone: body.phone },
      });
      expect(db.$transaction.mock.calls[0]![1]).toEqual({
        isolationLevel: 'Serializable',
      });
    });
    it('deactivates and reactivates without deletion', async () => {
      await deactivate().expect(200);
      expect(delegate.updateMany.mock.calls[0]![0].data.isActive).toBe(false);
      await patch({ isActive: true }).expect(200);
      expect(delegate.updateMany.mock.calls[1]![0].data.isActive).toBe(true);
    });
    it('returns sanitized duplicate conflicts', async () => {
      delegate.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('raw secret constraint', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );
      const result = await post(body).expect(409);
      expect(JSON.stringify(result.body)).not.toContain('raw secret');
    });
    it.each([
      { openingBalance: 1.1 },
      { openingBalance: '-1' },
      { openingBalance: '1.001' },
      { displayName: null },
      { phone: 'bad' },
      { email: 'bad' },
      { pan: 'bad' },
      { gstRegistered: true },
      { gstRegistered: true, gstin: '29ABCDE1234F1Z5' },
      { paymentTermsDays: -1 },
    ])('rejects invalid data %j', async (fields) => {
      await post({ ...body, ...fields }).expect(400);
      expect(delegate.create).not.toHaveBeenCalled();
    });
    it('requires create fields', async () => {
      await post({}).expect(400);
    });
    it('rejects inconsistent state names and codes', async () => {
      await post({ ...body, stateCode: '29' }).expect(400);
    });
    it('rejects invalid record IDs', async () => {
      await get('/not-a-uuid').expect(400);
    });
    it('checks conditional shipping or bank completeness', async () => {
      await post({
        ...body,
        ...(kind === 'customers'
          ? { shippingSameAsBilling: false }
          : { bankName: 'Only bank' }),
      }).expect(400);
    });
  },
);
