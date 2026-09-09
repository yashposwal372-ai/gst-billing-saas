import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { InvoiceCalculator } from '../invoices/invoice-calculator.js';
import { InvoicesModule } from '../invoices/invoices.module.js';
import { BusinessDocumentsService } from './business-documents.service.js';
import { DeliveryChallansController, PurchaseBillsController, PurchaseOrdersController, PurchaseReturnsController, QuotationsController, SalesOrdersController, SalesReturnsController } from './business-documents.controller.js';

@Module({
  imports: [AuthModule, DatabaseModule, InvoicesModule],
  controllers: [QuotationsController, SalesOrdersController, DeliveryChallansController, SalesReturnsController, PurchaseOrdersController, PurchaseBillsController, PurchaseReturnsController],
  providers: [BusinessDocumentsService, InvoiceCalculator],
})
export class BusinessDocumentsModule {}
