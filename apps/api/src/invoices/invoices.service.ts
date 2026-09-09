import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { $Enums, Prisma } from '../generated/prisma/client.js';
import type { SafeUser } from '../users/user.select.js';
import { ownerScope, requireOwner } from '../parties/party.data.js';
import { validatePartyState } from '../parties/party-address.js';
import { serializable } from '../catalogue/catalogue.data.js';
import type {
  CancelInvoiceDto,
  InvoiceDraftDto,
  InvoiceLineDto,
  InvoiceQuery,
} from './invoice.dto.js';
import {
  dateOnly,
  financialYear,
  InvoiceCalculator,
  money,
  parseDateOnly,
} from './invoice-calculator.js';

const invoiceInclude = { lines: { orderBy: { lineNumber: 'asc' } } } as const;
const D = Prisma.Decimal;
const ZERO = new D(0);
const queryStatus = {
  draft: 'DRAFT',
  finalized: 'FINALIZED',
  cancelled: 'CANCELLED',
} as const satisfies Record<Exclude<InvoiceQuery['status'], 'all'>, $Enums.InvoiceStatus>;

type Scope = ReturnType<typeof ownerScope>;
type Tx = Prisma.TransactionClient;

@Injectable()
export class InvoicesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly calculator: InvoiceCalculator,
  ) {}

  async preview(user: SafeUser, dto: InvoiceDraftDto) {
    return this.db.$transaction(
      async (tx) =>
        (await this.buildDraft(tx, await requireOwner(tx, user), user, dto))
          .invoice,
      { isolationLevel: 'RepeatableRead' },
    );
  }

  async create(user: SafeUser, dto: InvoiceDraftDto) {
    return serializable(this.db, async (tx) => {
      const scope = await requireOwner(tx, user);
      const draft = await this.buildDraft(tx, scope, user, dto);
      const row = await tx.invoice.create({
        data: {
          ...draft.invoiceData,
          businessId: scope.businessId,
          createdById: user.id,
          lines: { create: draft.linesData },
        },
        include: invoiceInclude,
      });
      return this.view(row);
    });
  }

  async update(user: SafeUser, id: string, dto: InvoiceDraftDto) {
    return serializable(this.db, async (tx) => {
      const scope = await requireOwner(tx, user);
      const existing = await tx.invoice.findFirst({ where: { ...scope, id } });
      if (!existing) throw new NotFoundException('Invoice not found');
      if (existing.status !== 'DRAFT')
        throw new BadRequestException('Only draft invoices can be edited');
      const draft = await this.buildDraft(tx, scope, user, dto);
      await tx.invoiceLine.deleteMany({ where: { invoiceId: id } });
      const row = await tx.invoice.update({
        where: { id },
        data: {
          ...draft.invoiceData,
          invoiceNumber: null,
          sequenceNumber: null,
          status: 'DRAFT',
          lines: { create: draft.linesData },
        },
        include: invoiceInclude,
      });
      return this.view(row);
    });
  }

  async discard(user: SafeUser, id: string) {
    return serializable(this.db, async (tx) => {
      const scope = await requireOwner(tx, user);
      const existing = await tx.invoice.findFirst({ where: { ...scope, id } });
      if (!existing) throw new NotFoundException('Invoice not found');
      if (existing.status !== 'DRAFT')
        throw new BadRequestException('Only draft invoices can be discarded');
      await tx.invoice.delete({ where: { id } });
      return { discarded: true };
    });
  }

  async list(user: SafeUser, query: InvoiceQuery) {
    return this.db.$transaction(
      async (tx) => {
        const scope = await requireOwner(tx, user);
        const where: Prisma.InvoiceWhereInput = {
          ...scope,
          ...(query.status === 'all'
            ? {}
            : { status: queryStatus[query.status] }),
          ...(query.customerId ? { customerId: query.customerId } : {}),
          ...(query.search
            ? {
                OR: [
                  { invoiceNumber: { contains: query.search } },
                  {
                    customerNameSnapshot: {
                      contains: query.search,
                      mode: 'insensitive',
                    },
                  },
                  {
                    customerCodeSnapshot: {
                      contains: query.search,
                      mode: 'insensitive',
                    },
                  },
                ],
              }
            : {}),
        };
        const [rows, total] = await Promise.all([
          tx.invoice.findMany({
            where,
            select: {
              id: true,
              status: true,
              invoiceNumber: true,
              invoiceDate: true,
              customerNameSnapshot: true,
              placeOfSupplyStateCode: true,
              grandTotal: true,
              createdAt: true,
            },
            orderBy: [{ [query.sortBy]: query.sortOrder }, { id: 'asc' }],
            skip: (query.page - 1) * query.pageSize,
            take: query.pageSize,
          }),
          tx.invoice.count({ where }),
        ]);
        return {
          items: rows.map((row) => ({
            ...row,
            invoiceDate: dateOnly(row.invoiceDate),
            grandTotal: row.grandTotal.toFixed(2),
          })),
          total,
          page: query.page,
          pageSize: query.pageSize,
          totalPages: Math.ceil(total / query.pageSize),
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  async detail(user: SafeUser, id: string) {
    const row = await this.db.invoice.findFirst({
      where: { ...ownerScope(user), id },
      include: invoiceInclude,
    });
    if (!row) throw new NotFoundException('Invoice not found');
    return this.view(row);
  }

  async finalize(user: SafeUser, id: string) {
    return serializable(this.db, async (tx) => {
      const scope = await requireOwner(tx, user);
      const invoice = await tx.invoice.findFirst({
        where: { ...scope, id },
        include: invoiceInclude,
      });
      if (!invoice) throw new NotFoundException('Invoice not found');
      if (invoice.status !== 'DRAFT')
        throw new BadRequestException('Only draft invoices can be finalized');
      const totals = await this.productQuantities(tx, scope, invoice.lines);
      this.assertStockAvailable(totals);
      const sequence = await tx.invoiceSequence.upsert({
        where: {
          businessId_financialYear: {
            businessId: scope.businessId,
            financialYear: invoice.financialYear,
          },
        },
        create: {
          businessId: scope.businessId,
          financialYear: invoice.financialYear,
          nextNumber: 1,
        },
        update: { nextNumber: { increment: 1 } },
        select: { nextNumber: true },
      });
      const number = await this.invoiceNumber(
        tx,
        scope.businessId,
        invoice.financialYear,
        sequence.nextNumber,
      );
      const changed = await tx.invoice.updateMany({
        where: {
          ...scope,
          id,
          status: 'DRAFT',
          invoiceNumber: null,
          sequenceNumber: null,
        },
        data: {
          status: 'FINALIZED',
          sequenceNumber: sequence.nextNumber,
          invoiceNumber: number,
          finalizedAt: new Date(),
          finalizedById: user.id,
        },
      });
      if (changed.count !== 1)
        throw new ConflictException('Invoice was already finalized');
      await this.applyStock(tx, scope, user, invoice.id, totals, 'finalize');
      const row = await tx.invoice.findFirstOrThrow({
        where: { ...scope, id },
        include: invoiceInclude,
      });
      return this.view(row);
    });
  }

  async cancel(user: SafeUser, id: string, dto: CancelInvoiceDto) {
    return serializable(this.db, async (tx) => {
      const scope = await requireOwner(tx, user);
      const invoice = await tx.invoice.findFirst({
        where: { ...scope, id },
        include: invoiceInclude,
      });
      if (!invoice) throw new NotFoundException('Invoice not found');
      if (invoice.status !== 'FINALIZED')
        throw new BadRequestException('Only finalized invoices can be cancelled');
      const totals = await this.productQuantities(tx, scope, invoice.lines);
      const changed = await tx.invoice.updateMany({
        where: { ...scope, id, status: 'FINALIZED', cancelledAt: null },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelledById: user.id,
          cancellationReason: dto.reason,
        },
      });
      if (changed.count !== 1)
        throw new ConflictException('Invoice was already cancelled');
      await this.applyStock(tx, scope, user, invoice.id, totals, 'cancel');
      const row = await tx.invoice.findFirstOrThrow({
        where: { ...scope, id },
        include: invoiceInclude,
      });
      return this.view(row);
    });
  }

  private async invoiceNumber(tx: Tx, businessId: string, fy: string, n: number) {
    const business = await tx.business.findUniqueOrThrow({
      where: { id: businessId },
      select: { invoicePrefix: true },
    });
    return `${business.invoicePrefix}/${fy}/${String(n).padStart(6, '0')}`;
  }

  private async buildDraft(
    tx: Tx,
    scope: Scope,
    _user: SafeUser,
    dto: InvoiceDraftDto,
  ) {
    validatePartyState(dto.placeOfSupplyState, dto.placeOfSupplyStateCode);
    const business = await tx.business.findFirstOrThrow({
      where: { id: scope.businessId },
    });
    if (business.gstRegistered && (!business.gstin || !business.stateCode))
      throw new BadRequestException('Complete seller GST and state details before applying GST');
    const customer = dto.customerId
      ? await tx.customer.findFirst({ where: { ...scope, id: dto.customerId } })
      : null;
    if (!customer) throw new BadRequestException('Choose a customer for this invoice');
    if (!customer.isActive)
      throw new BadRequestException('Choose an active customer for this invoice');
    if (customer.gstRegistered && customer.gstin?.slice(0, 2) !== customer.stateCode)
      throw new BadRequestException('Customer GSTIN state code must match address state code');
    const intra = business.stateCode === dto.placeOfSupplyStateCode;
    const lines = await this.lineData(
      tx,
      scope,
      dto.lines,
      dto.priceMode ?? 'EXCLUSIVE',
      intra,
    );
    const totals = lines.reduce(
      (sum, line) => ({
        subtotal: money(sum.subtotal.plus(line.grossAmount)),
        discountTotal: money(sum.discountTotal.plus(line.discountAmount)),
        taxableTotal: money(sum.taxableTotal.plus(line.taxableAmount)),
        cgstTotal: money(sum.cgstTotal.plus(line.cgstAmount)),
        sgstTotal: money(sum.sgstTotal.plus(line.sgstAmount)),
        igstTotal: money(sum.igstTotal.plus(line.igstAmount)),
        taxTotal: money(sum.taxTotal.plus(line.taxAmount)),
        grandTotal: money(sum.grandTotal.plus(line.lineTotal)),
      }),
      {
        subtotal: ZERO,
        discountTotal: ZERO,
        taxableTotal: ZERO,
        cgstTotal: ZERO,
        sgstTotal: ZERO,
        igstTotal: ZERO,
        taxTotal: ZERO,
        grandTotal: ZERO,
      },
    );
    const invoiceDate = parseDateOnly(dto.invoiceDate);
    const invoiceData = {
      status: 'DRAFT' as const,
      financialYear: financialYear(invoiceDate),
      invoiceDate,
      dueDate: dto.dueDate ? parseDateOnly(dto.dueDate) : null,
      customerId: customer.id,
      placeOfSupplyState: dto.placeOfSupplyState,
      placeOfSupplyStateCode: dto.placeOfSupplyStateCode,
      gstApplicable: business.gstRegistered,
      priceMode: dto.priceMode ?? 'EXCLUSIVE',
      notes: dto.notes || null,
      terms: dto.terms || null,
      sellerBusinessName: business.tradeName || business.name,
      sellerLegalName: business.name,
      sellerGstin: business.gstin,
      sellerPan: business.pan,
      sellerAddressLine1: business.addressLine1,
      sellerAddressLine2: business.addressLine2,
      sellerCity: business.city,
      sellerState: business.state,
      sellerStateCode: business.stateCode,
      sellerPincode: business.pincode,
      sellerBankName: business.bankName,
      sellerAccountHolder: business.accountHolder,
      sellerAccountNumber: business.accountNumber,
      sellerIfsc: business.ifsc,
      sellerUpiId: business.upiId,
      customerCodeSnapshot: customer.customerCode,
      customerNameSnapshot: customer.displayName,
      customerBusinessName: customer.businessName,
      customerGstinSnapshot: customer.gstin,
      customerPanSnapshot: customer.pan,
      customerPhoneSnapshot: customer.phone,
      customerEmailSnapshot: customer.email,
      billingAddressLine1: customer.addressLine1,
      billingAddressLine2: customer.addressLine2,
      billingCity: customer.city,
      billingState: customer.state,
      billingStateCode: customer.stateCode,
      billingPincode: customer.pincode,
      shippingAddressLine1: customer.shippingAddressLine1,
      shippingAddressLine2: customer.shippingAddressLine2,
      shippingCity: customer.shippingCity,
      shippingState: customer.shippingState,
      shippingStateCode: customer.shippingStateCode,
      shippingPincode: customer.shippingPincode,
      ...totals,
      roundOff: ZERO,
    };
    return { invoice: this.previewView(invoiceData, lines), invoiceData, linesData: lines };
  }

  private async lineData(tx: Tx, scope: Scope, lines: InvoiceLineDto[], priceMode: 'EXCLUSIVE' | 'INCLUSIVE', intra: boolean) {
    const ids = [...new Set(lines.map((line) => line.productId))];
    const products = await tx.product.findMany({ where: { ...scope, id: { in: ids } } });
    const map = new Map(products.map((product) => [product.id, product]));
    return lines.map((line, index) => {
      const product = map.get(line.productId);
      if (!product || !product.isActive)
        throw new BadRequestException('Choose active products or services from this business');
      const quantity = new D(line.quantity);
      if (quantity.lte(0)) throw new BadRequestException('Line quantity must be greater than zero');
      const discountValue = new D(line.discountValue ?? '0');
      const gross = money(quantity.mul(line.unitPrice));
      if (line.discountType === 'PERCENT' && discountValue.gt(100))
        throw new BadRequestException('Percentage discount cannot exceed 100');
      if (line.discountType === 'AMOUNT' && discountValue.gt(gross))
        throw new BadRequestException('Amount discount cannot exceed line amount');
      const calc = this.calculator.line({
        quantity,
        unitPrice: new D(line.unitPrice),
        gstRate: product.gstRate,
        priceMode,
        discountType: line.discountType,
        discountValue,
      }, intra);
      return {
        lineNumber: index + 1,
        businessId: scope.businessId,
        productId: product.id,
        productCodeSnapshot: product.productCode,
        productNameSnapshot: product.name,
        productTypeSnapshot: product.type,
        hsnSacCodeSnapshot: product.hsnSacCode,
        unitSnapshot: product.unit,
        quantity,
        unitPrice: new D(line.unitPrice),
        priceMode,
        discountType: line.discountType,
        discountValue,
        ...calc,
      };
    });
  }

  private async productQuantities(tx: Tx, scope: Scope, lines: { productId: string | null; quantity: Prisma.Decimal }[]) {
    const totals = new Map<string, Prisma.Decimal>();
    for (const line of lines) if (line.productId) totals.set(line.productId, (totals.get(line.productId) ?? ZERO).plus(line.quantity));
    const products = await tx.product.findMany({ where: { ...scope, id: { in: [...totals.keys()] } } });
    return products.filter((p) => p.type === 'PRODUCT' && p.trackInventory).map((product) => ({
      product,
      quantity: totals.get(product.id) ?? ZERO,
    }));
  }

  private assertStockAvailable(rows: { product: { currentStock: Prisma.Decimal; isActive: boolean }; quantity: Prisma.Decimal }[]) {
    for (const row of rows) {
      if (!row.product.isActive)
        throw new BadRequestException('Inactive inventory products cannot be invoiced');
      if (row.product.currentStock.minus(row.quantity).lt(0))
        throw new BadRequestException('Insufficient stock; negative stock is not allowed');
    }
  }

  private async applyStock(tx: Tx, scope: Scope, user: SafeUser, invoiceId: string, rows: { product: { id: string; currentStock: Prisma.Decimal; isActive: boolean }; quantity: Prisma.Decimal }[], direction: 'finalize' | 'cancel') {
    for (const row of rows) {
      if (!row.product.isActive && direction === 'finalize')
        throw new BadRequestException('Inactive inventory products cannot be invoiced');
      const after = direction === 'finalize' ? row.product.currentStock.minus(row.quantity) : row.product.currentStock.plus(row.quantity);
      if (after.lt(0)) throw new BadRequestException('Insufficient stock; negative stock is not allowed');
      const changed = await tx.product.updateMany({
        where: { ...scope, id: row.product.id, currentStock: row.product.currentStock },
        data: { currentStock: after },
      });
      if (changed.count !== 1) throw new ConflictException('Stock changed. Please retry.');
      await tx.stockMovement.create({
        data: {
          businessId: scope.businessId,
          productId: row.product.id,
          invoiceId,
          type: direction === 'finalize' ? 'INVOICE_FINALIZED' : 'INVOICE_CANCELLED',
          quantity: row.quantity,
          beforeStock: row.product.currentStock,
          afterStock: after,
          reason: direction === 'finalize' ? 'Invoice finalized' : 'Invoice cancellation restore',
          createdById: user.id,
        },
      });
    }
  }

  private previewView(invoice: Record<string, unknown>, lines: Record<string, unknown>[]) {
    return this.view({ ...invoice, id: null, invoiceNumber: null, sequenceNumber: null, lines, createdAt: null, updatedAt: null });
  }

  private view(row: Record<string, unknown> & { lines: Record<string, unknown>[] }) {
    const serialize = (v: unknown, scale = 2) => v instanceof D ? v.toFixed(scale) : v instanceof Date ? dateOnly(v) : v;
    const line = (l: Record<string, unknown>) => Object.fromEntries(Object.entries(l).map(([k, v]) => [k, k === 'quantity' ? serialize(v, 3) : serialize(v)]));
    return Object.fromEntries(Object.entries({
      ...row,
      lines: row.lines.map(line),
    }).map(([k, v]) => [k, serialize(v)]));
  }
}
