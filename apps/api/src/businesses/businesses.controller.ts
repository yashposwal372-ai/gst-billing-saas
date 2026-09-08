import { Body, Controller, Get, Patch, Post, UseGuards, Header } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import { BrowserWriteGuard } from '../auth/guards/browser-write.guard.js';
import { CurrentAuth } from '../auth/decorators/current-auth.js';
import type { AuthContext } from '../users/user.select.js';
import { BusinessDto } from './dto/business.dto.js';
import { BusinessesService } from './businesses.service.js';

@Controller('businesses')
@UseGuards(BrowserWriteGuard, AuthGuard)
export class BusinessesController {
  constructor(private readonly businesses: BusinessesService) {}
  @Post()
  @Header('Cache-Control', 'no-store')
  async create(@CurrentAuth() auth: AuthContext, @Body() dto: BusinessDto) {
    return { business: await this.businesses.create(auth.user, dto) };
  }
  @Get('current')
  @Header('Cache-Control', 'no-store')
  async current(@CurrentAuth() auth: AuthContext) {
    return { business: await this.businesses.current(auth.user) };
  }
  @Patch('current')
  @Header('Cache-Control', 'no-store')
  async update(@CurrentAuth() auth: AuthContext, @Body() dto: BusinessDto) {
    return { business: await this.businesses.update(auth.user, dto) };
  }
}
