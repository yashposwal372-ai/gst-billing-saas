import { Body, Controller, Delete, Get, Header, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CustomerApplicationService } from '../application/customer-application.service.js';
import { SupplierApplicationService } from '../application/supplier-application.service.js';
import { CurrentInternalContext } from '../../security/current-internal-context.js';
import { InternalContextGuard, type PartyInternalContext } from '../../security/internal-context.guard.js';
import { CustomerDto } from './customer.dto.js';
import type { PartyListQuery } from '@gst/party-contracts';
import { SupplierDto } from './supplier.dto.js';
import { PartyQuery } from './party.dto.js';

function scope(context: PartyInternalContext) { return { userId: context.userId, businessId: context.businessId }; }

@Controller('internal/v1/party/customers')
@UseGuards(InternalContextGuard)
export class InternalCustomersController {
  constructor(private readonly service: CustomerApplicationService) {}
  @Post() @Header('Cache-Control', 'no-store') async create(@CurrentInternalContext() context: PartyInternalContext, @Body() dto: CustomerDto) { return { profile: await this.service.create(scope(context), dto) }; }
  @Get() @Header('Cache-Control', 'no-store') list(@CurrentInternalContext() context: PartyInternalContext, @Query() query: PartyQuery) { return this.service.list(scope(context), query as PartyListQuery); }
  @Get(':id') @Header('Cache-Control', 'no-store') detail(@CurrentInternalContext() context: PartyInternalContext, @Param('id', new ParseUUIDPipe()) id: string) { return this.service.detail(scope(context), id); }
  @Patch(':id') @Header('Cache-Control', 'no-store') async update(@CurrentInternalContext() context: PartyInternalContext, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: CustomerDto) { return { profile: await this.service.update(scope(context), id, dto) }; }
  @Delete(':id') @Header('Cache-Control', 'no-store') async deactivate(@CurrentInternalContext() context: PartyInternalContext, @Param('id', new ParseUUIDPipe()) id: string) { return { profile: await this.service.deactivate(scope(context), id) }; }
}

@Controller('internal/v1/party/suppliers')
@UseGuards(InternalContextGuard)
export class InternalSuppliersController {
  constructor(private readonly service: SupplierApplicationService) {}
  @Post() @Header('Cache-Control', 'no-store') async create(@CurrentInternalContext() context: PartyInternalContext, @Body() dto: SupplierDto) { return { profile: await this.service.create(scope(context), dto) }; }
  @Get() @Header('Cache-Control', 'no-store') list(@CurrentInternalContext() context: PartyInternalContext, @Query() query: PartyQuery) { return this.service.list(scope(context), query as PartyListQuery); }
  @Get(':id') @Header('Cache-Control', 'no-store') detail(@CurrentInternalContext() context: PartyInternalContext, @Param('id', new ParseUUIDPipe()) id: string) { return this.service.detail(scope(context), id); }
  @Patch(':id') @Header('Cache-Control', 'no-store') async update(@CurrentInternalContext() context: PartyInternalContext, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: SupplierDto) { return { profile: await this.service.update(scope(context), id, dto) }; }
  @Delete(':id') @Header('Cache-Control', 'no-store') async deactivate(@CurrentInternalContext() context: PartyInternalContext, @Param('id', new ParseUUIDPipe()) id: string) { return { profile: await this.service.deactivate(scope(context), id) }; }
}
