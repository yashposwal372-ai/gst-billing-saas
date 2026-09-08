import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import { CurrentAuth } from '../auth/decorators/current-auth.js';
import type { AuthContext } from '../users/user.select.js';
import { DashboardQuery } from './dashboard.query.js';
import { DashboardService } from './dashboard.service.js';

@Controller('dashboard')
@UseGuards(AuthGuard)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}
  @Get('summary')
  @Header('Cache-Control', 'no-store')
  summary(@CurrentAuth() auth: AuthContext, @Query() query: DashboardQuery) {
    return this.dashboard.summary(auth.user, query);
  }
}
