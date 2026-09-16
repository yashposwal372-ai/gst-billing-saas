import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import { Prisma } from '@gst/prisma-client/client';
import { defined, editable, listWhere, ownerScope, partyData, partyListSelect, rethrowParty, requireOwner, serialize } from '../../parties/party.data.js';
import type { SafeUser } from '../../users/user.select.js';
import type { PartyQuery } from '../../parties/party.dto.js';
import type { PartyActor, PartyListQuery, PartyListResult, SupplierCommand, SupplierDetail, SupplierListItem, SupplierProfile } from '../domain/party-types.js';
import type { SupplierRepositoryPort } from '../application/party-repository.port.js';

@Injectable()
export class PrismaSupplierRepository implements SupplierRepositoryPort {
  constructor(private readonly db: DatabaseService) {}

  private data(dto: SupplierCommand) {
    const bank = [dto.bankName, dto.accountHolderName, dto.accountNumber, dto.ifsc];
    if (bank.some(Boolean) && !bank.every(Boolean)) throw new BadRequestException('Complete all four bank fields or leave them empty');
    return { ...partyData(dto, 'PAYABLE'), bankName: dto.bankName || null, accountHolderName: dto.accountHolderName || null, accountNumber: dto.accountNumber || null, ifsc: dto.ifsc || null, upiId: dto.upiId || null };
  }

  async create(user: PartyActor, dto: SupplierCommand): Promise<SupplierProfile> {
    const data = this.data(dto);
    try {
      return await this.db.$transaction(async (tx) => {
        const scope = await requireOwner(tx, user as SafeUser);
        const sequence = await tx.business.update({ where: { id: scope.businessId }, data: { nextSupplierNumber: { increment: 1 } }, select: { nextSupplierNumber: true } });
        const row = await tx.supplier.create({ data: { ...data, businessId: scope.businessId, supplierCode: 'SUP-' + String(sequence.nextSupplierNumber).padStart(6, '0') } });
        return this.profile(row);
      });
    } catch (error) {
      rethrowParty(error);
    }
  }

  async list(user: PartyActor, query: PartyListQuery): Promise<PartyListResult<SupplierListItem>> {
    return this.db.$transaction(async (tx) => {
      const scope = await requireOwner(tx, user as SafeUser);
      const where: Prisma.SupplierWhereInput = { ...scope, ...listWhere(query as PartyQuery), ...(query.search ? { OR: ['supplierCode', 'displayName', 'businessName', 'phone', 'email', 'gstin'].map((field) => ({ [field]: { contains: query.search, mode: 'insensitive' } })) } : {}) };
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
    return { ...serialize(profile) } as SupplierProfile;
  }

  async detail(user: PartyActor, id: string): Promise<SupplierDetail> {
    const scope = ownerScope(user as SafeUser);
    const row = await this.db.supplier.findFirst({ where: { ...scope, id } });
    if (!row) throw new NotFoundException('Supplier not found');
    const [purchaseTotals, purchaseCount, paid] = await Promise.all([
      this.db.businessDocument.aggregate({ where: { ...scope, supplierId: id, documentType: 'PURCHASE_BILL', status: 'FINALIZED' }, _sum: { grandTotal: true } }),
      this.db.businessDocument.count({ where: { ...scope, supplierId: id, documentType: 'PURCHASE_BILL', status: 'FINALIZED' } }),
      this.db.paymentAllocation.aggregate({ where: { businessId: user.currentBusinessId!, document: { supplierId: id, documentType: 'PURCHASE_BILL', status: 'FINALIZED' }, payment: { status: 'POSTED', type: 'SUPPLIER_PAYMENT' } }, _sum: { amount: true } }),
    ]);
    const purchases = purchaseTotals._sum.grandTotal ?? new Prisma.Decimal(0);
    const paidAmount = paid._sum.amount ?? new Prisma.Decimal(0);
    return { profile: this.profile(row), summary: { totalPurchases: purchases.toFixed(2), amountPaid: paidAmount.toFixed(2), amountPayable: purchases.minus(paidAmount).toFixed(2), purchaseCount }, dataStatus: 'partial', ledgerEntries: [], activity: [] };
  }

  async update(user: PartyActor, id: string, dto: SupplierCommand): Promise<SupplierProfile> {
    try {
      return await this.db.$transaction(async (tx) => {
        const scope = await requireOwner(tx, user as SafeUser);
        const row = await tx.supplier.findFirst({ where: { ...scope, id } });
        if (!row) throw new NotFoundException('Supplier not found');
        const data = this.data({ ...editable(row), ...defined(dto) } as SupplierCommand);
        const result = await tx.supplier.updateMany({ where: { ...scope, id }, data });
        if (result.count !== 1) throw new NotFoundException('Supplier not found');
        return this.profile(await tx.supplier.findFirstOrThrow({ where: { ...scope, id } }));
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      rethrowParty(error);
    }
  }

  deactivate(user: PartyActor, id: string): Promise<SupplierProfile> {
    return this.update(user, id, { isActive: false });
  }
}
