import { Controller, Get, Header, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import { CurrentAuth } from '../auth/decorators/current-auth.js';
import type { AuthContext } from '../users/user.select.js';
import { GstExportQuery, GstRegisterQuery, GstReportQuery } from './gst-reports.dto.js';
import { GstReportsService } from './gst-reports.service.js';
@UseGuards(AuthGuard)
@Controller('gst-reports')
export class GstReportsController {
  constructor(private readonly reports: GstReportsService) {}
  @Get('summary') @Header('Cache-Control','no-store') summary(@CurrentAuth() auth: AuthContext, @Query() q: GstReportQuery) { return this.reports.summary(auth.user,q); }
  @Get('sales-register') @Header('Cache-Control','no-store') sales(@CurrentAuth() auth: AuthContext, @Query() q: GstRegisterQuery) { return this.reports.salesRegister(auth.user,q); }
  @Get('purchase-register') @Header('Cache-Control','no-store') purchases(@CurrentAuth() auth: AuthContext, @Query() q: GstRegisterQuery) { return this.reports.purchaseRegister(auth.user,q); }
  @Get('output-tax') @Header('Cache-Control','no-store') output(@CurrentAuth() auth: AuthContext, @Query() q: GstReportQuery) { return this.reports.outputTax(auth.user,q); }
  @Get('purchase-tax') @Header('Cache-Control','no-store') purchaseTax(@CurrentAuth() auth: AuthContext, @Query() q: GstReportQuery) { return this.reports.purchaseTax(auth.user,q); }
  @Get('gst-rate-summary') @Header('Cache-Control','no-store') rates(@CurrentAuth() auth: AuthContext, @Query() q: GstReportQuery) { return this.reports.rateSummary(auth.user,q); }
  @Get('hsn-sac') @Header('Cache-Control','no-store') hsn(@CurrentAuth() auth: AuthContext, @Query() q: GstReportQuery) { return this.reports.hsnSac(auth.user,q); }
  @Get('place-of-supply') @Header('Cache-Control','no-store') pos(@CurrentAuth() auth: AuthContext, @Query() q: GstReportQuery) { return this.reports.placeOfSupply(auth.user,q); }
  @Get('returns-summary') @Header('Cache-Control','no-store') returns(@CurrentAuth() auth: AuthContext, @Query() q: GstReportQuery) { return this.reports.returnsSummary(auth.user,q); }
  @Get('sales-register/export') async salesCsv(@CurrentAuth() auth: AuthContext, @Query() q: GstExportQuery, @Res() res: Response) { res.setHeader('Content-Type','text/csv; charset=utf-8'); res.setHeader('Content-Disposition','attachment; filename="internal-sales-gst-register.csv"'); res.send(await this.reports.salesCsv(auth.user,q)); }
  @Get('purchase-register/export') async purchaseCsv(@CurrentAuth() auth: AuthContext, @Query() q: GstExportQuery, @Res() res: Response) { res.setHeader('Content-Type','text/csv; charset=utf-8'); res.setHeader('Content-Disposition','attachment; filename="internal-purchase-gst-register.csv"'); res.send(await this.reports.purchaseCsv(auth.user,q)); }
  @Get('hsn-sac/export') async hsnCsv(@CurrentAuth() auth: AuthContext, @Query() q: GstExportQuery, @Res() res: Response) { res.setHeader('Content-Type','text/csv; charset=utf-8'); res.setHeader('Content-Disposition','attachment; filename="internal-hsn-sac-summary.csv"'); res.send(await this.reports.hsnCsv(auth.user,q)); }
}

