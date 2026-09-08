import {
  BadRequestException,
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
import {
  CategoryDto,
  CategoryQuery,
  CreateProductDto,
  ProductDto,
  ProductQuery,
  AdjustmentDto,
  MovementQuery,
} from './catalogue.dto.js';
import { CategoriesService } from './categories.service.js';
import { ProductsService } from './products.service.js';
import { InventoryService } from './inventory.service.js';
@Controller('categories')
@UseGuards(BrowserWriteGuard, AuthGuard)
export class CategoriesController {
  constructor(private readonly service: CategoriesService) {}
  @Post()
  @Header('Cache-Control', 'no-store')
  async create(@CurrentAuth() a: AuthContext, @Body() dto: CategoryDto) {
    return { profile: await this.service.create(a.user, dto) };
  }
  @Get()
  @Header('Cache-Control', 'no-store')
  list(@CurrentAuth() a: AuthContext, @Query() q: CategoryQuery) {
    return this.service.list(a.user, q);
  }
  @Get(':id')
  @Header('Cache-Control', 'no-store')
  async detail(
    @CurrentAuth() a: AuthContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return { profile: await this.service.detail(a.user, id) };
  }
  @Patch(':id')
  @Header('Cache-Control', 'no-store')
  async update(
    @CurrentAuth() a: AuthContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CategoryDto,
  ) {
    return { profile: await this.service.update(a.user, id, dto) };
  }
  @Delete(':id')
  @Header('Cache-Control', 'no-store')
  async deactivate(
    @CurrentAuth() a: AuthContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return {
      profile: await this.service.update(a.user, id, { isActive: false }),
    };
  }
}
@Controller('products')
@UseGuards(BrowserWriteGuard, AuthGuard)
export class ProductsController {
  constructor(
    private readonly service: ProductsService,
    private readonly inventory: InventoryService,
  ) {}
  @Post()
  @Header('Cache-Control', 'no-store')
  async create(@CurrentAuth() a: AuthContext, @Body() dto: CreateProductDto) {
    return { profile: await this.service.create(a.user, dto) };
  }
  @Get()
  @Header('Cache-Control', 'no-store')
  list(@CurrentAuth() a: AuthContext, @Query() q: ProductQuery) {
    return this.service.list(a.user, q);
  }
  @Get('by-barcode/:barcode')
  @Header('Cache-Control', 'no-store')
  async barcode(
    @CurrentAuth() a: AuthContext,
    @Param('barcode') barcode: string,
  ) {
    return { profile: await this.service.barcode(a.user, barcode) };
  }
  @Get(':id')
  @Header('Cache-Control', 'no-store')
  async detail(
    @CurrentAuth() a: AuthContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return { profile: await this.service.detail(a.user, id) };
  }
  @Patch(':id')
  @Header('Cache-Control', 'no-store')
  async update(
    @CurrentAuth() a: AuthContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ProductDto,
  ) {
    return { profile: await this.service.update(a.user, id, dto) };
  }
  @Delete(':id')
  @Header('Cache-Control', 'no-store')
  async deactivate(
    @CurrentAuth() a: AuthContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return {
      profile: await this.service.update(a.user, id, { isActive: false }),
    };
  }
  @Post(':id/stock-adjustments')
  @Header('Cache-Control', 'no-store')
  adjust(
    @CurrentAuth() a: AuthContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AdjustmentDto,
  ) {
    return this.inventory.adjust(a.user, id, dto);
  }
  @Get(':id/stock-movements')
  @Header('Cache-Control', 'no-store')
  history(
    @CurrentAuth() a: AuthContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() q: MovementQuery,
  ) {
    return this.inventory.history(a.user, id, q);
  }
}
@Controller('inventory')
@UseGuards(BrowserWriteGuard, AuthGuard)
export class InventoryController {
  constructor(private readonly service: InventoryService) {}
  @Get('summary')
  @Header('Cache-Control', 'no-store')
  summary(@CurrentAuth() a: AuthContext, @Query() q: Record<string, unknown>) {
    if (Object.keys(q).length)
      throw new BadRequestException('Unknown inventory query');
    return this.service.summary(a.user);
  }
}
