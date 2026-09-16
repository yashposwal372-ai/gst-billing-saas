import type { CustomerCommand, PartyListQuery } from '@gst/party-contracts';
import type { PartyScope } from '../infrastructure/party.data.js';
import type { CustomerRepositoryPort } from './party-repository.port.js';

export class CustomerApplicationService {
  constructor(private readonly customers: CustomerRepositoryPort) {}
  create(scope: PartyScope, dto: CustomerCommand) { return this.customers.create(scope, dto); }
  list(scope: PartyScope, query: PartyListQuery) { return this.customers.list(scope, query); }
  detail(scope: PartyScope, id: string) { return this.customers.detail(scope, id); }
  update(scope: PartyScope, id: string, dto: CustomerCommand) { return this.customers.update(scope, id, dto); }
  deactivate(scope: PartyScope, id: string) { return this.customers.deactivate(scope, id); }
}
