import type { PartyListQuery, SupplierCommand } from '@gst/party-contracts';
import type { PartyScope } from '../infrastructure/party.data.js';
import type { SupplierRepositoryPort } from './party-repository.port.js';

export class SupplierApplicationService {
  constructor(private readonly suppliers: SupplierRepositoryPort) {}
  create(scope: PartyScope, dto: SupplierCommand) { return this.suppliers.create(scope, dto); }
  list(scope: PartyScope, query: PartyListQuery) { return this.suppliers.list(scope, query); }
  detail(scope: PartyScope, id: string) { return this.suppliers.detail(scope, id); }
  update(scope: PartyScope, id: string, dto: SupplierCommand) { return this.suppliers.update(scope, id, dto); }
  deactivate(scope: PartyScope, id: string) { return this.suppliers.deactivate(scope, id); }
}
