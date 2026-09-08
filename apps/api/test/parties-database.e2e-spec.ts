import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../src/database/database.service.js';
import { CustomersService } from '../src/customers/customers.service.js';
import { SuppliersService } from '../src/suppliers/suppliers.service.js';
import { safeUserSelect, type SafeUser } from '../src/users/user.select.js';

// Opt-in only: apply migrations to a dedicated *_test database first.
describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'party code concurrency and isolation (real PostgreSQL)',
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
      await db.customer.deleteMany({
        where: { businessId: { in: businesses } },
      });
      await db.supplier.deleteMany({
        where: { businessId: { in: businesses } },
      });
      await db.user.deleteMany({ where: { id: { in: users } } });
      await db.business.deleteMany({ where: { id: { in: businesses } } });
      await db.$disconnect();
    });
    async function owner(): Promise<SafeUser> {
      const user = await db.user.create({
        data: {
          email: randomUUID() + '@phase4.example',
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
    it('allocates unique codes concurrently, scopes GSTIN, rolls back duplicates and prevents cross-tenant access', async () => {
      const a = await owner(),
        b = await owner();
      const customer = new CustomersService(db),
        supplier = new SuppliersService(db);
      const dto = {
        displayName: 'Test party',
        phone: '9876543210',
        addressLine1: '12 Market Road',
        city: 'Pune',
        state: 'Maharashtra',
        stateCode: '27',
        pincode: '411001',
        openingBalance: '9999999999999.99',
      };
      const rows = await Promise.all(
        Array.from({ length: 8 }, () => customer.create(a, dto)),
      );
      expect(new Set(rows.map((row) => row.customerCode)).size).toBe(8);
      expect(
        rows.every((row) => row.openingBalance === '9999999999999.99'),
      ).toBe(true);
      const vendors = await Promise.all(
        Array.from({ length: 4 }, () => supplier.create(a, dto)),
      );
      expect(new Set(vendors.map((row) => row.supplierCode)).size).toBe(4);
      const gst = { ...dto, gstRegistered: true, gstin: '27ABCDE1234F1Z5' };
      await customer.create(a, gst);
      const before = await db.business.findUniqueOrThrow({
        where: { id: a.currentBusinessId! },
      });
      await expect(customer.create(a, gst)).rejects.toThrow('already exists');
      expect(
        (
          await db.business.findUniqueOrThrow({
            where: { id: a.currentBusinessId! },
          })
        ).nextCustomerNumber,
      ).toBe(before.nextCustomerNumber);
      expect((await customer.create(b, gst)).customerCode).toBe('CUS-000001');
      await expect(customer.detail(b, rows[0]!.id)).rejects.toThrow(
        'not found',
      );
      await expect(
        customer.update(b, rows[0]!.id, { displayName: 'Other tenant' }),
      ).rejects.toThrow('not found');
      await expect(supplier.deactivate(b, vendors[0]!.id)).rejects.toThrow(
        'not found',
      );
      await customer.deactivate(a, rows[0]!.id);
      expect((await customer.detail(a, rows[0]!.id)).profile.isActive).toBe(
        false,
      );
    });
  },
);
