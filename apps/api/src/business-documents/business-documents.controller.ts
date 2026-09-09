import { Body, Controller, Delete, Get, Header, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.js';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import { BrowserWriteGuard } from '../auth/guards/browser-write.guard.js';
import type { AuthContext } from '../users/user.select.js';
import { BusinessDocumentsService } from './business-documents.service.js';
import { BusinessDocumentDraftDto, BusinessDocumentQuery, CancelDocumentDto, type DocumentType } from './business-document.dto.js';

function controllerFor(path: string, type: DocumentType, actions: Record<string, string>) {
  @Controller(path)
  @UseGuards(BrowserWriteGuard, AuthGuard)
  class BusinessDocumentController {
    constructor(readonly documents: BusinessDocumentsService) {}
    @Post('preview') @Header('Cache-Control', 'no-store') preview(@CurrentAuth() auth: AuthContext, @Body() dto: BusinessDocumentDraftDto) { return this.documents.preview(auth.user, type, dto); }
    @Post() @Header('Cache-Control', 'no-store') async create(@CurrentAuth() auth: AuthContext, @Body() dto: BusinessDocumentDraftDto) { return { profile: await this.documents.create(auth.user, type, dto) }; }
    @Get() @Header('Cache-Control', 'no-store') list(@CurrentAuth() auth: AuthContext, @Query() query: BusinessDocumentQuery) { return this.documents.list(auth.user, type, query); }
    @Get(':id') @Header('Cache-Control', 'no-store') async detail(@CurrentAuth() auth: AuthContext, @Param('id', new ParseUUIDPipe()) id: string) { return { profile: await this.documents.detail(auth.user, type, id) }; }
    @Patch(':id') @Header('Cache-Control', 'no-store') async update(@CurrentAuth() auth: AuthContext, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: BusinessDocumentDraftDto) { return { profile: await this.documents.update(auth.user, type, id, dto) }; }
    @Delete(':id') @Header('Cache-Control', 'no-store') delete(@CurrentAuth() auth: AuthContext, @Param('id', new ParseUUIDPipe()) id: string) { return this.documents.discard(auth.user, type, id); }
    @Post(':id/issue') @Header('Cache-Control', 'no-store') async issue(@CurrentAuth() auth: AuthContext, @Param('id', new ParseUUIDPipe()) id: string) { return { profile: await this.documents.transition(auth.user, type, id, actions.issue ?? 'ISSUED') }; }
    @Post(':id/accept') @Header('Cache-Control', 'no-store') async accept(@CurrentAuth() auth: AuthContext, @Param('id', new ParseUUIDPipe()) id: string) { return { profile: await this.documents.transition(auth.user, type, id, actions.accept ?? 'ACCEPTED') }; }
    @Post(':id/confirm') @Header('Cache-Control', 'no-store') async confirm(@CurrentAuth() auth: AuthContext, @Param('id', new ParseUUIDPipe()) id: string) { return { profile: await this.documents.transition(auth.user, type, id, actions.confirm ?? 'CONFIRMED') }; }
    @Post(':id/finalize') @Header('Cache-Control', 'no-store') async finalize(@CurrentAuth() auth: AuthContext, @Param('id', new ParseUUIDPipe()) id: string) { return { profile: await this.documents.transition(auth.user, type, id, 'FINALIZED') }; }
    @Post(':id/cancel') @Header('Cache-Control', 'no-store') async cancel(@CurrentAuth() auth: AuthContext, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: CancelDocumentDto) { return { profile: await this.documents.cancel(auth.user, type, id, dto) }; }
    @Post(':id/convert/:target') @Header('Cache-Control', 'no-store') async convert(@CurrentAuth() auth: AuthContext, @Param('id', new ParseUUIDPipe()) id: string, @Param('target') target: string) { return { profile: await this.documents.convert(auth.user, type, id, target) }; }
    @Post(':id/convert-to-invoice') @Header('Cache-Control', 'no-store') async convertToInvoice(@CurrentAuth() auth: AuthContext, @Param('id', new ParseUUIDPipe()) id: string) { return { profile: await this.documents.convertToInvoice(auth.user, type, id) }; }
  }
  return BusinessDocumentController;
}

export const QuotationsController = controllerFor('quotations', 'QUOTATION', { issue: 'ISSUED', accept: 'ACCEPTED' });
export const SalesOrdersController = controllerFor('sales-orders', 'SALES_ORDER', { confirm: 'CONFIRMED' });
export const DeliveryChallansController = controllerFor('delivery-challans', 'DELIVERY_CHALLAN', { issue: 'ISSUED' });
export const SalesReturnsController = controllerFor('sales-returns', 'SALES_RETURN', {});
export const PurchaseOrdersController = controllerFor('purchase-orders', 'PURCHASE_ORDER', { confirm: 'CONFIRMED' });
export const PurchaseBillsController = controllerFor('purchase-bills', 'PURCHASE_BILL', {});
export const PurchaseReturnsController = controllerFor('purchase-returns', 'PURCHASE_RETURN', {});

