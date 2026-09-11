import { Body, Controller, Get, Header, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import { BrowserWriteGuard } from '../auth/guards/browser-write.guard.js';
import { CurrentAuth } from '../auth/decorators/current-auth.js';
import type { AuthContext } from '../users/user.select.js';
import { PosCheckoutDto, PosProductQuery, PosSalesQuery } from './pos.dto.js';
import { PosService } from './pos.service.js';

@Controller('pos')
@UseGuards(BrowserWriteGuard, AuthGuard)
export class PosController {
  constructor(private readonly pos: PosService) {}
  @Get('products') @Header('Cache-Control','no-store') products(@CurrentAuth() a: AuthContext, @Query() q: PosProductQuery) { return this.pos.products(a.user, q); }
  @Get('products/by-barcode/:barcode') @Header('Cache-Control','no-store') async barcode(@CurrentAuth() a: AuthContext, @Param('barcode') barcode: string) { return { profile: await this.pos.barcode(a.user, barcode) }; }
  @Post('preview') @Header('Cache-Control','no-store') preview(@CurrentAuth() a: AuthContext, @Body() dto: PosCheckoutDto) { return this.pos.preview(a.user, dto); }
  @Post('checkout') @Header('Cache-Control','no-store') checkout(@CurrentAuth() a: AuthContext, @Body() dto: PosCheckoutDto) { return this.pos.checkout(a.user, dto); }
  @Get('sales') @Header('Cache-Control','no-store') sales(@CurrentAuth() a: AuthContext, @Query() q: PosSalesQuery) { return this.pos.sales(a.user, q); }
}
