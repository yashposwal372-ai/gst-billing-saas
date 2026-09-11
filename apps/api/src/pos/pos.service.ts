import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { Prisma } from '../generated/prisma/client.js';
import type { SafeUser } from '../users/user.select.js';
import { ownerScope, requireOwner } from '../parties/party.data.js';
import { dateOnly, money } from '../invoices/invoice-calculator.js';
import { InvoicesService } from '../invoices/invoices.service.js';
import { FinanceService } from '../finance/finance.service.js';
import type { PosCheckoutDto, PosProductQuery, PosSalesQuery } from './pos.dto.js';

const D = Prisma.Decimal;
const ZERO = new D(0);

@Injectable()
export class PosService {
  constructor(private readonly db: DatabaseService, private readonly invoices: InvoicesService, private readonly finance: FinanceService) {}

  async products(user: SafeUser, q: PosProductQuery) {
    const scope = await requireOwner(this.db, user);
    const search = q.search?.trim();
    const where: Prisma.ProductWhereInput = { businessId: scope.businessId, isActive: true, ...(search ? { OR: ['name','productCode','sku','barcode'].map((field) => ({ [field]: { contains: search, mode: field === 'productCode' ? undefined : 'insensitive' } })) } : {}) };
    const [rows,total] = await this.db.$transaction([this.db.product.findMany({ where, skip: (q.page - 1) * q.pageSize, take: q.pageSize, orderBy: [{ name: 'asc' }, { id: 'asc' }], select: { id:true, productCode:true, name:true, type:true, unit:true, sku:true, barcode:true, salePrice:true, gstRate:true, currentStock:true, minimumStock:true, trackInventory:true } }), this.db.product.count({ where })]);
    return { items: rows.map((r) => this.productRow(r)), page: q.page, pageSize: q.pageSize, total, totalPages: Math.ceil(total/q.pageSize) };
  }

  async barcode(user: SafeUser, barcode: string) {
    const scope = await requireOwner(this.db, user);
    const product = await this.db.product.findFirst({ where: { businessId: scope.businessId, barcode: barcode.trim(), isActive: true }, select: { id:true, productCode:true, name:true, type:true, unit:true, sku:true, barcode:true, salePrice:true, gstRate:true, currentStock:true, minimumStock:true, trackInventory:true } });
    if (!product) throw new NotFoundException('Barcode was not found for an active product or service');
    return this.productRow(product);
  }

  async preview(user: SafeUser, dto: PosCheckoutDto) {
    return this.invoices.previewPos(user, this.invoiceDto(dto));
  }

  async checkout(user: SafeUser, dto: PosCheckoutDto) {
    const prior = await this.db.invoice.findFirst({ where: { ...ownerScope(user), posClientCheckoutId: dto.clientCheckoutId }, include: { paymentAllocations: { include: { payment: true } }, lines: { orderBy: { lineNumber: 'asc' } } } });
    if (prior) return { invoice: await this.invoices.detail(user, prior.id), payment: this.paymentSummary(prior.paymentAllocations), paymentError: null, changeDue: '0.00', duplicate: true };
    const invoice = await this.invoices.createFinalizedPosInvoice(user, this.invoiceDto(dto), dto.clientCheckoutId) as any;
    if (dto.paymentMode === 'PAY_LATER') return { invoice, payment: null, paymentError: null, changeDue: '0.00', duplicate: false };
    const tender = dto.tender;
    if (!tender) throw new BadRequestException('Choose a recorded tender for paid checkout');
    const amount = money(tender.amount);
    const tendered = money(tender.tenderedAmount ?? tender.amount);
    const due = new D(invoice.grandTotal);
    if (!amount.eq(due)) throw new BadRequestException('Recorded POS payment must equal the finalized invoice total');
    if (tendered.lt(amount)) throw new BadRequestException('Tendered amount cannot be less than recorded payment');
    try {
      const draft = await this.finance.createPayment(user, { type: 'CUSTOMER_RECEIPT', accountId: tender.accountId, paymentDate: invoice.invoiceDate, method: tender.method, amount: amount.toFixed(2), referenceNumber: tender.referenceNumber, notes: 'Recorded from POS checkout', allocations: [{ invoiceId: invoice.id, amount: amount.toFixed(2) }] });
      const posted = await this.finance.postPayment(user, (draft as any).id);
      return { invoice: await this.invoices.detail(user, invoice.id), payment: posted, paymentError: null, changeDue: tendered.minus(amount).toFixed(2), duplicate: false };
    } catch (error) {
      return { invoice: await this.invoices.detail(user, invoice.id), payment: null, paymentError: error instanceof Error ? error.message : 'Payment was not recorded', changeDue: '0.00', duplicate: false };
    }
  }

  async sales(user: SafeUser, q: PosSalesQuery) {
    const scope = await requireOwner(this.db, user);
    if (q.dateFrom && q.dateTo && q.dateFrom > q.dateTo) throw new BadRequestException('dateFrom must be before or equal to dateTo');
    const where: Prisma.InvoiceWhereInput = { businessId: scope.businessId, salesChannel: 'POS', status: 'FINALIZED', ...(q.customerId ? { customerId: q.customerId } : {}), ...((q.dateFrom || q.dateTo) ? { invoiceDate: { ...(q.dateFrom ? { gte: new Date(`${q.dateFrom}T00:00:00.000Z`) } : {}), ...(q.dateTo ? { lte: new Date(`${q.dateTo}T00:00:00.000Z`) } : {}) } } : {}), ...(q.search ? { OR: [{ invoiceNumber: { contains: q.search, mode: 'insensitive' } }, { customerNameSnapshot: { contains: q.search, mode: 'insensitive' } }] } : {}) };
    const [rows,total] = await this.db.$transaction([this.db.invoice.findMany({ where, skip:(q.page-1)*q.pageSize, take:q.pageSize, orderBy:[{ [q.sortBy]: q.sortOrder }, { id:'asc' }], include:{ lines:{ select:{ id:true } }, paymentAllocations:{ where:{ payment:{ status:'POSTED', type:'CUSTOMER_RECEIPT' } } } } }), this.db.invoice.count({ where })], { isolationLevel: 'RepeatableRead' });
    const items = rows.map((r:any) => { const paid = r.paymentAllocations.reduce((sum: Prisma.Decimal, a: { amount: Prisma.Decimal }) => sum.plus(a.amount), ZERO); const outstanding = money(r.grandTotal.minus(paid)); const paymentStatus = paid.eq(0) ? 'UNPAID' : outstanding.gt(0) ? 'PARTIAL' : 'PAID'; return { invoiceId:r.id, invoiceNumber:r.invoiceNumber, invoiceDate:dateOnly(r.invoiceDate), customerId:r.customerId, customerName:r.customerNameSnapshot, itemCount:r.lines.length, grandTotal:r.grandTotal.toFixed(2), paidAmount:paid.toFixed(2), outstanding:outstanding.toFixed(2), paymentStatus, salesChannel:r.salesChannel }; }).filter((row) => !q.paymentStatus || row.paymentStatus === q.paymentStatus);
    return { items, page:q.page, pageSize:q.pageSize, total: q.paymentStatus ? items.length : total, totalPages: Math.ceil((q.paymentStatus ? items.length : total)/q.pageSize) };
  }

  private invoiceDto(dto: PosCheckoutDto) { return { customerId: dto.customerMode === 'CUSTOMER' ? dto.customerId : undefined, placeOfSupplyState: dto.placeOfSupplyState, placeOfSupplyStateCode: dto.placeOfSupplyStateCode, invoiceDate: dto.invoiceDate, priceMode: dto.priceMode, notes: dto.notes, terms: 'POS sale', lines: dto.lines }; }
  private paymentSummary(allocations: any[]) { return allocations.find((a) => a.payment?.status === 'POSTED')?.payment ?? null; }
  private productRow(r: any) { const out = r.trackInventory && r.currentStock.lte(0); const low = r.trackInventory && r.currentStock.gt(0) && r.minimumStock && r.currentStock.lte(r.minimumStock); return { id:r.id, code:r.productCode, name:r.name, type:r.type, unit:r.unit, sku:r.sku, barcode:r.barcode, salePrice:r.salePrice.toFixed(2), gstRate:r.gstRate.toFixed(2), currentStock:r.currentStock.toFixed(3), trackInventory:r.trackInventory, stockStatus: r.type === 'SERVICE' ? 'SERVICE' : out ? 'OUT_OF_STOCK' : low ? 'LOW_STOCK' : 'IN_STOCK' }; }
}
