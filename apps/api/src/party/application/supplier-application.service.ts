import type { PartyActor, PartyListQuery, SupplierCommand } from '../domain/party-types.js';
import type { SupplierRepositoryPort } from './party-repository.port.js';

export class SupplierApplicationService {
  constructor(private readonly suppliers: SupplierRepositoryPort) {}

  create(user: PartyActor, dto: SupplierCommand) {
    return this.suppliers.create(user, dto);
  }

  list(user: PartyActor, query: PartyListQuery) {
    return this.suppliers.list(user, query);
  }

  detail(user: PartyActor, id: string) {
    return this.suppliers.detail(user, id);
  }

  update(user: PartyActor, id: string, dto: SupplierCommand) {
    return this.suppliers.update(user, id, dto);
  }

  deactivate(user: PartyActor, id: string) {
    return this.suppliers.deactivate(user, id);
  }
}