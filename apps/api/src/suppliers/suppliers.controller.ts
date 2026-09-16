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
import { AuthGuard } from '../auth/guards/auth.guard.js';
import { BrowserWriteGuard } from '../auth/guards/browser-write.guard.js';
import { CurrentAuth } from '../auth/decorators/current-auth.js';
import type { AuthContext } from '../users/user.select.js';
import { SupplierDto } from './dto/supplier.dto.js';
import { PartyQuery } from '../parties/party.dto.js';
import { SuppliersService } from './suppliers.service.js';
@Controller('suppliers')
@UseGuards(BrowserWriteGuard, AuthGuard)
export class SuppliersController {
  constructor(private readonly service: SuppliersService) {}
  @Post()
  @Header('Cache-Control', 'no-store')
  async create(@CurrentAuth() auth: AuthContext, @Body() dto: SupplierDto) {
    return { profile: await this.service.create(auth, dto) };
  }
  @Get()
  @Header('Cache-Control', 'no-store')
  list(@CurrentAuth() auth: AuthContext, @Query() query: PartyQuery) {
    return this.service.list(auth, query);
  }
  @Get(':id')
  @Header('Cache-Control', 'no-store')
  detail(
    @CurrentAuth() auth: AuthContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.detail(auth, id);
  }
  @Patch(':id')
  @Header('Cache-Control', 'no-store')
  async update(
    @CurrentAuth() auth: AuthContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SupplierDto,
  ) {
    return { profile: await this.service.update(auth, id, dto) };
  }
  @Delete(':id')
  @Header('Cache-Control', 'no-store')
  async deactivate(
    @CurrentAuth() auth: AuthContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return { profile: await this.service.deactivate(auth, id) };
  }
}
