import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { Prisma } from '../generated/prisma/client.js';
import type { SafeUser } from '../users/user.select.js';
import { CustomerDto } from './dto/customer.dto.js';
import type { PartyQuery } from '../parties/party.dto.js';
import { validatePartyState } from '../parties/party-address.js';
import {
  defined,
  editable,
  listWhere,
  ownerScope,
  partyData,
  partyListSelect,
  rethrowParty,
  required,
  requireOwner,
  serialize,
} from '../parties/party.data.js';
@Injectable()
export class CustomersService {
  constructor(private readonly db: DatabaseService) {}
  private data(dto: CustomerDto) {
    const shipping = dto.shippingSameAsBilling ?? true;
    if (!shipping)
      validatePartyState(
        required(dto.shippingState, 'shippingState'),
        required(dto.shippingStateCode, 'shippingStateCode'),
      );
    return {
      ...partyData(dto, 'RECEIVABLE'),
      customerType: dto.customerType ?? ('INDIVIDUAL' as const),
      shippingSameAsBilling: dto.shippingSameAsBilling ?? true,
      shippingAddressLine1: shipping
        ? null
        : required(dto.shippingAddressLine1, 'shippingAddressLine1'),
      shippingAddressLine2: shipping ? null : dto.shippingAddressLine2 || null,
      shippingCity: shipping
        ? null
        : required(dto.shippingCity, 'shippingCity'),
      shippingState: shipping
        ? null
        : required(dto.shippingState, 'shippingState'),
      shippingStateCode: shipping
        ? null
        : required(dto.shippingStateCode, 'shippingStateCode'),
      shippingPincode: shipping
        ? null
        : required(dto.shippingPincode, 'shippingPincode'),
      creditLimit: dto.creditLimit ? new Prisma.Decimal(dto.creditLimit) : null,
    };
  }
  async create(user: SafeUser, dto: CustomerDto) {
    const data = this.data(dto);
    try {
      return await this.db.$transaction(async (tx) => {
        const scope = await requireOwner(tx, user);
        // Atomic counter update locks this business row until commit. No count+1 races.
        const sequence = await tx.business.update({
          where: { id: scope.businessId },
          data: { nextCustomerNumber: { increment: 1 } },
          select: { nextCustomerNumber: true },
        });
        const row = await tx.customer.create({
          data: {
            ...data,
            businessId: scope.businessId,
            customerCode:
              'CUS-' + String(sequence.nextCustomerNumber).padStart(6, '0'),
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
        const where: Prisma.CustomerWhereInput = {
          ...scope,
          ...listWhere(query),
          ...(query.search
            ? {
                OR: [
                  'customerCode',
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
          query.sortBy === 'code' ? 'customerCode' : query.sortBy;
        const [rows, total] = await Promise.all([
          tx.customer.findMany({
            where,
            select: { ...partyListSelect, customerCode: true },
            skip: (query.page - 1) * query.pageSize,
            take: query.pageSize,
            orderBy: [{ [orderField]: query.sortOrder }, { id: 'asc' }],
          }),
          tx.customer.count({ where }),
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
  private profile(row: Prisma.CustomerGetPayload<object>) {
    const { businessId: _businessId, ...profile } = row;
    return {
      ...serialize(profile),
      creditLimit: row.creditLimit?.toFixed(2) ?? null,
    };
  }
  async detail(user: SafeUser, id: string) {
    const row = await this.db.customer.findFirst({
      where: { ...ownerScope(user), id },
    });
    if (!row) throw new NotFoundException('Customer not found');
    const [summary, paid] = await Promise.all([
      this.db.invoice.aggregate({
        where: { ...ownerScope(user), customerId: id, status: 'FINALIZED' },
        _sum: { grandTotal: true },
        _count: { id: true },
      }),
      this.db.paymentAllocation.aggregate({
        where: { businessId: user.currentBusinessId!, invoice: { customerId: id, status: 'FINALIZED' }, payment: { status: 'POSTED', type: 'CUSTOMER_RECEIPT' } },
        _sum: { amount: true },
      }),
    ]);
    const sales = summary._sum.grandTotal ?? new Prisma.Decimal(0);
    const paidAmount = paid._sum.amount ?? new Prisma.Decimal(0);
    return {
      profile: this.profile(row),
      summary: {
        totalSales: sales.toFixed(2),
        totalPaid: paidAmount.toFixed(2),
        outstanding: sales.minus(paidAmount).toFixed(2),
        invoiceCount: summary._count.id,
      },
      dataStatus: 'partial',
      ledgerEntries: [],
      activity: [],
    };
  }
  async update(user: SafeUser, id: string, dto: CustomerDto) {
    try {
      return await this.db.$transaction(
        async (tx) => {
          const scope = await requireOwner(tx, user);
          const row = await tx.customer.findFirst({ where: { ...scope, id } });
          if (!row) throw new NotFoundException('Customer not found');
          const data = this.data({
            ...editable(row),
            ...defined(dto),
          } as CustomerDto);
          const result = await tx.customer.updateMany({
            where: { ...scope, id },
            data,
          });
          if (result.count !== 1)
            throw new NotFoundException('Customer not found');
          return this.profile(
            await tx.customer.findFirstOrThrow({ where: { ...scope, id } }),
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
