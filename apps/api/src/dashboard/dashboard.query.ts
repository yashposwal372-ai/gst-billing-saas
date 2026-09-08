import { BadRequestException } from '@nestjs/common';
import { IsIn, IsOptional, Matches } from 'class-validator';

export const dashboardPeriods = ['today', 'yesterday', 'last7', 'last30', 'thisMonth', 'lastMonth', 'financialYear', 'custom'] as const;
export class DashboardQuery {
  @IsIn(dashboardPeriods)
  period: (typeof dashboardPeriods)[number] = 'thisMonth';

  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/)
  start?: string;

  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/)
  end?: string;
}

export function dashboardFilter(query: DashboardQuery) {
  if (query.period !== 'custom') {
    if (query.start || query.end) throw new BadRequestException('Dates require a custom range');
    return { period: query.period, start: null, end: null, timezone: 'Asia/Kolkata' };
  }
  const validDate = (value: string | undefined) => {
    if (!value) return false;
    const date = new Date(value + 'T00:00:00Z');
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  };
  if (!validDate(query.start) || !validDate(query.end) || query.start! > query.end!)
    throw new BadRequestException('Choose a valid start and end date in order');
  return { period: query.period, start: query.start!, end: query.end!, timezone: 'Asia/Kolkata' };
}
