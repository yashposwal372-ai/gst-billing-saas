import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import type { SafeUser } from '../users/user.select.js';
import { CustomerDto } from './dto/customer.dto.js';
import type { PartyQuery } from '../parties/party.dto.js';
import type { PartyListQuery } from '../party/domain/party-types.js';
import { CustomerApplicationService } from '../party/application/customer-application.service.js';
import { PrismaCustomerRepository } from '../party/infrastructure/prisma-customer.repository.js';

@Injectable()
export class CustomersService {
  private readonly application: CustomerApplicationService;

  constructor(@Inject(CustomerApplicationService) customerBoundary: unknown) {
    this.application = customerBoundary instanceof CustomerApplicationService
      ? customerBoundary
      : new CustomerApplicationService(new PrismaCustomerRepository(customerBoundary as DatabaseService));
  }

  create(user: SafeUser, dto: CustomerDto) {
    return this.application.create(user, dto);
  }

  list(user: SafeUser, query: PartyQuery) {
    return this.application.list(user, query as PartyListQuery);
  }

  detail(user: SafeUser, id: string) {
    return this.application.detail(user, id);
  }

  update(user: SafeUser, id: string, dto: CustomerDto) {
    return this.application.update(user, id, dto);
  }

  deactivate(user: SafeUser, id: string) {
    return this.application.deactivate(user, id);
  }
}