import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../src/database/database.service.js';
import { InventoryService } from '../src/catalogue/inventory.service.js';
import { ProductsService } from '../src/catalogue/products.service.js';
import { CustomersService } from '../src/customers/customers.service.js';
import { InvoiceCalculator } from '../src/invoices/invoice-calculator.js';
import { InvoicesService } from '../src/invoices/invoices.service.js';
import { safeUserSelect, type SafeUser } from '../src/users/user.select.js';

// Opt-in: migrated, dedicated *_test PostgreSQL only. No migration/reset here.
describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'invoice transactions (real PostgreSQL)',
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
      await db.invoiceLine.deleteMany({
        where: { businessId: { in: businesses } },
      });
      await db.invoice.deleteMany({ where: { businessId: { in: businesses } } });
      await db.invoiceSequence.deleteMany({
        where: { businessId: { in: businesses } },
      });
      await db.product.deleteMany({ where: { businessId: { in: businesses } } });
      await db.customer.deleteMany({
        where: { businessId: { in: businesses } },
      });
      await db.user.deleteMany({ where: { id: { in: users } } });
      await db.business.deleteMany({ where: { id: { in: businesses } } });
      await db.$disconnect();
    });

    async function owner(): Promise<SafeUser> {
      const user = await db.user.create({
        data: {
          email: randomUUID() + '@phase6.example',
          passwordHash: 'test-only-not-a-login-hash',
          firstName: 'Test',
          lastName: 'Owner',
        },
      });
      users.push(user.id);
      const business = await db.business.create({
        data: {
          name: 'Invoice test business',
          ownerName: 'Test Owner',
          businessType: 'PROPRIETORSHIP',
          gstRegistered: true,
          gstin: '27AAACB1234C1Z5',
          pan: 'AAACB1234C',
          mobile: '9876543210',
          email: user.email,
          addressLine1: '10 Test Street',
          state: 'Maharashtra',
          stateCode: '27',
          city: 'Pune',
          pincode: '411001',
          invoicePrefix: 'INV',
          financialYear: '2026-27',
          gstMode: 'EXCLUSIVE',
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

    async function draft(user: SafeUser) {
      const customer = new CustomersService(db);
      const inventory = new InventoryService(db);
      const products = new ProductsService(db, inventory);
      const invoices = new InvoicesService(db, new InvoiceCalculator());
      const buyer = await customer.create(user, {
        displayName: 'Retail Buyer',
        gstRegistered: true,
        gstin: '27ABCDE1234F1Z5',
        phone: '9876543210',
        addressLine1: '2 Buyer Road',
        city: 'Pune',
        state: 'Maharashtra',
        stateCode: '27',
        pincode: '411001',
      });
      const item = await products.create(user, {
        name: 'Rice',
        type: 'PRODUCT',
        hsnSacCode: '1006',
        unit: 'KG',
        gstRate: '5.00',
        salePrice: '100.00',
        trackInventory: true,
        openingStock: '5.000',
      });
      const invoice = await invoices.create(user, {
        customerId: buyer.id,
        invoiceDate: '2026-09-08',
        placeOfSupplyState: 'Maharashtra',
        placeOfSupplyStateCode: '27',
        priceMode: 'EXCLUSIVE',
        lines: [
          {
            productId: item.id,
            quantity: '2.000',
            unitPrice: '100.00',
            discountType: 'NONE',
            discountValue: '0',
          },
        ],
      });
      return { invoices, invoice: invoice as { id: string }, item };
    }

    it('allows only one concurrent finalize and records one stock deduction', async () => {
      const user = await owner();
      const { invoices, invoice, item } = await draft(user);
      const results = await Promise.allSettled([
        invoices.finalize(user, invoice.id),
        invoices.finalize(user, invoice.id),
      ]);
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      const row = await db.invoice.findFirstOrThrow({
        where: { businessId: user.currentBusinessId!, id: invoice.id },
      });
      expect(row.status).toBe('FINALIZED');
      expect(row.invoiceNumber).toBe('INV/2026-27/000001');
      expect(
        await db.stockMovement.count({
          where: {
            businessId: user.currentBusinessId!,
            invoiceId: invoice.id,
            productId: item.id,
            type: 'INVOICE_FINALIZED',
          },
        }),
      ).toBe(1);
      expect(
        (
          await db.product.findFirstOrThrow({
            where: { businessId: user.currentBusinessId!, id: item.id },
          })
        ).currentStock.toFixed(3),
      ).toBe('3.000');
    });

    it('allows only one concurrent cancel and restores stock once', async () => {
      const user = await owner();
      const { invoices, invoice, item } = await draft(user);
      await invoices.finalize(user, invoice.id);
      const results = await Promise.allSettled([
        invoices.cancel(user, invoice.id, { reason: 'Customer cancelled' }),
        invoices.cancel(user, invoice.id, { reason: 'Customer cancelled' }),
      ]);
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      const row = await db.invoice.findFirstOrThrow({
        where: { businessId: user.currentBusinessId!, id: invoice.id },
      });
      expect(row.status).toBe('CANCELLED');
      expect(row.invoiceNumber).toBe('INV/2026-27/000001');
      const movements = await db.stockMovement.findMany({
        where: { businessId: user.currentBusinessId!, invoiceId: invoice.id },
        orderBy: { createdAt: 'asc' },
      });
      expect(movements.map((movement) => movement.type)).toEqual([
        'INVOICE_FINALIZED',
        'INVOICE_CANCELLED',
      ]);
      expect(
        (
          await db.product.findFirstOrThrow({
            where: { businessId: user.currentBusinessId!, id: item.id },
          })
        ).currentStock.toFixed(3),
      ).toBe('5.000');
    });
  },
);
