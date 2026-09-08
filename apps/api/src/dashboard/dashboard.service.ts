import { ForbiddenException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import type { SafeUser } from '../users/user.select.js';
import { dashboardFilter, type DashboardQuery } from './dashboard.query.js';

@Injectable()
export class DashboardService {
  constructor(private readonly db: DatabaseService) {}

  async summary(user: SafeUser, query: DashboardQuery) {
    const filter = dashboardFilter(query);
    let business: { id: string; name: string; role: 'OWNER'; onboardingCompleted: boolean } | null = null;
    let customers: number | null = null;
    let suppliers: number | null = null;
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
    }
    return {
      business, filter, dataStatus: 'not_available' as const,
      metrics: { todaySales: null, monthlySales: null, totalSales: null, totalPurchases: null,
        totalExpenses: null, totalGst: null, receivables: null, customers, suppliers,
        products: null, lowStock: null, overdueInvoices: null },
      recentActivity: [],
      charts: { sales: [], gst: [], invoiceStatus: [], paymentMethods: [], topProducts: [] },
    };
  }
}
