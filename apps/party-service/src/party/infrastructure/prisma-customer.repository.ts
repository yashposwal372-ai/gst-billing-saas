import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@gst/prisma-client/client';
import { DatabaseService } from '../../database/database.service.js';
import type { CustomerCommand, CustomerDetail, CustomerListItem, CustomerProfile, PartyListQuery, PartyListResult } from '@gst/party-contracts';
import type { CustomerRepositoryPort } from '../application/party-repository.port.js';
import { customerData, defined, editable, listWhere, partyListSelect, rethrowParty, scopeWhere, serialize, type PartyScope } from './party.data.js';

@Injectable()
export class PrismaCustomerRepository implements CustomerRepositoryPort {
  constructor(private readonly db: DatabaseService) {}

  async create(scope: PartyScope, dto: CustomerCommand): Promise<CustomerProfile> {
    const data = customerData(dto);
    try {
      return await this.db.$transaction(async (tx) => {
        const sequence = await tx.business.update({ where: { id: scope.businessId }, data: { nextCustomerNumber: { increment: 1 } }, select: { nextCustomerNumber: true } });
        const row = await tx.customer.create({ data: { ...data, businessId: scope.businessId, customerCode: 'CUS-' + String(sequence.nextCustomerNumber).padStart(6, '0') } });
        return this.profile(row);
      });
    } catch (error) { rethrowParty(error); }
  }

  async list(scope: PartyScope, query: PartyListQuery): Promise<PartyListResult<CustomerListItem>> {
    return this.db.$transaction(async (tx) => {
      const where: Prisma.CustomerWhereInput = { ...scopeWhere(scope), ...listWhere(query), ...(query.search ? { OR: ['customerCode', 'displayName', 'businessName', 'phone', 'email', 'gstin'].map((field) => ({ [field]: { contains: query.search, mode: 'insensitive' } })) } : {}) };
      const orderField = query.sortBy === 'code' ? 'customerCode' : query.sortBy;
      const [rows, total] = await Promise.all([
        tx.customer.findMany({ where, select: { ...partyListSelect, customerCode: true }, skip: (query.page - 1) * query.pageSize, take: query.pageSize, orderBy: [{ [orderField]: query.sortOrder }, { id: 'asc' }] }),
        tx.customer.count({ where }),
      ]);
      return { items: rows.map((row) => serialize(row) as CustomerListItem), page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  private profile(row: Prisma.CustomerGetPayload<object>): CustomerProfile {
    const { businessId: _businessId, ...profile } = row;
    return serialize(profile) as CustomerProfile;
  }

  async detail(scope: PartyScope, id: string): Promise<CustomerDetail> {
    const row = await this.db.customer.findFirst({ where: { ...scopeWhere(scope), id } });
    if (!row) throw new NotFoundException('Customer not found');
    const [summary, paid] = await Promise.all([
      this.db.invoice.aggregate({ where: { ...scopeWhere(scope), customerId: id, status: 'FINALIZED' }, _sum: { grandTotal: true }, _count: { id: true } }),
      this.db.paymentAllocation.aggregate({ where: { businessId: scope.businessId, invoice: { customerId: id, status: 'FINALIZED' }, payment: { status: 'POSTED', type: 'CUSTOMER_RECEIPT' } }, _sum: { amount: true } }),
    ]);
    const sales = summary._sum.grandTotal ?? new Prisma.Decimal(0);
    const paidAmount = paid._sum.amount ?? new Prisma.Decimal(0);
    return { profile: this.profile(row), summary: { totalSales: sales.toFixed(2), totalPaid: paidAmount.toFixed(2), outstanding: sales.minus(paidAmount).toFixed(2), invoiceCount: summary._count.id }, dataStatus: 'partial', ledgerEntries: [], activity: [] };
  }

  async update(scope: PartyScope, id: string, dto: CustomerCommand): Promise<CustomerProfile> {
    try {
      return await this.db.$transaction(async (tx) => {
        const row = await tx.customer.findFirst({ where: { ...scopeWhere(scope), id } });
        if (!row) throw new NotFoundException('Customer not found');
        const data = customerData({ ...editable(row), ...defined(dto) } as CustomerCommand);
        const result = await tx.customer.updateMany({ where: { ...scopeWhere(scope), id }, data });
        if (result.count !== 1) throw new NotFoundException('Customer not found');
        return this.profile(await tx.customer.findFirstOrThrow({ where: { ...scopeWhere(scope), id } }));
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) { rethrowParty(error); }
  }

  deactivate(scope: PartyScope, id: string): Promise<CustomerProfile> { return this.update(scope, id, { isActive: false }); }
}
