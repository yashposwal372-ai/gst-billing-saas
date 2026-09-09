import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../src/database/database.service.js';
import { FinanceService } from '../src/finance/finance.service.js';
import { InventoryService } from '../src/catalogue/inventory.service.js';
import { ProductsService } from '../src/catalogue/products.service.js';
import { CustomersService } from '../src/customers/customers.service.js';
import { SuppliersService } from '../src/suppliers/suppliers.service.js';
import { InvoiceCalculator } from '../src/invoices/invoice-calculator.js';
import { InvoicesService } from '../src/invoices/invoices.service.js';
import { BusinessDocumentsService } from '../src/business-documents/business-documents.service.js';
import { safeUserSelect, type SafeUser } from '../src/users/user.select.js';

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'finance transactions (real PostgreSQL)',
  () => {
    let db: DatabaseService;
    let finance: FinanceService;
    const businesses: string[] = [];
    const users: string[] = [];

    beforeAll(async () => {
      const url = process.env.TEST_DATABASE_URL!;
      if (!new URL(url).pathname.endsWith('_test')) throw new Error('Use a dedicated *_test database');
      db = new DatabaseService(new ConfigService({ DATABASE_URL: url }));
      finance = new FinanceService(db);
      await db.$connect();
    });

    afterAll(async () => {
      if (!db) return;
      await db.moneyAccountEntry.deleteMany({ where: { businessId: { in: businesses } } });
      await db.paymentAllocation.deleteMany({ where: { businessId: { in: businesses } } });
      await db.payment.deleteMany({ where: { businessId: { in: businesses } } });
      await db.expense.deleteMany({ where: { businessId: { in: businesses } } });
      await db.expenseCategory.deleteMany({ where: { businessId: { in: businesses } } });
      await db.accountTransfer.deleteMany({ where: { businessId: { in: businesses } } });
      await db.financeSequence.deleteMany({ where: { businessId: { in: businesses } } });
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
      const user = await db.user.create({ data: { email: randomUUID() + '@phase8.example', passwordHash: 'test-only-not-a-login-hash', firstName: 'Test', lastName: 'Owner' } });
      users.push(user.id);
      const business = await db.business.create({ data: { name: 'Phase 8 finance business', ownerName: 'Test Owner', businessType: 'PROPRIETORSHIP', gstRegistered: true, gstin: '27AAACB1234C1Z5', pan: 'AAACB1234C', mobile: '9876543210', email: user.email, addressLine1: '10 Test Street', state: 'Maharashtra', stateCode: '27', city: 'Pune', pincode: '411001', invoicePrefix: 'INV', financialYear: '2026-27', gstMode: 'EXCLUSIVE', onboardingCompletedAt: new Date(), memberships: { create: { userId: user.id, role: 'OWNER' } } } });
      businesses.push(business.id);
      return db.user.update({ where: { id: user.id }, data: { currentBusinessId: business.id }, select: safeUserSelect });
    }

    async function commercialFixture(user: SafeUser) {
      const inventory = new InventoryService(db);
      const products = new ProductsService(db, inventory);
      const customers = new CustomersService(db);
      const suppliers = new SuppliersService(db);
      const invoices = new InvoicesService(db, new InvoiceCalculator());
      const docs = new BusinessDocumentsService(db, new InvoiceCalculator(), invoices);
      const account = await finance.createAccount(user, { name: 'Main Cash', type: 'CASH', openingBalance: '100.00' }) as unknown as { id: string };
      const bank = await finance.createAccount(user, { name: 'Bank', type: 'BANK', openingBalance: '0.00', accountNumberLast4: '1234' }) as unknown as { id: string };
      const category = await finance.createExpenseCategory(user, { name: 'Rent ' + randomUUID().slice(0, 8) }) as unknown as { id: string };
      const product = await products.create(user, { name: 'Rice', type: 'PRODUCT', hsnSacCode: '1006', unit: 'KG', gstRate: '5.00', salePrice: '100.00', purchasePrice: '80.00', trackInventory: true, openingStock: '5.000' });
      const customer = await customers.create(user, { displayName: 'Retail Buyer', gstRegistered: true, gstin: '27ABCDE1234F1Z5', phone: '9876543210', addressLine1: '2 Buyer Road', city: 'Pune', state: 'Maharashtra', stateCode: '27', pincode: '411001' });
      const supplier = await suppliers.create(user, { displayName: 'Rice Supplier', gstRegistered: true, gstin: '29ABCDE1234F1Z5', phone: '9876543211', addressLine1: '3 Seller Road', city: 'Bengaluru', state: 'Karnataka', stateCode: '29', pincode: '560001' });
      const draftInvoice = await invoices.create(user, { customerId: customer.id, invoiceDate: '2026-09-09', dueDate: '2026-09-10', placeOfSupplyState: 'Maharashtra', placeOfSupplyStateCode: '27', priceMode: 'EXCLUSIVE', lines: [{ productId: product.id, quantity: '2.000', unitPrice: '100.00', discountType: 'NONE' }] }) as unknown as { id: string };
      const invoice = await invoices.finalize(user, draftInvoice.id) as { id: string; grandTotal: string };
      const draftBill = await docs.create(user, 'PURCHASE_BILL', { supplierId: supplier.id, supplierInvoiceNumber: 'BILL-' + randomUUID(), documentDate: '2026-09-09', dueDate: '2026-09-10', placeOfSupplyState: 'Maharashtra', placeOfSupplyStateCode: '27', priceMode: 'EXCLUSIVE', lines: [{ productId: product.id, quantity: '1.000', unitPrice: '80.00', discountType: 'NONE' }] }) as unknown as { id: string };
      const bill = await docs.transition(user, 'PURCHASE_BILL', draftBill.id, 'FINALIZED') as { id: string; grandTotal: string };
      return { account, bank, category, customer, supplier, invoice, bill };
    }

    it('allows only one concurrent customer receipt allocation against invoice outstanding', async () => {
      const user = await owner();
      const f = await commercialFixture(user);
      const a = await finance.createPayment(user, { type: 'CUSTOMER_RECEIPT', customerId: f.customer.id, accountId: f.account.id, paymentDate: '2026-09-09', method: 'CASH', amount: '210.00', allocations: [{ invoiceId: f.invoice.id, amount: '210.00' }] }) as unknown as { id: string };
      const b = await finance.createPayment(user, { type: 'CUSTOMER_RECEIPT', customerId: f.customer.id, accountId: f.account.id, paymentDate: '2026-09-09', method: 'CASH', amount: '210.00', allocations: [{ invoiceId: f.invoice.id, amount: '210.00' }] }) as unknown as { id: string };
      const results = await Promise.allSettled([finance.postPayment(user, a.id), finance.postPayment(user, b.id)]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect((await db.paymentAllocation.aggregate({ where: { businessId: user.currentBusinessId!, invoiceId: f.invoice.id, payment: { status: 'POSTED' } }, _sum: { amount: true } }))._sum.amount?.toFixed(2)).toBe('210.00');
    });

    it('posts and reverses payments exactly once while preserving allocation history', async () => {
      const user = await owner();
      const f = await commercialFixture(user);
      const payment = await finance.createPayment(user, { type: 'CUSTOMER_RECEIPT', customerId: f.customer.id, accountId: f.account.id, paymentDate: '2026-09-09', method: 'CASH', amount: '105.00', allocations: [{ invoiceId: f.invoice.id, amount: '105.00' }] }) as unknown as { id: string };
      const posted = await Promise.allSettled([finance.postPayment(user, payment.id), finance.postPayment(user, payment.id)]);
      expect(posted.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const reversed = await Promise.allSettled([finance.reversePayment(user, payment.id, { reason: 'duplicate receipt' }), finance.reversePayment(user, payment.id, { reason: 'duplicate receipt' })]);
      expect(reversed.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(await db.moneyAccountEntry.count({ where: { businessId: user.currentBusinessId!, paymentId: payment.id } })).toBe(2);
      expect(await db.paymentAllocation.count({ where: { businessId: user.currentBusinessId!, paymentId: payment.id } })).toBe(1);
    });

    it('posts supplier payments, expenses and reversals with exact account balances', async () => {
      const user = await owner();
      const f = await commercialFixture(user);
      const supplierPayment = await finance.createPayment(user, { type: 'SUPPLIER_PAYMENT', supplierId: f.supplier.id, accountId: f.account.id, paymentDate: '2026-09-09', method: 'BANK_TRANSFER', amount: '84.00', allocations: [{ documentId: f.bill.id, amount: '84.00' }] }) as unknown as { id: string };
      await finance.postPayment(user, supplierPayment.id);
      const expense = await finance.createExpense(user, { categoryId: f.category.id, accountId: f.account.id, expenseDate: '2026-09-09', description: 'Office rent', amount: '25.00', method: 'CASH' }) as unknown as { id: string };
      await finance.postExpense(user, expense.id);
      await finance.cancelExpense(user, expense.id, { reason: 'void expense' });
      const account = await db.moneyAccount.findFirstOrThrow({ where: { businessId: user.currentBusinessId!, id: f.account.id } });
      expect(account.currentBalance.toFixed(2)).toBe('16.00');
      expect(await db.moneyAccountEntry.count({ where: { businessId: user.currentBusinessId!, expenseId: expense.id } })).toBe(2);
    });

    it('applies transfers atomically and reverses them exactly once', async () => {
      const user = await owner();
      const f = await commercialFixture(user);
      const transfer = await finance.createTransfer(user, { fromAccountId: f.account.id, toAccountId: f.bank.id, transferDate: '2026-09-09', amount: '40.00' }) as unknown as { id: string };
      expect((await db.moneyAccount.findFirstOrThrow({ where: { id: f.account.id } })).currentBalance.toFixed(2)).toBe('60.00');
      expect((await db.moneyAccount.findFirstOrThrow({ where: { id: f.bank.id } })).currentBalance.toFixed(2)).toBe('40.00');
      const results = await Promise.allSettled([finance.reverseTransfer(user, transfer.id, { reason: 'wrong account' }), finance.reverseTransfer(user, transfer.id, { reason: 'wrong account' })]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect((await db.moneyAccount.findFirstOrThrow({ where: { id: f.account.id } })).currentBalance.toFixed(2)).toBe('100.00');
      expect((await db.moneyAccount.findFirstOrThrow({ where: { id: f.bank.id } })).currentBalance.toFixed(2)).toBe('0.00');
    });
  },
);
