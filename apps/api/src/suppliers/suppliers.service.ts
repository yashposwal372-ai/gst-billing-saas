import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import type { SafeUser } from '../users/user.select.js';
import { SupplierDto } from './dto/supplier.dto.js';
import type { PartyQuery } from '../parties/party.dto.js';
import type { PartyListQuery } from '../party/domain/party-types.js';
import { SupplierApplicationService } from '../party/application/supplier-application.service.js';
import { PrismaSupplierRepository } from '../party/infrastructure/prisma-supplier.repository.js';

@Injectable()
export class SuppliersService {
  private readonly application: SupplierApplicationService;

  constructor(@Inject(SupplierApplicationService) supplierBoundary: unknown) {
    this.application = supplierBoundary instanceof SupplierApplicationService
      ? supplierBoundary
      : new SupplierApplicationService(new PrismaSupplierRepository(supplierBoundary as DatabaseService));
  }

  create(user: SafeUser, dto: SupplierDto) {
    return this.application.create(user, dto);
  }

  list(user: SafeUser, query: PartyQuery) {
    return this.application.list(user, query as PartyListQuery);
  }

  detail(user: SafeUser, id: string) {
    return this.application.detail(user, id);
  }

  update(user: SafeUser, id: string, dto: SupplierDto) {
    return this.application.update(user, id, dto);
  }

  deactivate(user: SafeUser, id: string) {
    return this.application.deactivate(user, id);
  }
}