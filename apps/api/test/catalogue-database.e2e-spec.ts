import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../src/database/database.service.js';
import { ProductsService } from '../src/catalogue/products.service.js';
import { CategoriesService } from '../src/catalogue/categories.service.js';
import { InventoryService } from '../src/catalogue/inventory.service.js';
import { safeUserSelect, type SafeUser } from '../src/users/user.select.js';
// Opt-in: migrated, dedicated *_test PostgreSQL only. No migration/reset here.
describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'catalogue transactions (real PostgreSQL)',
  () => {
    let db: DatabaseService;
    const businesses: string[] = [];
    const users: string[] = [];
    beforeAll(async () => {
      const url = process.env.TEST_DATABASE_URL!;
      if (!new URL(url).pathname.endsWith('_test'))
        throw new Error('Use a dedicated *_test database');
      db = new DatabaseService(new ConfigService({ DATABASE_URL: url }));
      await db.$connect();
    });
    afterAll(async () => {
      if (!db) return;
      await db.stockMovement.deleteMany({
        where: { businessId: { in: businesses } },
      });
      await db.product.deleteMany({
        where: { businessId: { in: businesses } },
      });
      await db.category.deleteMany({
        where: { businessId: { in: businesses } },
      });
      await db.user.deleteMany({ where: { id: { in: users } } });
      await db.business.deleteMany({ where: { id: { in: businesses } } });
      await db.$disconnect();
    });
    async function owner(): Promise<SafeUser> {
      const user = await db.user.create({
        data: {
          email: randomUUID() + '@phase5.example',
          passwordHash: 'test-only-not-a-login-hash',
          firstName: 'Test',
          lastName: 'Owner',
        },
      });
      users.push(user.id);
      const business = await db.business.create({
        data: {
          name: 'Test business',
          ownerName: 'Test Owner',
          businessType: 'PROPRIETORSHIP',
          gstRegistered: false,
          mobile: '9876543210',
          email: user.email,
          addressLine1: '10 Test Street',
          state: 'Maharashtra',
          stateCode: '27',
          city: 'Pune',
          pincode: '411001',
          invoicePrefix: 'INV',
          financialYear: '2026-27',
          gstMode: 'NOT_APPLICABLE',
          onboardingCompletedAt: new Date(),
          memberships: { create: { userId: user.id, role: 'OWNER' } },
        },
      });
      businesses.push(business.id);
      return db.user.update({
        where: { id: user.id },
        data: { currentBusinessId: business.id },
        select: safeUserSelect,
      });
    }

    it('allocates concurrent codes, persists decimals and rolls back duplicates', async () => {
      const a = await owner(),
        b = await owner();
      const inv = new InventoryService(db),
        products = new ProductsService(db, inv),
        categories = new CategoriesService(db);
      const cat = await categories.create(a, { name: 'Food' });
      const rows = await Promise.all(
        Array.from({ length: 6 }, () =>
          products.create(a, {
            name: 'Rice',
            unit: 'KG',
            trackInventory: true,
            openingStock: '0.001',
            salePrice: '9999999999999.99',
            categoryId: cat.id,
          }),
        ),
      );
      expect(new Set(rows.map((r) => r.productCode)).size).toBe(6);
      expect(
        rows.every(
          (r) =>
            r.currentStock === '0.001' && r.salePrice === '9999999999999.99',
        ),
      ).toBe(true);
      const first = await products.create(a, {
        name: 'Unique',
        sku: 'SKU',
        barcode: 'BAR',
      });
      const before = await db.business.findUniqueOrThrow({
        where: { id: a.currentBusinessId! },
      });
      await expect(
        products.create(a, { name: 'Duplicate', sku: 'SKU' }),
      ).rejects.toThrow('already exists');
      expect(
        (
          await db.business.findUniqueOrThrow({
            where: { id: a.currentBusinessId! },
          })
        ).nextProductNumber,
      ).toBe(before.nextProductNumber);
      await expect(
        products.create(b, { name: 'Foreign category', categoryId: cat.id }),
      ).rejects.toThrow();
      await expect(products.detail(b, first.id)).rejects.toThrow('not found');
      await expect(
        inv.history(b, rows[0]!.id, { page: 1, pageSize: 20 }),
      ).rejects.toThrow('not found');
      await expect(
        products.create(b, {
          name: 'Other tenant',
          sku: 'SKU',
          barcode: 'BAR',
        }),
      ).resolves.toMatchObject({ productCode: 'PRD-000001' });
      await expect(categories.create(a, { name: 'FOOD' })).rejects.toThrow(
        'already exists',
      );
      await expect(
        categories.create(b, { name: 'Food' }),
      ).resolves.toBeDefined();
    });
    it('serializes concurrent decrements and reconciles immutable movements', async () => {
      const a = await owner();
      const inv = new InventoryService(db),
        products = new ProductsService(db, inv);
      const item = await products.create(a, {
        name: 'Stock',
        unit: 'KG',
        trackInventory: true,
        openingStock: '1.001',
        minimumStock: '1.000',
      });
      const results = await Promise.allSettled([
        inv.adjust(a, item.id, {
          direction: 'DECREASE',
          quantity: '0.600',
          reason: 'Count A',
        }),
        inv.adjust(a, item.id, {
          direction: 'DECREASE',
          quantity: '0.600',
          reason: 'Count B',
        }),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect((await products.detail(a, item.id)).currentStock).toBe('0.401');
      await inv.adjust(a, item.id, {
        direction: 'INCREASE',
        quantity: '0.001',
        reason: 'Precision correction',
      });
      const history = await db.stockMovement.findMany({
        where: { businessId: a.currentBusinessId!, productId: item.id },
        orderBy: { createdAt: 'asc' },
      });
      expect(history).toHaveLength(3);
      expect(history[0]!.type).toBe('OPENING');
      expect(history[2]!.afterStock.toFixed(3)).toBe('0.402');
      expect((await inv.summary(a)).lowStockProducts).toBe(1);
      await products.update(a, item.id, { isActive: false });
      expect((await inv.summary(a)).lowStockProducts).toBe(0);
      expect(
        await db.stockMovement.count({ where: { productId: item.id } }),
      ).toBe(3);
    });
  },
);
