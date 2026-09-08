import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import {
  CategoriesController,
  ProductsController,
  InventoryController,
} from './catalogue.controller.js';
import { CategoriesService } from './categories.service.js';
import { ProductsService } from './products.service.js';
import { InventoryService } from './inventory.service.js';
@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [CategoriesController, ProductsController, InventoryController],
  providers: [CategoriesService, ProductsService, InventoryService],
  exports: [InventoryService],
})
export class CatalogueModule {}
