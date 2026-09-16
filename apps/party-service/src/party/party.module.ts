import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { CustomerApplicationService } from './application/customer-application.service.js';
import { SupplierApplicationService } from './application/supplier-application.service.js';
import { CUSTOMER_REPOSITORY, SUPPLIER_REPOSITORY, type CustomerRepositoryPort, type SupplierRepositoryPort } from './application/party-repository.port.js';
import { PrismaCustomerRepository } from './infrastructure/prisma-customer.repository.js';
import { PrismaSupplierRepository } from './infrastructure/prisma-supplier.repository.js';
import { InternalCustomersController, InternalSuppliersController } from './presentation/internal-party.controller.js';

@Module({
  imports: [DatabaseModule],
  controllers: [InternalCustomersController, InternalSuppliersController],
  providers: [
    PrismaCustomerRepository,
    PrismaSupplierRepository,
    { provide: CUSTOMER_REPOSITORY, useExisting: PrismaCustomerRepository },
    { provide: SUPPLIER_REPOSITORY, useExisting: PrismaSupplierRepository },
    { provide: CustomerApplicationService, useFactory: (repository: CustomerRepositoryPort) => new CustomerApplicationService(repository), inject: [CUSTOMER_REPOSITORY] },
    { provide: SupplierApplicationService, useFactory: (repository: SupplierRepositoryPort) => new SupplierApplicationService(repository), inject: [SUPPLIER_REPOSITORY] },
  ],
})
export class PartyModule {}
