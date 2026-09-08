import { z } from "zod";
import { api } from "./api";

export const periods = [
  ["today", "Today"], ["yesterday", "Yesterday"], ["last7", "Last 7 days"],
  ["last30", "Last 30 days"], ["thisMonth", "This month"], ["lastMonth", "Last month"],
  ["financialYear", "This financial year"], ["custom", "Custom range"],
] as const;
export type DashboardFilter = { period: (typeof periods)[number][0]; start?: string; end?: string };
const unavailable = z.null();
const empty = z.array(z.never());
export const dashboardSchema = z.object({
  business: z.object({ id: z.string(), name: z.string(), role: z.literal("OWNER"), onboardingCompleted: z.boolean() }).nullable(),
  dataStatus: z.literal("not_available"),
  filter: z.object({ period: z.string(), start: z.string().nullable(), end: z.string().nullable(), timezone: z.literal("Asia/Kolkata") }),
  metrics: z.object({ todaySales: unavailable, monthlySales: unavailable, totalSales: unavailable,
    totalPurchases: unavailable, totalExpenses: unavailable, totalGst: unavailable, receivables: unavailable,
    customers: z.number().int().nonnegative().nullable(), suppliers: z.number().int().nonnegative().nullable(), products: z.number().int().nonnegative().nullable(), lowStock: z.number().int().nonnegative().nullable(), overdueInvoices: unavailable }),
  recentActivity: empty,
  charts: z.object({ sales: empty, gst: empty, invoiceStatus: empty, paymentMethods: empty, topProducts: empty }),
});
export type DashboardSummary = z.infer<typeof dashboardSchema>;
export async function getDashboardSummary(filter: DashboardFilter, signal?: AbortSignal): Promise<DashboardSummary> {
  const query = new URLSearchParams({ period: filter.period });
  if (filter.period === "custom") {
    if (filter.start) query.set("start", filter.start);
    if (filter.end) query.set("end", filter.end);
  }
  const timeout = AbortSignal.timeout(15000);
  return dashboardSchema.parse(await api("/dashboard/summary?" + query, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout }));
}
