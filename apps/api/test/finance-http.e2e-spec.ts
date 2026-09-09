import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/common/configure-app.js';
import { DatabaseService } from '../src/database/database.service.js';
import { TokenService } from '../src/auth/token.service.js';
import { Prisma } from '../src/generated/prisma/client.js';

const D = Prisma.Decimal;
describe('finance HTTP (database double, real guards/services)', () => {
  let app: INestApplication, cookie: string;
  const user = { id: '11111111-1111-4111-8111-111111111111', currentBusinessId: '22222222-2222-4222-8222-222222222222', status: 'ACTIVE', authVersion: 0 };
  const accountId = '33333333-3333-4333-8333-333333333333';
  const paymentId = '44444444-4444-4444-8444-444444444444';
  const invoiceId = '55555555-5555-4555-8555-555555555555';
  let paymentStatus: 'DRAFT'|'POSTED'|'REVERSED' = 'DRAFT';
  const db = {
    authSession: { findUnique: vi.fn() }, businessMember: { findUnique: vi.fn() }, business: { update: vi.fn() },
    moneyAccount: { count: vi.fn(), create: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn(), findMany: vi.fn() },
    moneyAccountEntry: { create: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    customer: { findFirst: vi.fn() }, supplier: { findFirst: vi.fn() },
    invoice: { findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn() }, businessDocument: { findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    financeSequence: { upsert: vi.fn() }, payment: { create: vi.fn(), findFirst: vi.fn(), findFirstOrThrow: vi.fn(), updateMany: vi.fn(), update: vi.fn(), findMany: vi.fn(), count: vi.fn(), delete: vi.fn() }, paymentAllocation: { aggregate: vi.fn(), deleteMany: vi.fn() },
    expenseCategory: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), findMany: vi.fn(), count: vi.fn() }, expense: { aggregate: vi.fn(), findFirst: vi.fn(), findFirstOrThrow: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), delete: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    accountTransfer: { create: vi.fn(), findFirst: vi.fn(), findFirstOrThrow: vi.fn(), updateMany: vi.fn() },
    $transaction: vi.fn(),
  };
  const account = (balance = '100.00') => ({ id: accountId, businessId: user.currentBusinessId, accountCode: 'ACC-000001', name: 'Cash', type: 'CASH', openingBalance: new D('100'), currentBalance: new D(balance), isActive: true, bankName: null, accountNumberLast4: null, ifsc: null, upiId: null, createdById: user.id, createdAt: new Date(), updatedAt: new Date() });
  const allocation = { id: 'alloc-a', businessId: user.currentBusinessId, paymentId, invoiceId, documentId: null, amount: new D('40.00'), createdAt: new Date() };
  const payment = () => ({ id: paymentId, businessId: user.currentBusinessId, paymentNumber: paymentStatus === 'DRAFT' ? null : 'RCPT/2026-27/000001', sequenceNumber: paymentStatus === 'DRAFT' ? null : 1, financialYear: '2026-27', type: 'CUSTOMER_RECEIPT', customerId: '66666666-6666-4666-8666-666666666666', supplierId: null, accountId, paymentDate: new Date('2026-09-09T00:00:00.000Z'), method: 'CASH', referenceNumber: null, amount: new D('40.00'), notes: null, status: paymentStatus, postedAt: paymentStatus === 'DRAFT' ? null : new Date(), postedById: paymentStatus === 'DRAFT' ? null : user.id, reversedAt: paymentStatus === 'REVERSED' ? new Date() : null, reversedById: paymentStatus === 'REVERSED' ? user.id : null, reversalReason: paymentStatus === 'REVERSED' ? 'Correction' : null, createdById: user.id, createdAt: new Date(), updatedAt: new Date(), allocations: [allocation] });
  beforeEach(async () => {
    vi.resetAllMocks(); paymentStatus = 'DRAFT';
    db.$transaction.mockImplementation((arg) => Array.isArray(arg) ? Promise.all(arg) : arg(db));
    db.authSession.findUnique.mockResolvedValue({ id: 'session-a', userId: user.id, user, expiresAt: new Date(Date.now()+600000), revokedAt: null, authVersion: 0 });
    db.businessMember.findUnique.mockResolvedValue({ role: 'OWNER' });
    db.business.update.mockResolvedValue({ nextAccountNumber: 1 });
    db.moneyAccount.count.mockResolvedValue(0); db.moneyAccount.findFirst.mockResolvedValue(account()); db.moneyAccount.findMany.mockResolvedValue([account()]); db.moneyAccount.updateMany.mockResolvedValue({ count: 1 });
    db.moneyAccount.create.mockImplementation(({ data }) => ({ id: accountId, createdAt: new Date(), updatedAt: new Date(), ...data }));
    db.moneyAccountEntry.create.mockImplementation(({ data }) => ({ id: 'entry-a', createdAt: new Date(), ...data })); db.moneyAccountEntry.findMany.mockResolvedValue([]); db.moneyAccountEntry.count.mockResolvedValue(0);
    db.customer.findFirst.mockResolvedValue({ id: '66666666-6666-4666-8666-666666666666', businessId: user.currentBusinessId, isActive: true }); db.supplier.findFirst.mockResolvedValue(null);
    db.invoice.findFirst.mockResolvedValue({ id: invoiceId, businessId: user.currentBusinessId, status: 'FINALIZED', grandTotal: new D('100.00') }); db.invoice.findMany.mockResolvedValue([]); db.invoice.count.mockResolvedValue(0);
    db.businessDocument.findMany.mockResolvedValue([]); db.businessDocument.count.mockResolvedValue(0);
    db.payment.create.mockImplementation(({ data }) => ({ id: paymentId, createdAt: new Date(), updatedAt: new Date(), paymentNumber: null, sequenceNumber: null, status: 'DRAFT', ...data, allocations: data.allocations.create.map((a: object) => ({ id: 'alloc-a', paymentId, ...a })) }));
    db.payment.findFirst.mockImplementation(() => Promise.resolve(payment())); db.payment.findFirstOrThrow.mockImplementation(() => Promise.resolve(payment()));
    db.payment.updateMany.mockImplementation(({ data }) => { paymentStatus = data.status; return { count: 1 }; }); db.payment.findMany.mockResolvedValue([payment()]); db.payment.count.mockResolvedValue(1); db.paymentAllocation.aggregate.mockResolvedValue({ _sum: { amount: new D('0.00') } });
    db.financeSequence.upsert.mockResolvedValue({ nextNumber: 1 });
    db.expense.aggregate.mockResolvedValue({ _sum: { amount: new D('0.00') } }); db.expenseCategory.findFirst.mockResolvedValue({ id: 'cat', businessId: user.currentBusinessId, isActive: true }); db.expenseCategory.findMany.mockResolvedValue([]); db.expenseCategory.count.mockResolvedValue(0); db.expense.findMany.mockResolvedValue([]); db.expense.count.mockResolvedValue(0);
    const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(DatabaseService).useValue(db).compile();
    app = module.createNestApplication(); app.useLogger(false); configureApp(app); await app.init(); cookie = 'gst_access=' + await app.get(TokenService).sign(user.id, 'session-a');
  });
  afterEach(async () => app.close());
  const post = (path: string, body: object) => request(app.getHttpServer()).post('/api/v1' + path).set('Cookie', cookie).set('Origin','http://localhost:3000').set('X-CSRF-Protection','1').send(body);
  it('creates account codes server-side and writes opening ledger entries', async () => {
    const res = await post('/accounts', { name: 'Main Cash', type: 'CASH', openingBalance: '250.00', accountCode: 'EVIL' }).expect(400);
    expect(res.body.message).toContain('property accountCode should not exist');
    const ok = await post('/accounts', { name: 'Main Cash', type: 'CASH', openingBalance: '250.00' }).expect(201);
    expect(ok.body.profile.accountCode).toBe('ACC-000001');
    expect(db.moneyAccountEntry.create.mock.calls[0]![0].data.type).toBe('OPENING_BALANCE');
  });
  it('posts and reverses customer receipts with ledger effects', async () => {
    await post('/payments', { type: 'CUSTOMER_RECEIPT', customerId: '66666666-6666-4666-8666-666666666666', accountId, paymentDate: '2026-09-09', method: 'CASH', amount: '40.00', allocations: [{ invoiceId, amount: '40.00' }] }).expect(201);
    const posted = await post('/payments/' + paymentId + '/post', {}).expect(201);
    expect(posted.body.profile.paymentNumber).toBe('RCPT/2026-27/000001');
    expect(db.moneyAccountEntry.create.mock.calls.at(-1)![0].data.direction).toBe('CREDIT');
    const reversed = await post('/payments/' + paymentId + '/reverse', { reason: 'Correction' }).expect(201);
    expect(reversed.body.profile.status).toBe('REVERSED');
    expect(db.moneyAccountEntry.create.mock.calls.at(-1)![0].data.type).toBe('PAYMENT_REVERSAL');
  });
  it('filters receivables before pagination metadata and excludes cancelled invoices', async () => {
    const oldInvoiceFindMany = db.invoice.findMany.getMockImplementation();
    db.invoice.findMany.mockResolvedValueOnce([
      { id: 'inv-unpaid', invoiceNumber: 'INV-1', customerId: '66666666-6666-4666-8666-666666666666', customerNameSnapshot: 'Acme', invoiceDate: new Date('2026-09-01T00:00:00.000Z'), dueDate: new Date('2026-09-05T00:00:00.000Z'), grandTotal: new D('100.00'), paymentAllocations: [] },
      { id: 'inv-partial-a', invoiceNumber: 'INV-2', customerId: '66666666-6666-4666-8666-666666666666', customerNameSnapshot: 'Acme', invoiceDate: new Date('2026-09-02T00:00:00.000Z'), dueDate: null, grandTotal: new D('100.00'), paymentAllocations: [{ amount: new D('25.00') }] },
      { id: 'inv-partial-b', invoiceNumber: 'INV-3', customerId: '66666666-6666-4666-8666-666666666666', customerNameSnapshot: 'Acme', invoiceDate: new Date('2026-09-03T00:00:00.000Z'), dueDate: null, grandTotal: new D('200.00'), paymentAllocations: [{ amount: new D('50.00') }] },
      { id: 'inv-paid', invoiceNumber: 'INV-4', customerId: '66666666-6666-4666-8666-666666666666', customerNameSnapshot: 'Acme', invoiceDate: new Date('2026-09-04T00:00:00.000Z'), dueDate: null, grandTotal: new D('10.00'), paymentAllocations: [{ amount: new D('10.00') }] },
    ]).mockResolvedValueOnce([]);
    const res = await request(app.getHttpServer()).get('/api/v1/receivables?status=PARTIAL&page=2&pageSize=1').set('Cookie', cookie).expect(200);
    expect(res.body.total).toBe(2);
    expect(res.body.totalPages).toBe(2);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].invoice.id).toBe('inv-partial-b');
    expect(db.invoice.findMany.mock.calls.at(-1)![0].where.status).toBe('FINALIZED');
    db.invoice.findMany.mockImplementation(oldInvoiceFindMany!);
  });
  it('filters overdue receivables before pagination metadata', async () => {
    const oldInvoiceFindMany = db.invoice.findMany.getMockImplementation();
    db.invoice.findMany.mockResolvedValueOnce([
      { id: 'inv-overdue', invoiceNumber: 'INV-1', customerId: '66666666-6666-4666-8666-666666666666', customerNameSnapshot: 'Acme', invoiceDate: new Date('2026-08-01T00:00:00.000Z'), dueDate: new Date('2026-08-15T00:00:00.000Z'), grandTotal: new D('100.00'), paymentAllocations: [] },
      { id: 'inv-paid-old', invoiceNumber: 'INV-2', customerId: '66666666-6666-4666-8666-666666666666', customerNameSnapshot: 'Acme', invoiceDate: new Date('2026-08-02T00:00:00.000Z'), dueDate: new Date('2026-08-15T00:00:00.000Z'), grandTotal: new D('100.00'), paymentAllocations: [{ amount: new D('100.00') }] },
    ]).mockResolvedValueOnce([]);
    const res = await request(app.getHttpServer()).get('/api/v1/receivables?status=OVERDUE&page=1&pageSize=10').set('Cookie', cookie).expect(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].invoice.id).toBe('inv-overdue');
    expect(res.body.items[0].daysOverdue).toBeGreaterThan(0);
    db.invoice.findMany.mockImplementation(oldInvoiceFindMany!);
  });
  it('filters payables before pagination metadata and excludes cancelled purchase bills', async () => {
    const oldFindMany = db.businessDocument.findMany.getMockImplementation();
    db.businessDocument.findMany.mockResolvedValueOnce([
      { id: 'bill-unpaid', documentNumber: 'PB-1', supplierId: '77777777-7777-4777-8777-777777777777', partyNameSnapshot: 'Supplier', documentDate: new Date('2026-09-01T00:00:00.000Z'), dueDate: null, grandTotal: new D('100.00'), paymentAllocations: [] },
      { id: 'bill-partial-a', documentNumber: 'PB-2', supplierId: '77777777-7777-4777-8777-777777777777', partyNameSnapshot: 'Supplier', documentDate: new Date('2026-09-02T00:00:00.000Z'), dueDate: null, grandTotal: new D('100.00'), paymentAllocations: [{ amount: new D('25.00') }] },
      { id: 'bill-partial-b', documentNumber: 'PB-3', supplierId: '77777777-7777-4777-8777-777777777777', partyNameSnapshot: 'Supplier', documentDate: new Date('2026-09-03T00:00:00.000Z'), dueDate: null, grandTotal: new D('100.00'), paymentAllocations: [{ amount: new D('75.00') }] },
    ]).mockResolvedValueOnce([]);
    const res = await request(app.getHttpServer()).get('/api/v1/payables?status=PARTIAL&page=2&pageSize=1').set('Cookie', cookie).expect(200);
    expect(res.body.total).toBe(2);
    expect(res.body.totalPages).toBe(2);
    expect(res.body.items[0].purchaseBill.id).toBe('bill-partial-b');
    expect(db.businessDocument.findMany.mock.calls.at(-1)![0].where.status).toBe('FINALIZED');
    expect(db.businessDocument.findMany.mock.calls.at(-1)![0].where.documentType).toBe('PURCHASE_BILL');
    db.businessDocument.findMany.mockImplementation(oldFindMany!);
  });
  it('rejects allocation mismatch and overpayment', async () => {
    await post('/payments', { type: 'CUSTOMER_RECEIPT', customerId: '66666666-6666-4666-8666-666666666666', accountId, paymentDate: '2026-09-09', method: 'CASH', amount: '40.00', allocations: [{ invoiceId, amount: '39.99' }] }).expect(400);
    db.paymentAllocation.aggregate.mockResolvedValueOnce({ _sum: { amount: new D('80.00') } });
    await post('/payments/' + paymentId + '/post', {}).expect(400);
  });
});
