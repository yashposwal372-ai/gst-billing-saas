import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { $Enums, Prisma } from '@gst/prisma-client/client';
import type { SafeUser } from '../users/user.select.js';
import { ownerScope, requireOwner } from '../parties/party.data.js';
import { validatePartyState } from '../parties/party-address.js';
import { serializable } from '../catalogue/catalogue.data.js';
import { dateOnly, financialYear, InvoiceCalculator, money, parseDateOnly } from '../invoices/invoice-calculator.js';
import { InvoicesService } from '../invoices/invoices.service.js';
import type { InvoiceDraftDto } from '../invoices/invoice.dto.js';
import type { BusinessDocumentDraftDto, BusinessDocumentLineDto, BusinessDocumentQuery, CancelDocumentDto, DocumentType } from './business-document.dto.js';

const D = Prisma.Decimal;
const ZERO = new D(0);
const include = { lines: { orderBy: { lineNumber: 'asc' as const } } } as const;
const detailInclude = { lines: { orderBy: { lineNumber: 'asc' as const } }, paymentAllocations: { include: { payment: { include: { account: { select: { id: true, accountCode: true, name: true, type: true } } } } }, orderBy: { createdAt: 'asc' as const } } } as const;
type Tx = Prisma.TransactionClient;
type Scope = ReturnType<typeof ownerScope>;
type Party = 'customer' | 'supplier';

const meta: Record<DocumentType, { party: Party; prefix: string; issue: $Enums.BusinessDocumentStatus; stock?: 'IN' | 'OUT'; returnAgainst?: 'invoice' | 'purchase-bill'; noStock: boolean }> = {
  QUOTATION: { party: 'customer', prefix: 'QT', issue: 'ISSUED', noStock: true },
  SALES_ORDER: { party: 'customer', prefix: 'SO', issue: 'CONFIRMED', noStock: true },
  DELIVERY_CHALLAN: { party: 'customer', prefix: 'DC', issue: 'ISSUED', noStock: true },
  SALES_RETURN: { party: 'customer', prefix: 'SR', issue: 'FINALIZED', stock: 'IN', returnAgainst: 'invoice', noStock: false },
  PURCHASE_ORDER: { party: 'supplier', prefix: 'PO', issue: 'CONFIRMED', noStock: true },
  PURCHASE_BILL: { party: 'supplier', prefix: 'PB', issue: 'FINALIZED', stock: 'IN', noStock: false },
  PURCHASE_RETURN: { party: 'supplier', prefix: 'PR', issue: 'FINALIZED', stock: 'OUT', returnAgainst: 'purchase-bill', noStock: false },
};
const statusMap = { draft: 'DRAFT', issued: 'ISSUED', accepted: 'ACCEPTED', rejected: 'REJECTED', confirmed: 'CONFIRMED', finalized: 'FINALIZED', cancelled: 'CANCELLED' } as const;
const conversion: Record<string, DocumentType> = {
  'QUOTATION:sales-order': 'SALES_ORDER',
  'SALES_ORDER:delivery-challan': 'DELIVERY_CHALLAN',
  'PURCHASE_ORDER:purchase-bill': 'PURCHASE_BILL',
};

@Injectable()
export class BusinessDocumentsService {
  constructor(private readonly db: DatabaseService, private readonly calculator: InvoiceCalculator, private readonly invoices: InvoicesService) {}

  async preview(user: SafeUser, type: DocumentType, dto: BusinessDocumentDraftDto) {
    return this.db.$transaction(async (tx) => (await this.build(tx, await requireOwner(tx, user), type, dto)).preview, { isolationLevel: 'RepeatableRead' });
  }

  async create(user: SafeUser, type: DocumentType, dto: BusinessDocumentDraftDto) {
    return serializable(this.db, async (tx) => {
      const scope = await requireOwner(tx, user);
      const built = await this.build(tx, scope, type, dto);
      const row = await tx.businessDocument.create({ data: { ...built.data, businessId: scope.businessId, documentType: type, createdById: user.id, lines: { create: built.lines } }, include });
      return this.view(row);
    });
  }

  async update(user: SafeUser, type: DocumentType, id: string, dto: BusinessDocumentDraftDto) {
    return serializable(this.db, async (tx) => {
      const scope = await requireOwner(tx, user);
      const existing = await tx.businessDocument.findFirst({ where: { ...scope, id, documentType: type } });
      if (!existing) throw new NotFoundException('Document not found');
      if (existing.status !== 'DRAFT') throw new BadRequestException('Only draft documents can be edited');
      const built = await this.build(tx, scope, type, dto);
      await tx.businessDocumentLine.deleteMany({ where: { documentId: id, businessId: scope.businessId } });
      const row = await tx.businessDocument.update({ where: { id }, data: { ...built.data, lines: { create: built.lines } }, include });
      return this.view(row);
    });
  }

  async discard(user: SafeUser, type: DocumentType, id: string) {
    return serializable(this.db, async (tx) => {
      const scope = await requireOwner(tx, user);
      const existing = await tx.businessDocument.findFirst({ where: { ...scope, id, documentType: type } });
      if (!existing) throw new NotFoundException('Document not found');
      if (existing.status !== 'DRAFT') throw new BadRequestException('Only draft documents can be deleted');
      await tx.businessDocument.delete({ where: { id } });
      return { ok: true };
    });
  }

  async list(user: SafeUser, type: DocumentType, query: BusinessDocumentQuery) {
    return this.db.$transaction(async (tx) => {
      const scope = await requireOwner(tx, user);
      const where = {
        ...scope,
        documentType: type,
        ...(query.status === 'all' ? {} : { status: statusMap[query.status] }),
        ...(query.customerId ? { customerId: query.customerId } : {}),
        ...(query.supplierId ? { supplierId: query.supplierId } : {}),
        ...(query.financialYear ? { financialYear: query.financialYear } : {}),
        ...((query.from || query.to) ? { documentDate: { ...(query.from ? { gte: parseDateOnly(query.from) } : {}), ...(query.to ? { lte: parseDateOnly(query.to) } : {}) } } : {}),
        ...(query.search ? { OR: [ { documentNumber: { contains: query.search, mode: 'insensitive' as const } }, { partyNameSnapshot: { contains: query.search, mode: 'insensitive' as const } }, { supplierInvoiceNumber: { contains: query.search, mode: 'insensitive' as const } } ] } : {}),
      };
      const [items, total] = await Promise.all([
        tx.businessDocument.findMany({ where, orderBy: [{ [query.sortBy]: query.sortOrder }, { id: 'desc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
        tx.businessDocument.count({ where }),
      ]);
      return { items: items.map((row) => this.row(row)), total, page: query.page, pageSize: query.pageSize };
    }, { isolationLevel: 'RepeatableRead' });
  }

  async detail(user: SafeUser, type: DocumentType, id: string) {
    return this.db.$transaction(async (tx) => {
      const scope = await requireOwner(tx, user);
      const row = await tx.businessDocument.findFirst({ where: { ...scope, id, documentType: type }, include: detailInclude });
      if (!row) throw new NotFoundException('Document not found');
      return type === 'PURCHASE_BILL' ? this.viewWithSettlement(row as any) : this.view(row);
    }, { isolationLevel: 'RepeatableRead' });
  }

  async transition(user: SafeUser, type: DocumentType, id: string, target: string) {
    return serializable(this.db, async (tx) => {
      const scope = await requireOwner(tx, user);
      const row = await tx.businessDocument.findFirst({ where: { ...scope, id, documentType: type }, include });
      if (!row) throw new NotFoundException('Document not found');
      if (row.status !== 'DRAFT') throw new BadRequestException('Only draft documents can move to this state');
      const next = target as $Enums.BusinessDocumentStatus;
      if (!this.allowed(type, next)) throw new BadRequestException('Invalid document state action');
      if (next === 'FINALIZED') await this.validateReturnBounds(tx, scope, row);
      const number = await this.nextNumber(tx, scope, type, row.financialYear);
      const changed = await tx.businessDocument.updateMany({ where: { ...scope, id, documentType: type, status: 'DRAFT', documentNumber: null }, data: { status: next, documentNumber: number.documentNumber, sequenceNumber: number.sequenceNumber, actedAt: new Date(), actedById: user.id } });
      if (changed.count !== 1) throw new ConflictException('Document state changed. Please retry.');
      if (next === 'FINALIZED') await this.applyStock(tx, scope, user, row, false);
      const saved = await tx.businessDocument.findFirstOrThrow({ where: { ...scope, id }, include });
      return this.view(saved);
    });
  }

  async cancel(user: SafeUser, type: DocumentType, id: string, dto: CancelDocumentDto) {
    return serializable(this.db, async (tx) => {
      const scope = await requireOwner(tx, user);
      const row = await tx.businessDocument.findFirst({ where: { ...scope, id, documentType: type }, include });
      if (!row) throw new NotFoundException('Document not found');
      if (row.status === 'DRAFT') throw new BadRequestException('Delete drafts instead of cancelling them');
      if (row.status === 'CANCELLED') throw new ConflictException('Document was already cancelled');
      const changed = await tx.businessDocument.updateMany({ where: { ...scope, id, documentType: type, status: row.status, cancelledAt: null }, data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledById: user.id, cancellationReason: dto.reason } });
      if (changed.count !== 1) throw new ConflictException('Document state changed. Please retry.');
      if (['PURCHASE_BILL', 'SALES_RETURN', 'PURCHASE_RETURN'].includes(type)) await this.applyStock(tx, scope, user, row, true);
      const saved = await tx.businessDocument.findFirstOrThrow({ where: { ...scope, id }, include });
      return this.view(saved);
    });
  }

  async convert(user: SafeUser, type: DocumentType, id: string, target: string) {
    const next = conversion[type + ':' + target];
    if (!next) throw new BadRequestException('Invalid conversion');
    return serializable(this.db, async (tx) => {
      const scope = await requireOwner(tx, user);
      const source = await tx.businessDocument.findFirst({ where: { ...scope, id, documentType: type }, include });
      if (!source) throw new NotFoundException('Source document not found');
      if (source.status === 'DRAFT' || source.status === 'CANCELLED') throw new BadRequestException('Only issued or confirmed documents can be converted');
      const dto: BusinessDocumentDraftDto = {
        customerId: source.customerId ?? undefined,
        supplierId: source.supplierId ?? undefined,
        sourceDocumentId: source.id,
        placeOfSupplyState: source.placeOfSupplyState,
        placeOfSupplyStateCode: source.placeOfSupplyStateCode,
        documentDate: dateOnly(new Date()),
        priceMode: source.priceMode,
        notes: source.notes ?? undefined,
        terms: source.terms ?? undefined,
        lines: source.lines.map((line) => ({ productId: line.productId!, sourceDocumentLineId: line.id, quantity: line.quantity.toFixed(3), unitPrice: line.unitPrice.toFixed(2), discountType: line.discountType, discountValue: line.discountValue.toFixed(2) })),
      };
      const built = await this.build(tx, scope, next, dto);
      const row = await tx.businessDocument.create({ data: { ...built.data, businessId: scope.businessId, documentType: next, createdById: user.id, sourceDocumentId: source.id, lines: { create: built.lines } }, include });
      return this.view(row);
    });
  }

  async convertToInvoice(user: SafeUser, type: DocumentType, id: string) {
    if (!['QUOTATION', 'SALES_ORDER', 'DELIVERY_CHALLAN'].includes(type)) throw new BadRequestException('This document cannot be converted to an invoice');
    const dto = await this.db.$transaction(async (tx) => {
      const scope = await requireOwner(tx, user);
      const source = await tx.businessDocument.findFirst({ where: { ...scope, id, documentType: type }, include });
      if (!source) throw new NotFoundException('Source document not found');
      if (source.status === 'DRAFT' || source.status === 'CANCELLED') throw new BadRequestException('Only issued or confirmed documents can be converted to an invoice');
      if (!source.customerId) throw new BadRequestException('Source document has no customer');
      return {
        customerId: source.customerId,
        placeOfSupplyState: source.placeOfSupplyState,
        placeOfSupplyStateCode: source.placeOfSupplyStateCode,
        invoiceDate: dateOnly(new Date()),
        dueDate: source.dueDate ? dateOnly(source.dueDate) : undefined,
        priceMode: source.priceMode,
        notes: source.notes ?? undefined,
        terms: source.terms ?? undefined,
        lines: source.lines.map((line) => {
          if (!line.productId) throw new BadRequestException('Source line is missing product reference');
          return { productId: line.productId, quantity: line.quantity.toFixed(3), unitPrice: line.unitPrice.toFixed(2), discountType: line.discountType, discountValue: line.discountValue.toFixed(2) };
        }),
      } satisfies InvoiceDraftDto;
    }, { isolationLevel: 'RepeatableRead' });
    return this.invoices.create(user, dto);
  }
  private allowed(type: DocumentType, status: $Enums.BusinessDocumentStatus) {
    return ({ QUOTATION: ['ISSUED', 'ACCEPTED', 'REJECTED'], SALES_ORDER: ['CONFIRMED'], DELIVERY_CHALLAN: ['ISSUED'], SALES_RETURN: ['FINALIZED'], PURCHASE_ORDER: ['CONFIRMED'], PURCHASE_BILL: ['FINALIZED'], PURCHASE_RETURN: ['FINALIZED'] } satisfies Record<DocumentType, string[]>)[type].includes(status);
  }

  private async build(tx: Tx, scope: Scope, type: DocumentType, dto: BusinessDocumentDraftDto) {
    const cfg = meta[type];
    validatePartyState(dto.placeOfSupplyState, dto.placeOfSupplyStateCode);
    const business = await tx.business.findFirstOrThrow({ where: { id: scope.businessId } });
    const customer = cfg.party === 'customer' ? await tx.customer.findFirst({ where: { ...scope, id: dto.customerId } }) : null;
    const supplier = cfg.party === 'supplier' ? await tx.supplier.findFirst({ where: { ...scope, id: dto.supplierId } }) : null;
    const party = customer ?? supplier;
    if (!party) throw new BadRequestException(cfg.party === 'customer' ? 'Choose a customer for this document' : 'Choose a supplier for this document');
    if (!party.isActive) throw new BadRequestException('Choose an active party for this document');
    const intra = cfg.party === 'customer' ? business.stateCode === dto.placeOfSupplyStateCode : party.stateCode === dto.placeOfSupplyStateCode;
    const lines = await this.lineData(tx, scope, dto.lines, dto.priceMode ?? 'EXCLUSIVE', intra);
    const totals = this.totals(lines);
    const documentDate = parseDateOnly(dto.documentDate);
    if (type === 'SALES_RETURN' && !dto.sourceInvoiceId) throw new BadRequestException('Sales return requires a finalized invoice');
    if (type === 'PURCHASE_RETURN' && !dto.sourceDocumentId) throw new BadRequestException('Purchase return requires a finalized purchase bill');
    const data = {
      status: 'DRAFT' as const,
      financialYear: financialYear(documentDate),
      documentDate,
      dueDate: dto.dueDate ? parseDateOnly(dto.dueDate) : null,
      validUntil: dto.validUntil ? parseDateOnly(dto.validUntil) : null,
      partyKind: cfg.party,
      customerId: customer?.id ?? null,
      supplierId: supplier?.id ?? null,
      sourceInvoiceId: dto.sourceInvoiceId ?? null,
      sourceDocumentId: dto.sourceDocumentId ?? null,
      supplierInvoiceNumber: dto.supplierInvoiceNumber || null,
      placeOfSupplyState: dto.placeOfSupplyState,
      placeOfSupplyStateCode: dto.placeOfSupplyStateCode,
      gstApplicable: business.gstRegistered || party.gstRegistered,
      priceMode: dto.priceMode ?? 'EXCLUSIVE',
      reason: dto.reason || null,
      notes: dto.notes || null,
      terms: dto.terms || null,
      businessNameSnapshot: business.tradeName || business.name,
      businessGstinSnapshot: business.gstin,
      businessAddressLine1: business.addressLine1,
      businessCity: business.city,
      businessState: business.state,
      businessStateCode: business.stateCode,
      businessPincode: business.pincode,
      partyCodeSnapshot: 'customerCode' in party ? party.customerCode : party.supplierCode,
      partyNameSnapshot: party.displayName,
      partyBusinessName: party.businessName,
      partyGstinSnapshot: party.gstin,
      partyPanSnapshot: party.pan,
      partyPhoneSnapshot: party.phone,
      partyEmailSnapshot: party.email,
      partyAddressLine1: party.addressLine1,
      partyCity: party.city,
      partyState: party.state,
      partyStateCode: party.stateCode,
      partyPincode: party.pincode,
      ...totals,
      roundOff: ZERO,
    };
    return { data, lines, preview: this.view({ ...data, id: null, documentType: type, documentNumber: null, sequenceNumber: null, lines, createdAt: null, updatedAt: null }) };
  }

  private async lineData(tx: Tx, scope: Scope, lines: BusinessDocumentLineDto[], priceMode: 'EXCLUSIVE' | 'INCLUSIVE', intra: boolean) {
    const ids = [...new Set(lines.map((line) => line.productId))];
    const products = await tx.product.findMany({ where: { ...scope, id: { in: ids } } });
    const map = new Map(products.map((product) => [product.id, product]));
    return lines.map((line, index) => {
      const product = map.get(line.productId);
      if (!product || !product.isActive) throw new BadRequestException('Choose active products or services from this business');
      const quantity = new D(line.quantity);
      if (quantity.lte(0)) throw new BadRequestException('Line quantity must be greater than zero');
      const discountValue = new D(line.discountValue ?? '0');
      const gross = money(quantity.mul(line.unitPrice));
      if (line.discountType === 'PERCENT' && discountValue.gt(100)) throw new BadRequestException('Percentage discount cannot exceed 100');
      if (line.discountType === 'AMOUNT' && discountValue.gt(gross)) throw new BadRequestException('Amount discount cannot exceed line amount');
      return { lineNumber: index + 1, businessId: scope.businessId, productId: product.id, sourceInvoiceLineId: line.sourceInvoiceLineId ?? null, sourceDocumentLineId: line.sourceDocumentLineId ?? null, productCodeSnapshot: product.productCode, productNameSnapshot: product.name, productTypeSnapshot: product.type, hsnSacCodeSnapshot: product.hsnSacCode, unitSnapshot: product.unit, quantity, unitPrice: new D(line.unitPrice), priceMode, discountType: line.discountType, discountValue, gstRate: product.gstRate, ...this.calculator.line({ quantity, unitPrice: new D(line.unitPrice), gstRate: product.gstRate, priceMode, discountType: line.discountType, discountValue }, intra) };
    });
  }

  private totals(lines: { grossAmount: Prisma.Decimal; discountAmount: Prisma.Decimal; taxableAmount: Prisma.Decimal; cgstAmount: Prisma.Decimal; sgstAmount: Prisma.Decimal; igstAmount: Prisma.Decimal; taxAmount: Prisma.Decimal; lineTotal: Prisma.Decimal }[]) {
    return lines.reduce((sum, line) => ({ subtotal: money(sum.subtotal.plus(line.grossAmount)), discountTotal: money(sum.discountTotal.plus(line.discountAmount)), taxableTotal: money(sum.taxableTotal.plus(line.taxableAmount)), cgstTotal: money(sum.cgstTotal.plus(line.cgstAmount)), sgstTotal: money(sum.sgstTotal.plus(line.sgstAmount)), igstTotal: money(sum.igstTotal.plus(line.igstAmount)), taxTotal: money(sum.taxTotal.plus(line.taxAmount)), grandTotal: money(sum.grandTotal.plus(line.lineTotal)) }), { subtotal: ZERO, discountTotal: ZERO, taxableTotal: ZERO, cgstTotal: ZERO, sgstTotal: ZERO, igstTotal: ZERO, taxTotal: ZERO, grandTotal: ZERO });
  }

  private async nextNumber(tx: Tx, scope: Scope, type: DocumentType, fy: string) {
    const row = await tx.businessDocumentSequence.upsert({ where: { businessId_documentType_financialYear: { businessId: scope.businessId, documentType: type, financialYear: fy } }, create: { businessId: scope.businessId, documentType: type, financialYear: fy, nextNumber: 1 }, update: { nextNumber: { increment: 1 } }, select: { nextNumber: true } });
    return { sequenceNumber: row.nextNumber, documentNumber: `${meta[type].prefix}/${fy}/${String(row.nextNumber).padStart(6, '0')}` };
  }

  private async validateReturnBounds(tx: Tx, scope: Scope, row: { documentType: $Enums.BusinessDocumentType; sourceInvoiceId: string | null; sourceDocumentId: string | null; lines: { productId: string | null; quantity: Prisma.Decimal; sourceInvoiceLineId: string | null; sourceDocumentLineId: string | null }[] }) {
    if (row.documentType === 'SALES_RETURN') {
      const invoice = await tx.invoice.findFirst({ where: { ...scope, id: row.sourceInvoiceId ?? '', status: 'FINALIZED' }, include: { lines: true } });
      if (!invoice) throw new BadRequestException('Source finalized invoice not found');
      const previous = await tx.businessDocumentLine.findMany({ where: { businessId: scope.businessId, document: { documentType: 'SALES_RETURN', status: 'FINALIZED', sourceInvoiceId: invoice.id } } });
      this.ensureReturnable(row.lines, invoice.lines, previous);
    }
    if (row.documentType === 'PURCHASE_RETURN') {
      const bill = await tx.businessDocument.findFirst({ where: { ...scope, id: row.sourceDocumentId ?? '', documentType: 'PURCHASE_BILL', status: 'FINALIZED' }, include });
      if (!bill) throw new BadRequestException('Source finalized purchase bill not found');
      const previous = await tx.businessDocumentLine.findMany({ where: { businessId: scope.businessId, document: { documentType: 'PURCHASE_RETURN', status: 'FINALIZED', sourceDocumentId: bill.id } } });
      this.ensureReturnable(row.lines, bill.lines, previous);
    }
  }

  private ensureReturnable(lines: { productId: string | null; quantity: Prisma.Decimal; sourceInvoiceLineId?: string | null; sourceDocumentLineId?: string | null }[], source: { id: string; quantity: Prisma.Decimal; productId: string | null; productTypeSnapshot?: $Enums.ItemType }[], previous: { sourceInvoiceLineId: string | null; sourceDocumentLineId: string | null; quantity: Prisma.Decimal }[]) {
    const requested = new Map<string, Prisma.Decimal>();
    for (const line of lines) {
      const key = line.sourceInvoiceLineId ?? line.sourceDocumentLineId;
      if (!key) throw new BadRequestException('Returned line must reference the source line');
      const original = source.find((s) => s.id === key && s.productId === line.productId);
      if (!original) throw new BadRequestException('Returned line must match the source document');
      if (original.productTypeSnapshot === 'SERVICE') throw new BadRequestException('Service returns are not supported in Phase 7');
      requested.set(key, (requested.get(key) ?? ZERO).plus(line.quantity));
    }
    for (const [key, quantity] of requested) {
      const original = source.find((s) => s.id === key);
      const used = previous.filter((p) => (p.sourceInvoiceLineId ?? p.sourceDocumentLineId) === key).reduce((sum, p) => sum.plus(p.quantity), ZERO);
      if (!original || used.plus(quantity).gt(original.quantity)) throw new BadRequestException('Return quantity exceeds available source quantity');
    }
  }

  private async applyStock(tx: Tx, scope: Scope, user: SafeUser, row: { id: string; documentType: $Enums.BusinessDocumentType; lines: { productId: string | null; quantity: Prisma.Decimal; productTypeSnapshot: $Enums.ItemType }[] }, reverse: boolean) {
    const cfg = meta[row.documentType];
    if (!cfg.stock) return;
    const sign = (cfg.stock === 'IN') !== reverse ? 'IN' : 'OUT';
    const totals = new Map<string, Prisma.Decimal>();
    for (const line of row.lines) if (line.productId && line.productTypeSnapshot === 'PRODUCT') totals.set(line.productId, (totals.get(line.productId) ?? ZERO).plus(line.quantity));
    const products = await tx.product.findMany({ where: { ...scope, id: { in: [...totals.keys()] }, type: 'PRODUCT', trackInventory: true } });
    for (const product of products) {
      const qty = totals.get(product.id) ?? ZERO;
      const after = sign === 'IN' ? product.currentStock.plus(qty) : product.currentStock.minus(qty);
      if (after.lt(0)) throw new BadRequestException('Insufficient stock; negative stock is not allowed');
      const changed = await tx.product.updateMany({ where: { ...scope, id: product.id, currentStock: product.currentStock, type: 'PRODUCT', trackInventory: true }, data: { currentStock: after } });
      if (changed.count !== 1) throw new ConflictException('Stock changed. Please retry.');
      await tx.stockMovement.create({ data: { businessId: scope.businessId, productId: product.id, documentId: row.id, type: this.movementType(row.documentType, reverse), quantity: qty, beforeStock: product.currentStock, afterStock: after, reason: this.stockReason(row.documentType, reverse), createdById: user.id } });
    }
  }

  private movementType(type: $Enums.BusinessDocumentType, reverse: boolean) {
    if (type === 'PURCHASE_BILL') return reverse ? 'PURCHASE_BILL_CANCELLED' : 'PURCHASE_BILL_FINALIZED';
    if (type === 'SALES_RETURN') return reverse ? 'SALES_RETURN_CANCELLED' : 'SALES_RETURN_FINALIZED';
    return reverse ? 'PURCHASE_RETURN_CANCELLED' : 'PURCHASE_RETURN_FINALIZED';
  }

  private stockReason(type: $Enums.BusinessDocumentType, reverse: boolean) {
    return `${type.replaceAll('_', ' ').toLowerCase()} ${reverse ? 'cancelled' : 'finalized'}`;
  }

  private row(row: { id: string; documentType: $Enums.BusinessDocumentType; status: $Enums.BusinessDocumentStatus; documentNumber: string | null; documentDate: Date; financialYear: string; partyNameSnapshot: string; grandTotal: Prisma.Decimal; supplierInvoiceNumber: string | null }) {
    return { ...row, documentDate: dateOnly(row.documentDate), grandTotal: row.grandTotal.toFixed(2) };
  }

  private viewWithSettlement(row: Record<string, unknown> & { lines: Record<string, unknown>[]; paymentAllocations?: any[] }) {
    const base = this.view(row);
    const active = (row.paymentAllocations ?? []).filter((a) => a.payment?.type === 'SUPPLIER_PAYMENT');
    const posted = active.filter((a) => a.payment?.status === 'POSTED');
    const paid = posted.reduce((sum, a) => sum.plus(a.amount), ZERO);
    const grandTotal = row.grandTotal instanceof D ? row.grandTotal : new D(String(row.grandTotal ?? '0'));
    const outstanding = money(grandTotal.minus(paid));
    const paymentStatus = row.status !== 'FINALIZED' ? 'UNAVAILABLE' : paid.eq(0) ? 'UNPAID' : outstanding.gt(0) ? 'PARTIAL' : 'PAID';
    const paymentHistory = active.map((a) => ({ paymentId: a.payment?.id, paymentNumber: a.payment?.paymentNumber, paymentDate: a.payment?.paymentDate ? dateOnly(a.payment.paymentDate) : null, amount: a.amount.toFixed(2), method: a.payment?.method, status: a.payment?.status, account: a.payment?.account ? { id: a.payment.account.id, accountCode: a.payment.account.accountCode, name: a.payment.account.name, type: a.payment.account.type } : null }));
    return { ...base, settlement: { paymentStatus, paidAmount: paid.toFixed(2), outstanding: outstanding.toFixed(2), paymentHistory } };
  }

  private view(row: Record<string, unknown> & { lines: Record<string, unknown>[] }) {
    const serialize = (v: unknown, scale = 2) => v instanceof D ? v.toFixed(scale) : v instanceof Date ? dateOnly(v) : v;
    const line = (l: Record<string, unknown>) => Object.fromEntries(Object.entries(l).map(([k, v]) => [k, k === 'quantity' ? serialize(v, 3) : serialize(v)]));
    return Object.fromEntries(Object.entries({ ...row, lines: row.lines.map(line) }).map(([k, v]) => [k, serialize(v)]));
  }
}
