import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { InvoicesModule } from '../invoices/invoices.module.js';
import { FinanceModule } from '../finance/finance.module.js';
import { PosController } from './pos.controller.js';
import { PosService } from './pos.service.js';

@Module({ imports: [AuthModule, DatabaseModule, InvoicesModule, FinanceModule], controllers: [PosController], providers: [PosService] })
export class PosModule {}
