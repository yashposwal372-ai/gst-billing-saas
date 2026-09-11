import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnvironment } from './config/environment.js';
import { DatabaseModule } from './database/database.module.js';
import { CacheModule } from './cache/cache.module.js';
import { QueueModule } from './queue/queue.module.js';
import { HealthModule } from './health/health.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { BusinessesModule } from './businesses/businesses.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { CustomersModule } from './customers/customers.module.js';
import { SuppliersModule } from './suppliers/suppliers.module.js';
import { CatalogueModule } from './catalogue/catalogue.module.js';
import { InvoicesModule } from './invoices/invoices.module.js';
import { BusinessDocumentsModule } from './business-documents/business-documents.module.js';
import { FinanceModule } from './finance/finance.module.js';
import { GstReportsModule } from './gst-reports/gst-reports.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    DatabaseModule,
    CacheModule,
    QueueModule,
    HealthModule,
    AuthModule,
    BusinessesModule,
    DashboardModule,
    CustomersModule,
    SuppliersModule,
    CatalogueModule,
    InvoicesModule,
    BusinessDocumentsModule,
    FinanceModule,
    GstReportsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
