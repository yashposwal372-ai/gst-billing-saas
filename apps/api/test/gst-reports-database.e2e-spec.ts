import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../src/database/database.service.js';
import { GstReportsService } from '../src/gst-reports/gst-reports.service.js';
import { safeUserSelect, type SafeUser } from '../src/users/user.select.js';
import { Prisma } from '../src/generated/prisma/client.js';

const D = Prisma.Decimal;
const day = (value: string) => new Date(`${value}T00:00:00.000Z`);

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  'GST reports (real PostgreSQL)',
  () => {
    let db: DatabaseService;
    let reports: GstReportsService;
    const businesses: string[] = [];
    const users: string[] = [];

    beforeAll(async () => {
      const url = process.env.TEST_DATABASE_URL!;
      if (!new URL(url).pathname.endsWith('_test')) throw new Error('Use a dedicated *_test database');
      db = new DatabaseService(new ConfigService({ DATABASE_URL: url }));
      reports = new GstReportsService(db);
      await db.$connect();
    });

    afterAll(async () => {
      if (!db) return;
      await db.businessDocumentLine.deleteMany({ where: { businessId: { in: businesses } } });
      await db.businessDocument.deleteMany({ where: { businessId: { in: businesses } } });
      await db.invoiceLine.deleteMany({ where: { businessId: { in: businesses } } });
      await db.invoice.deleteMany({ where: { businessId: { in: businesses } } });
      await db.businessMember.deleteMany({ where: { businessId: { in: businesses } } });
      await db.user.deleteMany({ where: { id: { in: users } } });
      await db.business.deleteMany({ where: { id: { in: businesses } } });
      await db.$disconnect();
    });

    async function owner(): Promise<SafeUser> {
      const user = await db.user.create({ data: { email: `${randomUUID()}@phase9.example`, passwordHash: 'test-only-not-a-login-hash', firstName: 'GST', lastName: 'Owner' } });
      users.push(user.id);
      const business = await db.business.create({ data: { name: 'Phase 9 GST reports business', ownerName: 'GST Owner', businessType: 'PROPRIETORSHIP', gstRegistered: true, gstin: `27${randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()}1Z5`.slice(0, 15), pan: 'AAACB1234C', mobile: '9876543210', email: user.email, addressLine1: '10 Report Street', state: 'Maharashtra', stateCode: '27', city: 'Pune', pincode: '411001', invoicePrefix: 'INV', financialYear: '2026-27', gstMode: 'EXCLUSIVE', onboardingCompletedAt: new Date(), memberships: { create: { userId: user.id, role: 'OWNER' } } } });
      businesses.push(business.id);
      return db.user.update({ where: { id: user.id }, data: { currentBusinessId: business.id }, select: safeUserSelect });
    }

    async function seedInvoice(user: SafeUser, overrides: Partial<Prisma.InvoiceUncheckedCreateInput> = {}) {
      return db.invoice.create({ data: { businessId: user.currentBusinessId!, status: 'FINALIZED', invoiceNumber: `INV/${randomUUID()}`, sequenceNumber: 1, financialYear: '2026-27', invoiceDate: day('2026-04-01'), dueDate: day('2026-04-15'), placeOfSupplyState: 'Maharashtra', placeOfSupplyStateCode: '27', gstApplicable: true, priceMode: 'EXCLUSIVE', sellerBusinessName: 'Seller Snapshot', sellerAddressLine1: '10 Report Street', sellerCity: 'Pune', sellerState: 'Maharashtra', sellerStateCode: '27', sellerPincode: '411001', customerNameSnapshot: 'Customer Snapshot', customerGstinSnapshot: '27ABCDE1234F1Z5', billingAddressLine1: '20 Buyer Street', billingCity: 'Pune', billingState: 'Maharashtra', billingStateCode: '27', billingPincode: '411001', subtotal: new D('100.00'), discountTotal: new D('0.00'), taxableTotal: new D('100.00'), cgstTotal: new D('9.00'), sgstTotal: new D('9.00'), igstTotal: new D('0.00'), taxTotal: new D('18.00'), roundOff: new D('0.00'), grandTotal: new D('118.00'), finalizedAt: new Date(), finalizedById: user.id, createdById: user.id, lines: { create: [{ businessId: user.currentBusinessId!, lineNumber: 1, productNameSnapshot: 'Snapshot Service', productTypeSnapshot: 'SERVICE', hsnSacCodeSnapshot: '998314', unitSnapshot: 'SERVICE', quantity: new D('1.000'), unitPrice: new D('100.00'), priceMode: 'EXCLUSIVE', discountType: 'NONE', taxableAmount: new D('100.00'), gstRate: new D('18.00'), cgstRate: new D('9.00'), cgstAmount: new D('9.00'), sgstRate: new D('9.00'), sgstAmount: new D('9.00'), igstRate: new D('0.00'), igstAmount: new D('0.00'), taxAmount: new D('18.00'), lineTotal: new D('118.00') }] }, ...overrides } });
    }

    async function seedDocument(user: SafeUser, overrides: Partial<Prisma.BusinessDocumentUncheckedCreateInput> = {}) {
      return db.businessDocument.create({ data: { businessId: user.currentBusinessId!, documentType: 'PURCHASE_BILL', status: 'FINALIZED', documentNumber: `PB/${randomUUID()}`, sequenceNumber: 1, financialYear: '2026-27', documentDate: day('2026-04-02'), partyKind: 'SUPPLIER', placeOfSupplyState: 'Karnataka', placeOfSupplyStateCode: '29', gstApplicable: true, priceMode: 'EXCLUSIVE', businessNameSnapshot: 'Buyer Snapshot', businessAddressLine1: '10 Report Street', businessCity: 'Pune', businessState: 'Maharashtra', businessStateCode: '27', businessPincode: '411001', partyNameSnapshot: 'Supplier Snapshot', partyGstinSnapshot: '29ABCDE1234F1Z5', partyAddressLine1: '30 Supplier Street', partyCity: 'Bengaluru', partyState: 'Karnataka', partyStateCode: '29', partyPincode: '560001', subtotal: new D('200.00'), discountTotal: new D('0.00'), taxableTotal: new D('200.00'), cgstTotal: new D('0.00'), sgstTotal: new D('0.00'), igstTotal: new D('36.00'), taxTotal: new D('36.00'), roundOff: new D('0.00'), grandTotal: new D('236.00'), actedAt: new Date(), actedById: user.id, createdById: user.id, lines: { create: [{ businessId: user.currentBusinessId!, lineNumber: 1, productNameSnapshot: 'Snapshot Goods', productTypeSnapshot: 'PRODUCT', hsnSacCodeSnapshot: '1001', unitSnapshot: 'KG', quantity: new D('2.000'), unitPrice: new D('100.00'), priceMode: 'EXCLUSIVE', discountType: 'NONE', taxableAmount: new D('200.00'), gstRate: new D('18.00'), igstRate: new D('18.00'), igstAmount: new D('36.00'), taxAmount: new D('36.00'), lineTotal: new D('236.00') }] }, ...overrides } });
    }

    it('includes only finalized invoices and purchase bills inside the requested financial year/date bounds', async () => {
      const user = await owner();
      await seedInvoice(user, { invoiceDate: day('2026-03-31'), financialYear: '2025-26', invoiceNumber: `INV/OUT/${randomUUID()}` });
      await seedInvoice(user, { invoiceDate: day('2026-04-01'), taxableTotal: new D('100.00'), taxTotal: new D('18.00'), grandTotal: new D('118.00') });
      await seedInvoice(user, { invoiceDate: day('2027-03-31'), taxableTotal: new D('300.00'), taxTotal: new D('54.00'), grandTotal: new D('354.00'), invoiceNumber: `INV/END/${randomUUID()}` });
      await seedInvoice(user, { invoiceDate: day('2027-04-01'), financialYear: '2027-28', invoiceNumber: `INV/NEXT/${randomUUID()}` });
      await seedInvoice(user, { status: 'DRAFT', invoiceNumber: null, sequenceNumber: null, finalizedAt: null, finalizedById: null });
      await seedInvoice(user, { status: 'CANCELLED', invoiceNumber: `INV/CAN/${randomUUID()}`, cancelledAt: new Date(), cancelledById: user.id });
      await seedDocument(user);
      await seedDocument(user, { documentType: 'PURCHASE_ORDER', documentNumber: `PO/${randomUUID()}` });
      const summary = await reports.summary(user, { financialYear: '2026-27', dateFrom: '2026-04-01', dateTo: '2027-03-31' });
      expect(summary.outwardSales.invoiceCount).toBe(2);
      expect(summary.outwardSales.taxableValue).toBe('400.00');
      expect(summary.outwardSales.totalTax).toBe('72.00');
      expect(summary.purchaseTaxRecorded.billCount).toBe(1);
      expect(summary.purchaseTaxRecorded.totalTax).toBe('36.00');
    });

    it('keeps HSN/SAC and GST rate summaries based on persisted line snapshots', async () => {
      const user = await owner();
      await seedInvoice(user);
      await seedDocument(user);
      const hsn = await reports.hsnSac(user, { financialYear: '2026-27' });
      expect(hsn.items.some((row: any) => row.classificationType === 'SAC' && row.code === '998314' && row.description === 'Snapshot Service')).toBe(true);
      expect(hsn.items.some((row: any) => row.classificationType === 'HSN' && row.code === '1001' && row.description === 'Snapshot Goods')).toBe(true);
      const rates = await reports.rateSummary(user, { financialYear: '2026-27' });
      expect(rates.items.some((row: any) => row.gstRate === '18.00' && row.salesTax === '18.00' && row.purchaseTax === '36.00')).toBe(true);
    });
  },
);
