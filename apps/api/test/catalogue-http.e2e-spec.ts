import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/common/configure-app.js';
import { DatabaseService } from '../src/database/database.service.js';
import { TokenService } from '../src/auth/token.service.js';
import { Prisma } from '@gst/prisma-client/client';
describe('catalogue HTTP (real guards/services, database double)', () => {
  let app: INestApplication, cookie: string;
  const id = '11111111-1111-4111-8111-111111111111';
  const categoryId = '22222222-2222-4222-8222-222222222222';
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
  const delegate = () => ({
    create: vi.fn(),
    findFirst: vi.fn(),
    findFirstOrThrow: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    updateMany: vi.fn(),
    fields: { minimumStock: 'minimumStock' },
  });
  const db = {
    authSession: { findUnique: vi.fn() },
    businessMember: { findUnique: vi.fn() },
    business: { update: vi.fn() },
    product: delegate(),
    category: delegate(),
    stockMovement: delegate(),
    $transaction: vi.fn(),
  };
  const stored = {
    id,
    businessId: user.currentBusinessId,
    productCode: 'PRD-000001',
    name: 'Test product',
    type: 'PRODUCT',
    unit: 'KG',
    categoryId: null,
    description: null,
    sku: null,
    barcode: null,
    hsnSacCode: null,
    gstRate: new Prisma.Decimal(18),
    purchasePrice: new Prisma.Decimal('0.10'),
    salePrice: new Prisma.Decimal('0.30'),
    mrp: null,
    trackInventory: true,
    openingStock: new Prisma.Decimal('1.100'),
    currentStock: new Prisma.Decimal('1.100'),
    minimumStock: new Prisma.Decimal('1.000'),
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    category: null,
  };
  const category = {
    id: categoryId,
    businessId: user.currentBusinessId,
    name: 'Food',
    nameKey: 'food',
    description: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  beforeEach(async () => {
    vi.resetAllMocks();
    db.$transaction.mockImplementation((fn) => fn(db));
    db.authSession.findUnique.mockResolvedValue(session);
    db.businessMember.findUnique.mockResolvedValue({ role: 'OWNER' });
    db.business.update.mockResolvedValue({ nextProductNumber: 1 });
    db.product.findFirst.mockResolvedValue(stored);
    db.product.findFirstOrThrow.mockResolvedValue(stored);
    db.product.create.mockImplementation(({ data }) => ({
      ...stored,
      ...data,
    }));
    db.product.updateMany.mockResolvedValue({ count: 1 });
    db.product.findMany.mockResolvedValue([stored]);
    db.product.count.mockResolvedValue(1);
    db.category.findFirst.mockResolvedValue(category);
    db.category.findFirstOrThrow.mockResolvedValue(category);
    db.category.create.mockImplementation(({ data }) => ({
      ...category,
      ...data,
    }));
    db.category.updateMany.mockResolvedValue({ count: 1 });
    db.category.findMany.mockResolvedValue([category]);
    db.category.count.mockResolvedValue(1);
    db.stockMovement.create.mockImplementation(({ data }) => ({
      id: 'movement',
      createdAt: new Date(),
      ...data,
    }));
    db.stockMovement.findMany.mockResolvedValue([]);
    db.stockMovement.count.mockResolvedValue(0);
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
  const get = (path: string) =>
    request(app.getHttpServer())
      .get('/api/v1' + path)
      .set('Cookie', cookie);
  const write = (
    method: 'post' | 'patch' | 'delete',
    path: string,
    body: object = {},
  ) =>
    request(app.getHttpServer())
      [method]('/api/v1' + path)
      .set('Cookie', cookie)
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Protection', '1')
      .send(body);
  it.each([
    '/products',
    '/categories',
    '/inventory/summary',
    '/products/' + id,
    '/products/' + id + '/stock-movements',
    '/products/by-barcode/test',
  ])('requires auth %s', async (path) => {
    await request(app.getHttpServer())
      .get('/api/v1' + path)
      .expect(401);
  });
  it.each(['/products', '/categories', '/inventory/summary'])(
    'requires owner %s',
    async (path) => {
      db.businessMember.findUnique.mockResolvedValue({ role: 'MEMBER' });
      await get(path).expect(403);
    },
  );
  it.each(['/products', '/categories'])('requires CSRF %s', async (path) => {
    await request(app.getHttpServer())
      .post('/api/v1' + path)
      .set('Cookie', cookie)
      .send({ name: 'Item' })
      .expect(403);
  });
  it('creates generated code and opening movement in one transaction', async () => {
    const res = await write('post', '/products', {
      name: 'Item',
      unit: 'KG',
      trackInventory: true,
      openingStock: '0.001',
      salePrice: '0.30',
    }).expect(201);
    expect(res.body.profile.salePrice).toBe('0.30');
    expect(res.body.profile.businessId).toBeUndefined();
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.business.update).toHaveBeenCalledWith({
      where: { id: user.currentBusinessId },
      data: { nextProductNumber: { increment: 1 } },
      select: { nextProductNumber: true },
    });
    expect(db.product.create.mock.calls[0]![0].data.productCode).toBe(
      'PRD-000001',
    );
    expect(db.stockMovement.create.mock.calls[0]![0].data).toMatchObject({
      businessId: user.currentBusinessId,
      productId: id,
      type: 'OPENING',
      createdById: user.id,
    });
  });
  it('does not create movement for zero stock', async () => {
    await write('post', '/products', {
      name: 'Service',
      type: 'SERVICE',
    }).expect(201);
    expect(db.stockMovement.create).not.toHaveBeenCalled();
  });
  it.each([
    { businessId: 'other' },
    { productCode: 'PRD-9' },
    { currentStock: '9' },
    { salePrice: 1.1 },
    { salePrice: '0.001' },
    { openingStock: '-1' },
    { openingStock: '1.0001' },
    { type: 'SERVICE', trackInventory: true },
    { type: 'SERVICE', openingStock: '1' },
    { trackInventory: false, minimumStock: '1' },
    { gstRate: '100.01' },
    { hsnSacCode: '12' },
    { name: null },
    { unit: 'BOGUS' },
  ])('rejects product payload %j', async (bad) => {
    await write('post', '/products', { name: 'Item', ...bad }).expect(400);
    expect(db.product.create).not.toHaveBeenCalled();
  });
  it.each([
    { openingStock: '0' },
    { currentStock: '0' },
    { type: 'SERVICE' },
    { unit: 'PCS' },
    { trackInventory: false },
  ])('rejects stock reinterpretation %j', async (bad) => {
    await write('patch', '/products/' + id, bad).expect(400);
    expect(db.product.updateMany).not.toHaveBeenCalled();
  });
  it.each([null, { ...category, isActive: false }])(
    'rejects unavailable category %j',
    async (value) => {
      db.category.findFirst.mockResolvedValue(value);
      await write('post', '/products', { name: 'Item', categoryId }).expect(
        400,
      );
      expect(db.business.update).not.toHaveBeenCalled();
    },
  );
  it('scopes category selection', async () => {
    await write('post', '/products', { name: 'Item', categoryId }).expect(201);
    expect(db.category.findFirst.mock.calls[0]![0].where).toMatchObject({
      businessId: user.currentBusinessId,
      id: categoryId,
      business: { memberships: { some: { userId: user.id, role: 'OWNER' } } },
    });
  });
  it.each([
    '?businessId=other',
    '?pageSize=101',
    '?sortBy=businessId',
    '?gstRate=101',
    '?stockStatus=sold',
  ])('rejects list query %s', async (q) => {
    await get('/products' + q).expect(400);
  });
  it('scopes search pagination and low stock with field comparison', async () => {
    await get('/products?search=rice&page=2&pageSize=5&stockStatus=low').expect(
      200,
    );
    const args = db.product.findMany.mock.calls[0]![0];
    expect(args).toMatchObject({
      skip: 5,
      take: 5,
      where: {
        businessId: user.currentBusinessId,
        AND: [
          { type: 'PRODUCT', trackInventory: true, isActive: true },
          { currentStock: { gt: 0, lte: 'minimumStock' } },
        ],
      },
    });
    expect(args.where.OR).toHaveLength(5);
  });
  it.each(['/products/' + id, '/products/by-barcode/ABC'])(
    'hides foreign product %s',
    async (path) => {
      db.product.findFirst.mockResolvedValue(null);
      await get(path).expect(404);
      expect(db.product.findFirst.mock.calls[0]![0].where.businessId).toBe(
        user.currentBusinessId,
      );
    },
  );
  it('looks up barcode within business', async () => {
    await get('/products/by-barcode/ABC').expect(200);
    expect(db.product.findFirst.mock.calls[0]![0].where).toMatchObject({
      barcode: 'ABC',
      businessId: user.currentBusinessId,
    });
  });
  it('deactivates without deleting or changing stock', async () => {
    await write('delete', '/products/' + id).expect(200);
    const data = db.product.updateMany.mock.calls[0]![0].data;
    expect(data.isActive).toBe(false);
    expect(data).not.toHaveProperty('currentStock');
    expect(db.stockMovement.create).not.toHaveBeenCalled();
  });
  it('reactivates', async () => {
    await write('patch', '/products/' + id, { isActive: true }).expect(200);
    expect(db.product.updateMany.mock.calls[0]![0].data.isActive).toBe(true);
  });
  it.each(['sku', 'barcode'])('returns unique %s conflict', async (field) => {
    db.product.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    await write('post', '/products', { name: 'Item', [field]: 'same' }).expect(
      409,
    );
  });
  it.each([
    ['INCREASE', '1.101'],
    ['DECREASE', '1.099'],
  ])('adjusts %s exactly', async (direction, after) => {
    const res = await write('post', '/products/' + id + '/stock-adjustments', {
      direction,
      quantity: '0.001',
      reason: 'Count correction',
    }).expect(201);
    expect(res.body.profile.currentStock).toBe(after);
    expect(res.body.movement.beforeStock).toBe('1.100');
    expect(res.body.movement.afterStock).toBe(after);
    expect(db.product.updateMany.mock.calls[0]![0].where).toMatchObject({
      id,
      businessId: user.currentBusinessId,
      currentStock: stored.currentStock,
      isActive: true,
    });
  });
  it.each([
    { quantity: '0' },
    { quantity: '-1' },
    { quantity: 1 },
    { quantity: '1.0001' },
    { reason: '   ' },
    { businessId: 'other' },
    { currentStock: '20' },
    { direction: 'SET' },
  ])('rejects adjustment %j', async (bad) => {
    await write('post', '/products/' + id + '/stock-adjustments', {
      direction: 'INCREASE',
      quantity: '1',
      reason: 'Test',
      ...bad,
    }).expect(400);
    expect(db.stockMovement.create).not.toHaveBeenCalled();
  });
  it('prevents negative stock', async () => {
    await write('post', '/products/' + id + '/stock-adjustments', {
      direction: 'DECREASE',
      quantity: '1.101',
      reason: 'Test',
    }).expect(400);
    expect(db.product.updateMany).not.toHaveBeenCalled();
  });
  it.each([
    { isActive: false },
    { type: 'SERVICE' },
    { trackInventory: false },
  ])('rejects nonadjustable %j', async (values) => {
    db.product.findFirst.mockResolvedValue({ ...stored, ...values });
    await write('post', '/products/' + id + '/stock-adjustments', {
      direction: 'INCREASE',
      quantity: '1',
      reason: 'Test',
    }).expect(400);
  });
  it('rejects foreign adjustment and history', async () => {
    db.product.findFirst.mockResolvedValue(null);
    await write('post', '/products/' + id + '/stock-adjustments', {
      direction: 'INCREASE',
      quantity: '1',
      reason: 'Test',
    }).expect(404);
    await get('/products/' + id + '/stock-movements').expect(404);
  });
  it('does not append movement when compare-and-swap fails', async () => {
    db.product.updateMany.mockResolvedValue({ count: 0 });
    await write('post', '/products/' + id + '/stock-adjustments', {
      direction: 'INCREASE',
      quantity: '1',
      reason: 'Test',
    }).expect(409);
    expect(db.stockMovement.create).not.toHaveBeenCalled();
  });
  it('bounds quantity overflow', async () => {
    await write('post', '/products/' + id + '/stock-adjustments', {
      direction: 'INCREASE',
      quantity: '999999999999999.999',
      reason: 'Test',
    }).expect(400);
  });
  it('paginates immutable movement history', async () => {
    await get(
      '/products/' + id + '/stock-movements?page=2&pageSize=5&type=OPENING',
    ).expect(200);
    expect(db.stockMovement.findMany.mock.calls[0]![0]).toMatchObject({
      skip: 5,
      take: 5,
      where: {
        businessId: user.currentBusinessId,
        productId: id,
        type: 'OPENING',
      },
    });
    await write('patch', '/products/' + id + '/stock-movements', {}).expect(
      404,
    );
  });
  it('returns inventory counts and rejects tenant query', async () => {
    const res = await get('/inventory/summary').expect(200);
    expect(res.body).toEqual({
      totalActiveProducts: 1,
      inventoryTrackedProducts: 1,
      lowStockProducts: 1,
      outOfStockProducts: 1,
    });
    expect(db.product.count.mock.calls[2]![0].where).toMatchObject({
      type: 'PRODUCT',
      isActive: true,
      trackInventory: true,
      currentStock: { gt: 0, lte: 'minimumStock' },
    });
    await get('/inventory/summary?businessId=x').expect(400);
  });
  it('creates normalized category and omits internal keys', async () => {
    const res = await write('post', '/categories', { name: '  FOOD  ' }).expect(
      201,
    );
    expect(db.category.create.mock.calls[0]![0].data).toMatchObject({
      name: 'FOOD',
      nameKey: 'food',
      businessId: user.currentBusinessId,
    });
    expect(res.body.profile).not.toHaveProperty('nameKey');
  });
  it('rejects duplicate category', async () => {
    db.category.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    await write('post', '/categories', { name: 'Food' }).expect(409);
  });
  it.each([{ name: '' }, { name: null }, { businessId: 'other' }])(
    'rejects category %j',
    async (bad) => {
      await write('post', '/categories', { name: 'Food', ...bad }).expect(400);
    },
  );
  it('scopes category list/detail/update', async () => {
    await get('/categories?search=Food&pageSize=5').expect(200);
    expect(db.category.findMany.mock.calls[0]![0].where.businessId).toBe(
      user.currentBusinessId,
    );
    db.category.findFirst.mockResolvedValue(null);
    await get('/categories/' + categoryId).expect(404);
    await write('patch', '/categories/' + categoryId, {
      name: 'Changed',
    }).expect(404);
  });
  it('category deactivation leaves products unchanged', async () => {
    await write('delete', '/categories/' + categoryId).expect(200);
    expect(db.category.updateMany.mock.calls[0]![0].data.isActive).toBe(false);
    expect(db.product.updateMany).not.toHaveBeenCalled();
  });
});
