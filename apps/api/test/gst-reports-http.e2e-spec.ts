import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/common/configure-app.js';
import { DatabaseService } from '../src/database/database.service.js';
import { TokenService } from '../src/auth/token.service.js';
import { Prisma } from '@gst/prisma-client/client';

const D = Prisma.Decimal;

describe('GST reports HTTP (database double, real guards/services)', () => {
  let app: INestApplication;
  let cookie: string;
  const user = { id: '11111111-1111-4111-8111-111111111111', currentBusinessId: '22222222-2222-4222-8222-222222222222', status: 'ACTIVE', authVersion: 0 };
  const invoice = { id: '33333333-3333-4333-8333-333333333333', businessId: user.currentBusinessId, status: 'FINALIZED', invoiceNumber: '=INV, "Q"\n1', invoiceDate: new Date('2026-04-01T00:00:00.000Z'), financialYear: '2026-27', customerId: '44444444-4444-4444-8444-444444444444', customerNameSnapshot: '+Formula Customer', customerGstinSnapshot: '-GSTIN Snapshot', placeOfSupplyState: 'Maharashtra', placeOfSupplyStateCode: '27', taxableTotal: new D('100.00'), cgstTotal: new D('9.00'), sgstTotal: new D('9.00'), igstTotal: new D('0.00'), taxTotal: new D('18.00'), grandTotal: new D('118.00') };
  const bill = { id: '55555555-5555-4555-8555-555555555555', businessId: user.currentBusinessId, documentType: 'PURCHASE_BILL', status: 'FINALIZED', documentNumber: '@PB-1', supplierInvoiceNumber: '-SUP-9', documentDate: new Date('2026-04-02T00:00:00.000Z'), financialYear: '2026-27', supplierId: '66666666-6666-4666-8666-666666666666', partyNameSnapshot: 'Registered Supplier', partyGstinSnapshot: '29ABCDE1234F1Z5', placeOfSupplyState: 'Karnataka', placeOfSupplyStateCode: '29', taxableTotal: new D('200.00'), cgstTotal: new D('0.00'), sgstTotal: new D('0.00'), igstTotal: new D('36.00'), taxTotal: new D('36.00'), grandTotal: new D('236.00') };
  const salesReturn = { ...bill, id: '77777777-7777-4777-8777-777777777777', documentType: 'SALES_RETURN', taxableTotal: new D('10.00'), cgstTotal: new D('0.90'), sgstTotal: new D('0.90'), igstTotal: new D('0.00'), taxTotal: new D('1.80'), grandTotal: new D('11.80') };
  const purchaseReturn = { ...bill, id: '88888888-8888-4888-8888-888888888888', documentType: 'PURCHASE_RETURN', taxableTotal: new D('20.00'), cgstTotal: new D('0.00'), sgstTotal: new D('0.00'), igstTotal: new D('3.60'), taxTotal: new D('3.60'), grandTotal: new D('23.60') };
  const invoiceLine = { id: 'line-i', invoiceId: invoice.id, businessId: user.currentBusinessId, productNameSnapshot: 'Consulting Snapshot', hsnSacCodeSnapshot: '998314', unitSnapshot: 'SERVICE', quantity: new D('1.000'), taxableAmount: new D('100.00'), cgstAmount: new D('9.00'), sgstAmount: new D('9.00'), igstAmount: new D('0.00'), taxAmount: new D('18.00'), lineTotal: new D('118.00'), gstRate: new D('18.00') };
  const zeroGstLine = { ...invoiceLine, id: 'line-zero', productNameSnapshot: 'Zero GST Snapshot', hsnSacCodeSnapshot: null, quantity: new D('1.000'), taxableAmount: new D('50.00'), cgstAmount: new D('0.00'), sgstAmount: new D('0.00'), igstAmount: new D('0.00'), taxAmount: new D('0.00'), lineTotal: new D('50.00'), gstRate: new D('0.00') };
  const billLine = { id: 'line-b', documentId: bill.id, businessId: user.currentBusinessId, productNameSnapshot: 'Raw Material Snapshot', hsnSacCodeSnapshot: '1001', unitSnapshot: 'KG', quantity: new D('2.500'), taxableAmount: new D('200.00'), cgstAmount: new D('0.00'), sgstAmount: new D('0.00'), igstAmount: new D('36.00'), taxAmount: new D('36.00'), lineTotal: new D('236.00'), gstRate: new D('18.00') };
  const db = { authSession: { findUnique: vi.fn() }, businessMember: { findUnique: vi.fn() }, invoice: { findMany: vi.fn(), count: vi.fn() }, businessDocument: { findMany: vi.fn(), count: vi.fn() }, invoiceLine: { findMany: vi.fn() }, businessDocumentLine: { findMany: vi.fn() }, $transaction: vi.fn() };

  beforeEach(async () => {
    vi.resetAllMocks();
    db.$transaction.mockImplementation((fn) => fn(db));
    db.authSession.findUnique.mockResolvedValue({ id: 'session-a', userId: user.id, user, expiresAt: new Date(Date.now() + 600000), revokedAt: null, authVersion: 0 });
    db.businessMember.findUnique.mockResolvedValue({ role: 'OWNER' });
    db.invoice.findMany.mockResolvedValue([invoice]);
    db.invoice.count.mockResolvedValue(1);
    db.businessDocument.findMany.mockImplementation(({ where }) => Promise.resolve(where.documentType === 'PURCHASE_BILL' ? [bill] : where.documentType === 'SALES_RETURN' ? [salesReturn] : where.documentType === 'PURCHASE_RETURN' ? [purchaseReturn] : []));
    db.businessDocument.count.mockResolvedValue(1);
    db.invoiceLine.findMany.mockResolvedValue([invoiceLine, zeroGstLine]);
    db.businessDocumentLine.findMany.mockResolvedValue([billLine]);
    const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(DatabaseService).useValue(db).compile();
    app = module.createNestApplication();
    app.useLogger(false);
    configureApp(app);
    await app.init();
    cookie = 'gst_access=' + await app.get(TokenService).sign(user.id, 'session-a');
  });

  afterEach(async () => { if (app) await app.close(); });

  const get = (path: string) => request(app.getHttpServer()).get('/api/v1' + path).set('Cookie', cookie);

  it('reports only finalized invoices and finalized purchase bills', async () => {
    const res = await get('/gst-reports/summary?financialYear=2026-27&dateFrom=2026-04-01&dateTo=2027-03-31').expect(200);
    expect(res.body.outwardSales.taxableValue).toBe('100.00');
    expect(res.body.purchaseTaxRecorded.totalTax).toBe('36.00');
    expect(JSON.stringify(res.body)).not.toContain('GST Payable');
    expect(db.invoice.findMany.mock.calls[0]![0].where).toMatchObject({ businessId: user.currentBusinessId, status: 'FINALIZED', financialYear: '2026-27' });
    expect(db.businessDocument.findMany.mock.calls[0]![0].where).toMatchObject({ businessId: user.currentBusinessId, documentType: 'PURCHASE_BILL', status: 'FINALIZED', financialYear: '2026-27' });
  });

  it('uses persisted snapshots and excludes master data and finance ledgers', async () => {
    const sales = await get('/gst-reports/sales-register').expect(200);
    expect(sales.body.items[0].customerName).toBe('+Formula Customer');
    expect(sales.body.items[0].customerGstin).toBe('-GSTIN Snapshot');
    const hsn = await get('/gst-reports/hsn-sac').expect(200);
    expect(hsn.body.items.some((r: any) => r.description === 'Consulting Snapshot' && r.gstRate === '18.00')).toBe(true);
    expect(Object.keys(db)).not.toEqual(expect.arrayContaining(['customer', 'supplier', 'product', 'payment', 'paymentAllocation', 'moneyAccount', 'expense', 'accountTransfer']));
  });

  it('keeps GST totals independent from payment settlement state', async () => {
    const unpaid = await get('/gst-reports/output-tax').expect(200);
    const paid = await get('/gst-reports/output-tax?financialYear=2026-27').expect(200);
    expect(paid.body.totals).toEqual(unpaid.body.totals);
    expect(Object.keys(db)).not.toEqual(expect.arrayContaining(['payment', 'paymentAllocation']));
  });

  it('serves paginated sales and purchase registers from finalized scoped sources', async () => {
    const sales = await get('/gst-reports/sales-register?page=1&pageSize=1&search=INV&taxType=INTRA_STATE&placeOfSupply=27').expect(200);
    expect(sales.body.items[0].taxType).toBe('INTRA_STATE');
    expect(db.invoice.findMany.mock.calls.at(-1)![0]).toMatchObject({ skip: 0, take: 1 });
    const purchases = await get('/gst-reports/purchase-register?page=1&pageSize=1&supplierId=66666666-6666-4666-8666-666666666666&gstRate=18').expect(200);
    expect(purchases.body.items[0].supplierName).toBe('Registered Supplier');
    expect(db.businessDocument.findMany.mock.calls.at(-1)![0].where.lines.some.gstRate.toFixed(2)).toBe('18.00');
  });

  it('aggregates rate, hsn/sac and place-of-supply summaries with Decimal strings and stored tax components', async () => {
    const rate = await get('/gst-reports/gst-rate-summary').expect(200);
    expect(rate.body.items.find((r: any) => r.gstRate === '18.00').salesTax).toBe('18.00');
    const hsn = await get('/gst-reports/hsn-sac').expect(200);
    expect(hsn.body.items.some((r: any) => r.classificationType === 'SAC' && r.salesQuantity === '1.000')).toBe(true);
    expect(hsn.body.items.some((r: any) => r.classificationType === 'HSN' && r.purchaseQuantity === '2.500')).toBe(true);
    expect(hsn.body.items.some((r: any) => r.code === 'GST Not Applied' && r.gstRate === '0.00')).toBe(true);
    expect((await get('/gst-reports/place-of-supply').expect(200)).body.items[0].totalTax).toBe('18.00');
  });

  it('separates operational returns from GST summary netting', async () => {
    const summary = await get('/gst-reports/summary').expect(200);
    const returns = await get('/gst-reports/returns-summary').expect(200);
    expect(returns.body.note).toContain('Operational returns only. Statutory GST Credit Note / Debit Note treatment is not implemented.');
    expect(returns.body.salesReturns.total).toBe('11.80');
    expect(returns.body.purchaseReturns.total).toBe('23.60');
    expect(summary.body.outwardSales.invoiceValue).toBe('118.00');
    expect(summary.body.purchaseTaxRecorded.purchaseValue).toBe('236.00');
  });

  it('exports CSV with UTF-8 BOM, stable headers, escaping and text formula protection', async () => {
    await get('/gst-reports/sales-register?businessId=22222222-2222-4222-8222-222222222222').expect(400);
    const sales = await get('/gst-reports/sales-register/export').expect(200);
    expect(sales.headers['content-type']).toContain('text/csv');
    expect(sales.text.charCodeAt(0)).toBe(0xfeff);
    expect(sales.text).toContain('Invoice,Date,Customer,GSTIN,Place of Supply,Taxable,CGST,SGST,IGST,GST,Total');
    expect(sales.text).toContain('"\'=INV, ""Q""\n1"');
    expect(sales.text).toContain("'+Formula Customer");
    expect(sales.text).toContain("'-GSTIN Snapshot");
    expect(sales.text).toContain('100.00,9.00,9.00,0.00,18.00,118.00');
    expect(sales.text).not.toContain("'100.00");
    const purchases = await get('/gst-reports/purchase-register/export').expect(200);
    expect(purchases.text).toContain("'@PB-1");
    expect(purchases.text).toContain("'-SUP-9");
  });

  it('validates financial year and exact date range boundaries', async () => {
    await get('/gst-reports/summary?financialYear=2026-29').expect(400);
    await get('/gst-reports/summary?dateFrom=2026-05-01&dateTo=2026-04-01').expect(400);
    await get('/gst-reports/summary?financialYear=2026-27&dateFrom=2026-04-01&dateTo=2027-03-31').expect(200);
    const where = db.invoice.findMany.mock.calls.at(-1)![0].where;
    expect(where.financialYear).toBe('2026-27');
    expect(where.invoiceDate.gte.toISOString()).toBe('2026-04-01T00:00:00.000Z');
    expect(where.invoiceDate.lte.toISOString()).toBe('2027-03-31T00:00:00.000Z');
  });
});
