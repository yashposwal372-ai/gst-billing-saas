import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@gst/prisma-client/client';
import { DatabaseService } from '../../database/database.service.js';
import type { PartyListQuery, PartyListResult, SupplierCommand, SupplierDetail, SupplierListItem, SupplierProfile } from '@gst/party-contracts';
import type { SupplierRepositoryPort } from '../application/party-repository.port.js';
import { defined, editable, listWhere, partyData, partyListSelect, rethrowParty, scopeWhere, serialize, type PartyScope } from './party.data.js';

@Injectable()
export class PrismaSupplierRepository implements SupplierRepositoryPort {
  constructor(private readonly db: DatabaseService) {}

  private data(dto: SupplierCommand) {
    const bank = [dto.bankName, dto.accountHolderName, dto.accountNumber, dto.ifsc];
    if (bank.some(Boolean) && !bank.every(Boolean)) throw new BadRequestException('Complete all four bank fields or leave them empty');
    return { ...partyData(dto, 'PAYABLE'), bankName: dto.bankName || null, accountHolderName: dto.accountHolderName || null, accountNumber: dto.accountNumber || null, ifsc: dto.ifsc || null, upiId: dto.upiId || null };
  }

  async create(scope: PartyScope, dto: SupplierCommand): Promise<SupplierProfile> {
    const data = this.data(dto);
    try {
      return await this.db.$transaction(async (tx) => {
        const sequence = await tx.business.update({ where: { id: scope.businessId }, data: { nextSupplierNumber: { increment: 1 } }, select: { nextSupplierNumber: true } });
        const row = await tx.supplier.create({ data: { ...data, businessId: scope.businessId, supplierCode: 'SUP-' + String(sequence.nextSupplierNumber).padStart(6, '0') } });
        return this.profile(row);
      });
    } catch (error) { rethrowParty(error); }
  }

  async list(scope: PartyScope, query: PartyListQuery): Promise<PartyListResult<SupplierListItem>> {
    return this.db.$transaction(async (tx) => {
      const where: Prisma.SupplierWhereInput = { ...scopeWhere(scope), ...listWhere(query), ...(query.search ? { OR: ['supplierCode', 'displayName', 'businessName', 'phone', 'email', 'gstin'].map((field) => ({ [field]: { contains: query.search, mode: 'insensitive' } })) } : {}) };
      const orderField = query.sortBy === 'code' ? 'supplierCode' : query.sortBy;
      const [rows, total] = await Promise.all([
        tx.supplier.findMany({ where, select: { ...partyListSelect, supplierCode: true }, skip: (query.page - 1) * query.pageSize, take: query.pageSize, orderBy: [{ [orderField]: query.sortOrder }, { id: 'asc' }] }),
        tx.supplier.count({ where }),
      ]);
      return { items: rows.map((row) => serialize(row) as SupplierListItem), page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  private profile(row: Prisma.SupplierGetPayload<object>): SupplierProfile {
    const { businessId: _businessId, ...profile } = row;
    return serialize(profile) as SupplierProfile;
  }

  async detail(scope: PartyScope, id: string): Promise<SupplierDetail> {
    const row = await this.db.supplier.findFirst({ where: { ...scopeWhere(scope), id } });
    if (!row) throw new NotFoundException('Supplier not found');
    const [purchaseTotals, purchaseCount, paid] = await Promise.all([
      this.db.businessDocument.aggregate({ where: { ...scopeWhere(scope), supplierId: id, documentType: 'PURCHASE_BILL', status: 'FINALIZED' }, _sum: { grandTotal: true } }),
      this.db.businessDocument.count({ where: { ...scopeWhere(scope), supplierId: id, documentType: 'PURCHASE_BILL', status: 'FINALIZED' } }),
      this.db.paymentAllocation.aggregate({ where: { businessId: scope.businessId, document: { supplierId: id, documentType: 'PURCHASE_BILL', status: 'FINALIZED' }, payment: { status: 'POSTED', type: 'SUPPLIER_PAYMENT' } }, _sum: { amount: true } }),
    ]);
    const purchases = purchaseTotals._sum.grandTotal ?? new Prisma.Decimal(0);
    const paidAmount = paid._sum.amount ?? new Prisma.Decimal(0);
    return { profile: this.profile(row), summary: { totalPurchases: purchases.toFixed(2), amountPaid: paidAmount.toFixed(2), amountPayable: purchases.minus(paidAmount).toFixed(2), purchaseCount }, dataStatus: 'partial', ledgerEntries: [], activity: [] };
  }

  async update(scope: PartyScope, id: string, dto: SupplierCommand): Promise<SupplierProfile> {
    try {
      return await this.db.$transaction(async (tx) => {
        const row = await tx.supplier.findFirst({ where: { ...scopeWhere(scope), id } });
        if (!row) throw new NotFoundException('Supplier not found');
        const data = this.data({ ...editable(row), ...defined(dto) } as SupplierCommand);
        const result = await tx.supplier.updateMany({ where: { ...scopeWhere(scope), id }, data });
        if (result.count !== 1) throw new NotFoundException('Supplier not found');
        return this.profile(await tx.supplier.findFirstOrThrow({ where: { ...scopeWhere(scope), id } }));
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) { rethrowParty(error); }
  }

  deactivate(scope: PartyScope, id: string): Promise<SupplierProfile> { return this.update(scope, id, { isActive: false }); }
}
