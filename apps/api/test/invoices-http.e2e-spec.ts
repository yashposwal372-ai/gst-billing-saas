import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/common/configure-app.js';
import { DatabaseService } from '../src/database/database.service.js';
import { TokenService } from '../src/auth/token.service.js';
import { Prisma } from '../src/generated/prisma/client.js';

const D = Prisma.Decimal;

describe('invoices HTTP (database double, real guards/services)', () => {
  let app: INestApplication, cookie: string;
  const user = { id: '11111111-1111-4111-8111-111111111111', currentBusinessId: '22222222-2222-4222-8222-222222222222', status: 'ACTIVE', authVersion: 0 };
  const invoiceId = '33333333-3333-4333-8333-333333333333';
  const productId = '44444444-4444-4444-8444-444444444444';
  const customerId = '55555555-5555-4555-8555-555555555555';
  const business = {
    id: user.currentBusinessId, invoicePrefix: 'INV', name: 'Legal Co', tradeName: 'Trade Co', gstRegistered: true,
    gstin: '27AAACB1234C1Z5', pan: 'AAACB1234C', addressLine1: '1 Market', addressLine2: null, city: 'Pune',
    state: 'Maharashtra', stateCode: '27', pincode: '411001', bankName: null, accountHolder: null, accountNumber: null, ifsc: null, upiId: null,
  };
  const customer = {
    id: customerId, businessId: user.currentBusinessId, customerCode: 'CUS-000001', displayName: 'Retail Buyer', businessName: null,
    gstRegistered: true, gstin: '27ABCDE1234F1Z5', pan: 'ABCDE1234F', phone: '9876543210', email: null,
    addressLine1: '2 Buyer Road', addressLine2: null, city: 'Pune', state: 'Maharashtra', stateCode: '27', pincode: '411001',
    shippingAddressLine1: null, shippingAddressLine2: null, shippingCity: null, shippingState: null, shippingStateCode: null, shippingPincode: null, isActive: true,
  };
  const product = {
    id: productId, businessId: user.currentBusinessId, productCode: 'PRD-000001', name: 'Rice', type: 'PRODUCT', hsnSacCode: '1006',
    unit: 'KG', gstRate: new D(5), salePrice: new D(100), trackInventory: true, currentStock: new D('10.000'), isActive: true,
  };
  const body = {
    customerId, placeOfSupplyState: 'Maharashtra', placeOfSupplyStateCode: '27', invoiceDate: '2026-09-08', priceMode: 'EXCLUSIVE',
    lines: [{ productId, quantity: '2.000', unitPrice: '100.00', discountType: 'NONE', discountValue: '0' }],
  };
  const db = {
    authSession: { findUnique: vi.fn() },
    businessMember: { findUnique: vi.fn() },
    business: { findFirstOrThrow: vi.fn(), findUniqueOrThrow: vi.fn() },
    customer: { findFirst: vi.fn() },
    product: { findMany: vi.fn(), updateMany: vi.fn() },
    invoice: { create: vi.fn(), findFirst: vi.fn(), findFirstOrThrow: vi.fn(), update: vi.fn(), updateMany: vi.fn(), delete: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    invoiceLine: { deleteMany: vi.fn() },
    invoiceSequence: { upsert: vi.fn() },
    stockMovement: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  const draftData = () => ({
    id: invoiceId,
    businessId: user.currentBusinessId,
    status: 'DRAFT',
    invoiceNumber: null,
    sequenceNumber: null,
    financialYear: '2026-27',
    invoiceDate: new Date('2026-09-08T00:00:00.000Z'),
    dueDate: null,
    customerId,
    placeOfSupplyState: 'Maharashtra',
    placeOfSupplyStateCode: '27',
    gstApplicable: true,
    priceMode: 'EXCLUSIVE',
    notes: null,
    terms: null,
    sellerBusinessName: 'Trade Co',
    sellerLegalName: 'Legal Co',
    sellerGstin: business.gstin,
    sellerPan: business.pan,
    sellerAddressLine1: business.addressLine1,
    sellerAddressLine2: null,
    sellerCity: business.city,
    sellerState: business.state,
    sellerStateCode: business.stateCode,
    sellerPincode: business.pincode,
    sellerBankName: null,
    sellerAccountHolder: null,
    sellerAccountNumber: null,
    sellerIfsc: null,
    sellerUpiId: null,
    customerCodeSnapshot: customer.customerCode,
    customerNameSnapshot: customer.displayName,
    customerBusinessName: null,
    customerGstinSnapshot: customer.gstin,
    customerPanSnapshot: customer.pan,
    customerPhoneSnapshot: customer.phone,
    customerEmailSnapshot: null,
    billingAddressLine1: customer.addressLine1,
    billingAddressLine2: null,
    billingCity: customer.city,
    billingState: customer.state,
    billingStateCode: customer.stateCode,
    billingPincode: customer.pincode,
    shippingAddressLine1: null,
    shippingAddressLine2: null,
    shippingCity: null,
    shippingState: null,
    shippingStateCode: null,
    shippingPincode: null,
    subtotal: new D('200'),
    discountTotal: new D('0'),
    taxableTotal: new D('200'),
    cgstTotal: new D('5'),
    sgstTotal: new D('5'),
    igstTotal: new D('0'),
    taxTotal: new D('10'),
    roundOff: new D('0'),
    grandTotal: new D('210'),
    finalizedAt: null,
    finalizedById: null,
    cancelledAt: null,
    cancelledById: null,
    cancellationReason: null,
    createdById: user.id,
    createdAt: new Date(),
    updatedAt: new Date(),
    lines: [{
      id: 'line-a',
      invoiceId,
      businessId: user.currentBusinessId,
      productId,
      lineNumber: 1,
      productCodeSnapshot: product.productCode,
      productNameSnapshot: product.name,
      productTypeSnapshot: 'PRODUCT',
      hsnSacCodeSnapshot: '1006',
      unitSnapshot: 'KG',
      quantity: new D('2.000'),
      unitPrice: new D('100'),
      priceMode: 'EXCLUSIVE',
      discountType: 'NONE',
      discountValue: new D('0'),
      discountAmount: new D('0'),
      grossAmount: new D('200'),
      taxableAmount: new D('200'),
      gstRate: new D('5'),
      cgstRate: new D('2.5'),
      cgstAmount: new D('5'),
      sgstRate: new D('2.5'),
      sgstAmount: new D('5'),
      igstRate: new D('0'),
      igstAmount: new D('0'),
      taxAmount: new D('10'),
      lineTotal: new D('210'),
      createdAt: new Date(),
    }],
  });
  beforeEach(async () => {
    vi.resetAllMocks();
    let currentInvoice = draftData();
    db.$transaction.mockImplementation((fn) => fn(db));
    db.authSession.findUnique.mockResolvedValue({ id: 'session-a', userId: user.id, user, expiresAt: new Date(Date.now() + 600000), revokedAt: null, authVersion: 0 });
    db.businessMember.findUnique.mockResolvedValue({ role: 'OWNER' });
    db.business.findFirstOrThrow.mockResolvedValue(business);
    db.business.findUniqueOrThrow.mockResolvedValue(business);
    db.customer.findFirst.mockResolvedValue(customer);
    db.product.findMany.mockResolvedValue([product]);
    db.product.updateMany.mockResolvedValue({ count: 1 });
    db.invoiceSequence.upsert.mockResolvedValue({ nextNumber: 1 });
    db.stockMovement.create.mockImplementation(({ data }) => ({ id: 'movement', createdAt: new Date(), ...data }));
    db.invoice.create.mockImplementation(({ data }) => ({ id: invoiceId, invoiceNumber: null, sequenceNumber: null, createdAt: new Date(), updatedAt: new Date(), ...data, lines: data.lines.create.map((line: object) => ({ id: 'line-a', invoiceId, ...line })) }));
    db.invoice.findFirst.mockImplementation(() => Promise.resolve(currentInvoice));
    db.invoice.findFirstOrThrow.mockImplementation(() => Promise.resolve(currentInvoice));
    db.invoice.update.mockImplementation(({ data }) => ({
      ...draftData(),
      ...data,
      lines: data.lines?.create?.map((line: object) => ({
        id: 'line-updated',
        invoiceId,
        ...line,
      })) ?? draftData().lines,
    }));
    db.invoice.updateMany.mockImplementation(({ data, where }) => {
      if (where.status && currentInvoice.status !== where.status) return { count: 0 };
      currentInvoice = { ...currentInvoice, ...data };
      return { count: 1 };
    });
    db.invoice.findMany.mockResolvedValue([]);
    db.invoice.count.mockResolvedValue(0);
    const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(DatabaseService).useValue(db).compile();
    app = module.createNestApplication(); app.useLogger(false); configureApp(app); await app.init();
    cookie = 'gst_access=' + await app.get(TokenService).sign(user.id, 'session-a');
  });
  afterEach(async () => app.close());
  const post = (path: string, payload: object = body) => request(app.getHttpServer()).post('/api/v1' + path).set('Cookie', cookie).set('Origin', 'http://localhost:3000').set('X-CSRF-Protection', '1').send(payload);
  const patch = (path: string, payload: object = body) => request(app.getHttpServer()).patch('/api/v1' + path).set('Cookie', cookie).set('Origin', 'http://localhost:3000').set('X-CSRF-Protection', '1').send(payload);
  const del = (path: string) => request(app.getHttpServer()).delete('/api/v1' + path).set('Cookie', cookie).set('Origin', 'http://localhost:3000').set('X-CSRF-Protection', '1');

  it('previews authoritative totals and rejects client totals', async () => {
    const result = await post('/invoices/preview').expect(201);
    expect(result.body.invoiceNumber).toBeNull();
    expect(result.body.taxableTotal).toBe('200.00');
    expect(result.body.cgstTotal).toBe('5.00');
    await post('/invoices/preview', { ...body, grandTotal: '1.00' }).expect(400);
    await post('/invoices/preview', { ...body, invoiceNumber: 'INV/2026-27/999999' }).expect(400);
  });

  it('creates an unnumbered draft without stock movement', async () => {
    const result = await post('/invoices').expect(201);
    expect(result.body.profile.invoiceNumber).toBeNull();
    expect(result.body.profile.status).toBe('DRAFT');
    expect(db.stockMovement.create).not.toHaveBeenCalled();
    expect(db.invoiceSequence.upsert).not.toHaveBeenCalled();
    expect(result.body.profile.sellerBusinessName).toBe('Trade Co');
    expect(result.body.profile.customerNameSnapshot).toBe('Retail Buyer');
    expect(result.body.profile.lines[0].productNameSnapshot).toBe('Rice');
  });

  it('updates and discards only draft invoices', async () => {
    await patch('/invoices/' + invoiceId, { ...body, lines: [{ ...body.lines[0], quantity: '3.000' }] }).expect(200);
    expect(db.invoiceLine.deleteMany).toHaveBeenCalledWith({ where: { invoiceId } });
    await del('/invoices/' + invoiceId).expect(200);
    db.invoice.findFirst.mockResolvedValue({ ...draftData(), status: 'FINALIZED' });
    await patch('/invoices/' + invoiceId).expect(400);
    await del('/invoices/' + invoiceId).expect(400);
    db.invoice.findFirst.mockResolvedValue({ ...draftData(), status: 'CANCELLED' });
    await patch('/invoices/' + invoiceId).expect(400);
    await del('/invoices/' + invoiceId).expect(400);
  });

  it('finalizes with a sequence number and stock deduction', async () => {
    const result = await post('/invoices/' + invoiceId + '/finalize', {}).expect(201);
    expect(result.body.profile.invoiceNumber).toBe('INV/2026-27/000001');
    expect(result.body.profile.status).toBe('FINALIZED');
    expect(db.product.updateMany.mock.calls[0]![0].data.currentStock.toFixed(3)).toBe('8.000');
    expect(db.stockMovement.create.mock.calls[0]![0].data.type).toBe('INVOICE_FINALIZED');
    expect(db.invoice.updateMany.mock.calls[0]![0].where).toMatchObject({
      id: invoiceId,
      status: 'DRAFT',
      invoiceNumber: null,
      sequenceNumber: null,
    });
  });

  it('cancels finalized invoices with stock restoration and reason', async () => {
    db.invoice.findFirst.mockResolvedValue({ ...draftData(), status: 'FINALIZED', invoiceNumber: 'INV/2026-27/000001' });
    db.invoice.updateMany.mockResolvedValueOnce({ count: 1 });
    db.invoice.findFirstOrThrow.mockResolvedValue({ ...draftData(), status: 'CANCELLED', invoiceNumber: 'INV/2026-27/000001', cancellationReason: 'Billing error' });
    const result = await post('/invoices/' + invoiceId + '/cancel', { reason: 'Billing error' }).expect(201);
    expect(result.body.profile.status).toBe('CANCELLED');
    expect(db.stockMovement.create.mock.calls[0]![0].data.type).toBe('INVOICE_CANCELLED');
    expect(result.body.profile.invoiceNumber).toBe('INV/2026-27/000001');
    expect(result.body.profile.grandTotal).toBe('210.00');
  });

  it('does not allocate stock movements for repeated finalize or cancel states', async () => {
    db.invoice.findFirst.mockResolvedValue({ ...draftData(), status: 'FINALIZED', invoiceNumber: 'INV/2026-27/000001' });
    await post('/invoices/' + invoiceId + '/finalize', {}).expect(400);
    expect(db.invoiceSequence.upsert).not.toHaveBeenCalled();
    expect(db.stockMovement.create).not.toHaveBeenCalled();
    db.invoice.findFirst.mockResolvedValue({ ...draftData(), status: 'CANCELLED', invoiceNumber: 'INV/2026-27/000001' });
    await post('/invoices/' + invoiceId + '/cancel', { reason: 'again' }).expect(400);
    expect(db.stockMovement.create).not.toHaveBeenCalled();
  });

  it('rejects invalid commercial inputs and cross-tenant records', async () => {
    await post('/invoices/preview', { ...body, lines: [{ ...body.lines[0], quantity: '0' }] }).expect(400);
    await post('/invoices/preview', { ...body, lines: [{ ...body.lines[0], discountType: 'AMOUNT', discountValue: '999.99' }] }).expect(400);
    db.customer.findFirst.mockResolvedValueOnce(null);
    await post('/invoices/preview').expect(400);
    db.product.findMany.mockResolvedValueOnce([]);
    await post('/invoices/preview').expect(400);
  });

  it('rejects inactive products and insufficient stock before finalizing', async () => {
    db.product.findMany.mockResolvedValueOnce([{ ...product, isActive: false }]);
    await post('/invoices/preview').expect(400);
    db.product.findMany.mockResolvedValueOnce([{ ...product, currentStock: new D('1.000') }]);
    await post('/invoices/' + invoiceId + '/finalize', {}).expect(400);
    expect(db.invoiceSequence.upsert).not.toHaveBeenCalled();
  });

  it('aggregates duplicate product lines for one stock deduction and skips service stock', async () => {
    db.invoice.findFirst.mockResolvedValue({
      ...draftData(),
      lines: [
        ...draftData().lines,
        { ...draftData().lines[0], id: 'line-b', quantity: new D('1.250') },
        { ...draftData().lines[0], id: 'line-c', productId: '66666666-6666-4666-8666-666666666666', productTypeSnapshot: 'SERVICE', quantity: new D('9.000') },
      ],
    });
    db.product.findMany.mockResolvedValueOnce([
      product,
      { ...product, id: '66666666-6666-4666-8666-666666666666', type: 'SERVICE', trackInventory: false },
    ]);
    db.invoice.findFirstOrThrow.mockResolvedValue({ ...draftData(), status: 'FINALIZED', invoiceNumber: 'INV/2026-27/000001' });
    await post('/invoices/' + invoiceId + '/finalize', {}).expect(201);
    expect(db.product.updateMany).toHaveBeenCalledTimes(1);
    expect(db.product.updateMany.mock.calls[0]![0].data.currentStock.toFixed(3)).toBe('6.750');
  });

  it('requires a cancellation reason', async () => {
    await post('/invoices/' + invoiceId + '/cancel', { reason: '' }).expect(400);
  });
});
