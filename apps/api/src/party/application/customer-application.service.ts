import type { CustomerCommand, PartyActor, PartyListQuery } from '../domain/party-types.js';
import type { CustomerRepositoryPort } from './party-repository.port.js';

export class CustomerApplicationService {
  constructor(private readonly customers: CustomerRepositoryPort) {}

  create(user: PartyActor, dto: CustomerCommand) {
    return this.customers.create(user, dto);
  }

  list(user: PartyActor, query: PartyListQuery) {
    return this.customers.list(user, query);
  }

  detail(user: PartyActor, id: string) {
    return this.customers.detail(user, id);
  }

  update(user: PartyActor, id: string, dto: CustomerCommand) {
    return this.customers.update(user, id, dto);
  }

  deactivate(user: PartyActor, id: string) {
    return this.customers.deactivate(user, id);
  }
}