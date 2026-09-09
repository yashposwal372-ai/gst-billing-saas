import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { InvoiceCalculator } from './invoice-calculator.js';
import { InvoicesController } from './invoices.controller.js';
import { InvoicesService } from './invoices.service.js';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [InvoicesController],
  providers: [InvoiceCalculator, InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
