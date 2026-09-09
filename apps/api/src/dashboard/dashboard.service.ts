import { ForbiddenException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import type { SafeUser } from '../users/user.select.js';
import { ownerScope } from '../parties/party.data.js';
import { dashboardFilter, type DashboardQuery } from './dashboard.query.js';
import { Prisma } from '../generated/prisma/client.js';

@Injectable()
export class DashboardService {
  constructor(private readonly db: DatabaseService) {}

  async summary(user: SafeUser, query: DashboardQuery) {
    const filter = dashboardFilter(query);
    let business: { id: string; name: string; role: 'OWNER'; onboardingCompleted: boolean } | null = null;
    let customers: number | null = null;
    let suppliers: number | null = null;
    let products: number | null = null;
    let lowStock: number | null = null;
    let todaySales: string | null = null;
    let monthlySales: string | null = null;
    let totalPurchases: string | null = null;
    if (user.currentBusinessId) {
      const membership = await this.db.businessMember.findUnique({
        where: { userId_businessId: { userId: user.id, businessId: user.currentBusinessId } },
        select: { role: true, business: { select: { id: true, name: true, onboardingCompletedAt: true,
          _count: { select: { customers: { where: { isActive: true } }, suppliers: { where: { isActive: true } } } } } } },
      });
      // Preserve Phase 2's owner-only business access policy.
      if (!membership || membership.role !== 'OWNER') throw new ForbiddenException('Business owner access required');
      business = { id: membership.business.id, name: membership.business.name, role: 'OWNER',
        onboardingCompleted: Boolean(membership.business.onboardingCompletedAt) };
      customers = membership.business._count.customers;
      suppliers = membership.business._count.suppliers;
      const scope = {...ownerScope(user), isActive:true, type:'PRODUCT' as const};
      [products,lowStock] = await Promise.all([
        this.db.product.count({where:scope}),
        this.db.product.count({where:{...scope,trackInventory:true,currentStock:{gt:0,lte:this.db.product.fields.minimumStock}}}),
      ]);
      const now = new Date();
      const day = now.toISOString().slice(0, 10);
      const monthStart = day.slice(0, 8) + '01';
      const salesWhere = {
        ...ownerScope(user),
        status: 'FINALIZED' as const,
      };
      const [today, month, purchases] = await Promise.all([
        this.db.invoice.aggregate({
          where: { ...salesWhere, invoiceDate: { gte: day, lte: day } },
          _sum: { grandTotal: true },
        }),
        this.db.invoice.aggregate({
          where: {
            ...salesWhere,
            invoiceDate: { gte: monthStart, lte: day },
          },
          _sum: { grandTotal: true },
        }),
        this.db.businessDocument.aggregate({
          where: { ...ownerScope(user), documentType: 'PURCHASE_BILL', status: 'FINALIZED', documentDate: { gte: monthStart, lte: day } },
          _sum: { grandTotal: true },
        }),
      ]);
      if (filter.start && filter.end) await this.db.invoice.aggregate({
        where: {
          ...salesWhere,
          invoiceDate: { gte: filter.start, lte: filter.end },
        },
        _sum: { grandTotal: true },
      });
      todaySales = (today._sum.grandTotal ?? new Prisma.Decimal(0)).toFixed(2);
      monthlySales = (month._sum.grandTotal ?? new Prisma.Decimal(0)).toFixed(2);
      totalPurchases = (purchases._sum.grandTotal ?? new Prisma.Decimal(0)).toFixed(2);
    }
    return {
      business, filter, dataStatus: 'not_available' as const,
      metrics: { todaySales, monthlySales, totalSales: null, totalPurchases,
        totalExpenses: null, totalGst: null, receivables: null, customers, suppliers,
        products, lowStock, overdueInvoices: null },
      recentActivity: [],
      charts: { sales: [], gst: [], invoiceStatus: [], paymentMethods: [], topProducts: [] },
    };
  }
}
