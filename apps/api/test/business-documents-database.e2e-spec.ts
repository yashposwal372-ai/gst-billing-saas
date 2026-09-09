import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../src/database/database.service.js';
import { InventoryService } from '../src/catalogue/inventory.service.js';
import { ProductsService } from '../src/catalogue/products.service.js';
import { SuppliersService } from '../src/suppliers/suppliers.service.js';
import { CustomersService } from '../src/customers/customers.service.js';
import { InvoiceCalculator } from '../src/invoices/invoice-calculator.js';
import { InvoicesService } from '../src/invoices/invoices.service.js';
import { BusinessDocumentsService } from '../src/business-documents/business-documents.service.js';
import { safeUserSelect, type SafeUser } from '../src/users/user.select.js';

// Opt-in: migrated, dedicated *_test PostgreSQL only. No migration/reset here.
describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'business document transactions (real PostgreSQL)',
  () => {
    let db: DatabaseService;
    const businesses: string[] = [];
    const users: string[] = [];

    beforeAll(async () => {
      const url = process.env.TEST_DATABASE_URL!;
      if (!new URL(url).pathname.endsWith('_test')) throw new Error('Use a dedicated *_test database');
      db = new DatabaseService(new ConfigService({ DATABASE_URL: url }));
      await db.$connect();
    });

    afterAll(async () => {
      if (!db) return;
      await db.stockMovement.deleteMany({ where: { businessId: { in: businesses } } });
      await db.businessDocumentLine.deleteMany({ where: { businessId: { in: businesses } } });
      await db.businessDocument.deleteMany({ where: { businessId: { in: businesses } } });
      await db.businessDocumentSequence.deleteMany({ where: { businessId: { in: businesses } } });
      await db.invoiceLine.deleteMany({ where: { businessId: { in: businesses } } });
      await db.invoice.deleteMany({ where: { businessId: { in: businesses } } });
      await db.invoiceSequence.deleteMany({ where: { businessId: { in: businesses } } });
      await db.product.deleteMany({ where: { businessId: { in: businesses } } });
      await db.customer.deleteMany({ where: { businessId: { in: businesses } } });
      await db.supplier.deleteMany({ where: { businessId: { in: businesses } } });
      await db.user.deleteMany({ where: { id: { in: users } } });
      await db.business.deleteMany({ where: { id: { in: businesses } } });
      await db.$disconnect();
    });

    async function owner(): Promise<SafeUser> {
      const user = await db.user.create({ data: { email: randomUUID() + '@phase7.example', passwordHash: 'test-only-not-a-login-hash', firstName: 'Test', lastName: 'Owner' } });
      users.push(user.id);
      const business = await db.business.create({ data: { name: 'Phase 7 test business', ownerName: 'Test Owner', businessType: 'PROPRIETORSHIP', gstRegistered: true, gstin: '27AAACB1234C1Z5', pan: 'AAACB1234C', mobile: '9876543210', email: user.email, addressLine1: '10 Test Street', state: 'Maharashtra', stateCode: '27', city: 'Pune', pincode: '411001', invoicePrefix: 'INV', financialYear: '2026-27', gstMode: 'EXCLUSIVE', onboardingCompletedAt: new Date(), memberships: { create: { userId: user.id, role: 'OWNER' } } } });
      businesses.push(business.id);
      return db.user.update({ where: { id: user.id }, data: { currentBusinessId: business.id }, select: safeUserSelect });
    }

    async function fixture(user: SafeUser) {
      const inventory = new InventoryService(db);
      const products = new ProductsService(db, inventory);
      const customers = new CustomersService(db);
      const suppliers = new SuppliersService(db);
      const invoices = new InvoicesService(db, new InvoiceCalculator());
      const docs = new BusinessDocumentsService(db, new InvoiceCalculator(), invoices);
      const product = await products.create(user, { name: 'Rice', type: 'PRODUCT', hsnSacCode: '1006', unit: 'KG', gstRate: '5.00', salePrice: '100.00', purchasePrice: '80.00', trackInventory: true, openingStock: '5.000' });
      const customer = await customers.create(user, { displayName: 'Retail Buyer', gstRegistered: true, gstin: '27ABCDE1234F1Z5', phone: '9876543210', addressLine1: '2 Buyer Road', city: 'Pune', state: 'Maharashtra', stateCode: '27', pincode: '411001' });
      const supplier = await suppliers.create(user, { displayName: 'Rice Supplier', gstRegistered: true, gstin: '29ABCDE1234F1Z5', phone: '9876543211', addressLine1: '3 Seller Road', city: 'Bengaluru', state: 'Karnataka', stateCode: '29', pincode: '560001' });
      return { product, customer, supplier, docs, invoices };
    }

    it('finalizes a purchase bill once, increases stock once, allocates one sequence, and safely cancels', async () => {
      const user = await owner();
      const { product, supplier, docs } = await fixture(user);
      const draft = await docs.create(user, 'PURCHASE_BILL', { supplierId: supplier.id, supplierInvoiceNumber: 'PB-' + randomUUID(), documentDate: '2026-09-09', placeOfSupplyState: 'Maharashtra', placeOfSupplyStateCode: '27', priceMode: 'EXCLUSIVE', lines: [{ productId: product.id, quantity: '2.000', unitPrice: '80.00', discountType: 'NONE' }] }) as any;
      const [first, second] = await Promise.allSettled([docs.transition(user, 'PURCHASE_BILL', draft.id, 'FINALIZED'), docs.transition(user, 'PURCHASE_BILL', draft.id, 'FINALIZED')]);
      expect([first.status, second.status].filter((status) => status === 'fulfilled')).toHaveLength(1);
      expect((await db.product.findUniqueOrThrow({ where: { id: product.id } })).currentStock.toFixed(3)).toBe('7.000');
      await docs.cancel(user, 'PURCHASE_BILL', draft.id, { reason: 'vendor correction' });
      expect((await db.product.findUniqueOrThrow({ where: { id: product.id } })).currentStock.toFixed(3)).toBe('5.000');
    });

    it('protects finalized sales and purchase returns from over-return races', async () => {
      const user = await owner();
      const { product, customer, supplier, docs, invoices } = await fixture(user);
      const invoice = await invoices.create(user, { customerId: customer.id, invoiceDate: '2026-09-09', placeOfSupplyState: 'Maharashtra', placeOfSupplyStateCode: '27', priceMode: 'EXCLUSIVE', lines: [{ productId: product.id, quantity: '1.000', unitPrice: '100.00', discountType: 'NONE' }] }) as any;
      const finalizedInvoice = await invoices.finalize(user, invoice.id) as any;
      const returnA = await docs.create(user, 'SALES_RETURN', { customerId: customer.id, sourceInvoiceId: finalizedInvoice.id, documentDate: '2026-09-09', placeOfSupplyState: 'Maharashtra', placeOfSupplyStateCode: '27', priceMode: 'EXCLUSIVE', lines: [{ productId: product.id, sourceInvoiceLineId: finalizedInvoice.lines[0].id, quantity: '1.000', unitPrice: '100.00', discountType: 'NONE' }] }) as any;
      const returnB = await docs.create(user, 'SALES_RETURN', { customerId: customer.id, sourceInvoiceId: finalizedInvoice.id, documentDate: '2026-09-09', placeOfSupplyState: 'Maharashtra', placeOfSupplyStateCode: '27', priceMode: 'EXCLUSIVE', lines: [{ productId: product.id, sourceInvoiceLineId: finalizedInvoice.lines[0].id, quantity: '1.000', unitPrice: '100.00', discountType: 'NONE' }] }) as any;
      const raced = await Promise.allSettled([docs.transition(user, 'SALES_RETURN', returnA.id, 'FINALIZED'), docs.transition(user, 'SALES_RETURN', returnB.id, 'FINALIZED')]);
      expect(raced.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      const bill = await docs.create(user, 'PURCHASE_BILL', { supplierId: supplier.id, supplierInvoiceNumber: 'PB-' + randomUUID(), documentDate: '2026-09-09', placeOfSupplyState: 'Maharashtra', placeOfSupplyStateCode: '27', priceMode: 'EXCLUSIVE', lines: [{ productId: product.id, quantity: '1.000', unitPrice: '80.00', discountType: 'NONE' }] }) as any;
      const finalizedBill = await docs.transition(user, 'PURCHASE_BILL', bill.id, 'FINALIZED') as any;
      const purchaseReturn = await docs.create(user, 'PURCHASE_RETURN', { supplierId: supplier.id, sourceDocumentId: finalizedBill.id, documentDate: '2026-09-09', placeOfSupplyState: 'Maharashtra', placeOfSupplyStateCode: '27', priceMode: 'EXCLUSIVE', lines: [{ productId: product.id, sourceDocumentLineId: finalizedBill.lines[0].id, quantity: '1.000', unitPrice: '80.00', discountType: 'NONE' }] }) as any;
      await docs.transition(user, 'PURCHASE_RETURN', purchaseReturn.id, 'FINALIZED');
      await docs.cancel(user, 'PURCHASE_RETURN', purchaseReturn.id, { reason: 'return reversed' });
    });
  },
);