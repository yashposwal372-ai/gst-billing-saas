import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.js';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import { BrowserWriteGuard } from '../auth/guards/browser-write.guard.js';
import type { AuthContext } from '../users/user.select.js';
import { CancelInvoiceDto, InvoiceDraftDto, InvoiceQuery } from './invoice.dto.js';
import { InvoicesService } from './invoices.service.js';

@Controller('invoices')
@UseGuards(BrowserWriteGuard, AuthGuard)
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Post('preview')
  @Header('Cache-Control', 'no-store')
  preview(@CurrentAuth() auth: AuthContext, @Body() dto: InvoiceDraftDto) {
    return this.invoices.preview(auth.user, dto);
  }

  @Post()
  @Header('Cache-Control', 'no-store')
  async create(@CurrentAuth() auth: AuthContext, @Body() dto: InvoiceDraftDto) {
    return { profile: await this.invoices.create(auth.user, dto) };
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  list(@CurrentAuth() auth: AuthContext, @Query() query: InvoiceQuery) {
    return this.invoices.list(auth.user, query);
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  async detail(@CurrentAuth() auth: AuthContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return { profile: await this.invoices.detail(auth.user, id) };
  }

  @Patch(':id')
  @Header('Cache-Control', 'no-store')
  async update(@CurrentAuth() auth: AuthContext, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: InvoiceDraftDto) {
    return { profile: await this.invoices.update(auth.user, id, dto) };
  }

  @Delete(':id')
  @Header('Cache-Control', 'no-store')
  discard(@CurrentAuth() auth: AuthContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.invoices.discard(auth.user, id);
  }

  @Post(':id/finalize')
  @Header('Cache-Control', 'no-store')
  async finalize(@CurrentAuth() auth: AuthContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return { profile: await this.invoices.finalize(auth.user, id) };
  }

  @Post(':id/cancel')
  @Header('Cache-Control', 'no-store')
  async cancel(@CurrentAuth() auth: AuthContext, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: CancelInvoiceDto) {
    return { profile: await this.invoices.cancel(auth.user, id, dto) };
  }
}
