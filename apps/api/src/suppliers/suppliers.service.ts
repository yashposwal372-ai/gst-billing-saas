import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { Prisma } from '../generated/prisma/client.js';
import type { SafeUser } from '../users/user.select.js';
import { SupplierDto } from './dto/supplier.dto.js';
import type { PartyQuery } from '../parties/party.dto.js';
import {
  defined,
  editable,
  listWhere,
  ownerScope,
  partyData,
  partyListSelect,
  rethrowParty,
  requireOwner,
  serialize,
} from '../parties/party.data.js';
@Injectable()
export class SuppliersService {
  constructor(private readonly db: DatabaseService) {}
  private data(dto: SupplierDto) {
    const bank = [
      dto.bankName,
      dto.accountHolderName,
      dto.accountNumber,
      dto.ifsc,
    ];
    if (bank.some(Boolean) && !bank.every(Boolean))
      throw new BadRequestException(
        'Complete all four bank fields or leave them empty',
      );
    return {
      ...partyData(dto, 'PAYABLE'),
      bankName: dto.bankName || null,
      accountHolderName: dto.accountHolderName || null,
      accountNumber: dto.accountNumber || null,
      ifsc: dto.ifsc || null,
      upiId: dto.upiId || null,
    };
  }
  async create(user: SafeUser, dto: SupplierDto) {
    const data = this.data(dto);
    try {
      return await this.db.$transaction(async (tx) => {
        const scope = await requireOwner(tx, user);
        // Atomic counter update locks this business row until commit. No count+1 races.
        const sequence = await tx.business.update({
          where: { id: scope.businessId },
          data: { nextSupplierNumber: { increment: 1 } },
          select: { nextSupplierNumber: true },
        });
        const row = await tx.supplier.create({
          data: {
            ...data,
            businessId: scope.businessId,
            supplierCode:
              'SUP-' + String(sequence.nextSupplierNumber).padStart(6, '0'),
          },
        });
        return this.profile(row);
      });
    } catch (error) {
      rethrowParty(error);
    }
  }
  async list(user: SafeUser, query: PartyQuery) {
    return this.db.$transaction(
      async (tx) => {
        const scope = await requireOwner(tx, user);
        const where: Prisma.SupplierWhereInput = {
          ...scope,
          ...listWhere(query),
          ...(query.search
            ? {
                OR: [
                  'supplierCode',
                  'displayName',
                  'businessName',
                  'phone',
                  'email',
                  'gstin',
                ].map((field) => ({
                  [field]: { contains: query.search, mode: 'insensitive' },
                })),
              }
            : {}),
        };
        const orderField =
          query.sortBy === 'code' ? 'supplierCode' : query.sortBy;
        const [rows, total] = await Promise.all([
          tx.supplier.findMany({
            where,
            select: { ...partyListSelect, supplierCode: true },
            skip: (query.page - 1) * query.pageSize,
            take: query.pageSize,
            orderBy: [{ [orderField]: query.sortOrder }, { id: 'asc' }],
          }),
          tx.supplier.count({ where }),
        ]);
        return {
          items: rows.map(serialize),
          page: query.page,
          pageSize: query.pageSize,
          total,
          totalPages: Math.ceil(total / query.pageSize),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  private profile(row: Prisma.SupplierGetPayload<object>) {
    const { businessId: _businessId, ...profile } = row;
    return { ...serialize(profile) };
  }
  async detail(user: SafeUser, id: string) {
    const scope = ownerScope(user);
    const row = await this.db.supplier.findFirst({
      where: { ...scope, id },
    });
    if (!row) throw new NotFoundException('Supplier not found');
    const [purchaseTotals, purchaseCount] = await Promise.all([
      this.db.businessDocument.aggregate({
        where: { ...scope, supplierId: id, documentType: 'PURCHASE_BILL', status: 'FINALIZED' },
        _sum: { grandTotal: true },
      }),
      this.db.businessDocument.count({
        where: { ...scope, supplierId: id, documentType: 'PURCHASE_BILL', status: 'FINALIZED' },
      }),
    ]);
    return {
      profile: this.profile(row),
      summary: {
        totalPurchases: (purchaseTotals._sum.grandTotal ?? new Prisma.Decimal(0)).toFixed(2),
        amountPaid: null,
        amountPayable: null,
        purchaseCount,
      },
      dataStatus: 'partial',
      ledgerEntries: [],
      activity: [],
    };
  }
  async update(user: SafeUser, id: string, dto: SupplierDto) {
    try {
      return await this.db.$transaction(
        async (tx) => {
          const scope = await requireOwner(tx, user);
          const row = await tx.supplier.findFirst({ where: { ...scope, id } });
          if (!row) throw new NotFoundException('Supplier not found');
          const data = this.data({
            ...editable(row),
            ...defined(dto),
          } as SupplierDto);
          const result = await tx.supplier.updateMany({
            where: { ...scope, id },
            data,
          });
          if (result.count !== 1)
            throw new NotFoundException('Supplier not found');
          return this.profile(
            await tx.supplier.findFirstOrThrow({ where: { ...scope, id } }),
          );
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      rethrowParty(error);
    }
  }
  async deactivate(user: SafeUser, id: string) {
    return this.update(user, id, { isActive: false });
  }
}
