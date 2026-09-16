import type { CustomerCommand, CustomerDetail, CustomerListItem, CustomerProfile, PartyListQuery, PartyListResult, SupplierCommand, SupplierDetail, SupplierListItem, SupplierProfile } from '@gst/party-contracts';
import type { PartyScope } from '../infrastructure/party.data.js';

export const CUSTOMER_REPOSITORY = Symbol('CUSTOMER_REPOSITORY');
export const SUPPLIER_REPOSITORY = Symbol('SUPPLIER_REPOSITORY');

export interface CustomerRepositoryPort {
  create(scope: PartyScope, dto: CustomerCommand): Promise<CustomerProfile>;
  list(scope: PartyScope, query: PartyListQuery): Promise<PartyListResult<CustomerListItem>>;
  detail(scope: PartyScope, id: string): Promise<CustomerDetail>;
  update(scope: PartyScope, id: string, dto: CustomerCommand): Promise<CustomerProfile>;
  deactivate(scope: PartyScope, id: string): Promise<CustomerProfile>;
}
export interface SupplierRepositoryPort {
  create(scope: PartyScope, dto: SupplierCommand): Promise<SupplierProfile>;
  list(scope: PartyScope, query: PartyListQuery): Promise<PartyListResult<SupplierListItem>>;
  detail(scope: PartyScope, id: string): Promise<SupplierDetail>;
  update(scope: PartyScope, id: string, dto: SupplierCommand): Promise<SupplierProfile>;
  deactivate(scope: PartyScope, id: string): Promise<SupplierProfile>;
}
