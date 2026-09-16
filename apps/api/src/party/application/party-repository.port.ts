import type { CustomerCommand, CustomerDetail, CustomerListItem, CustomerProfile, PartyActor, PartyListQuery, PartyListResult, SupplierCommand, SupplierDetail, SupplierListItem, SupplierProfile } from '../domain/party-types.js';

export const CUSTOMER_REPOSITORY = Symbol('CUSTOMER_REPOSITORY');
export const SUPPLIER_REPOSITORY = Symbol('SUPPLIER_REPOSITORY');

export interface CustomerRepositoryPort {
  create(user: PartyActor, dto: CustomerCommand): Promise<CustomerProfile>;
  list(user: PartyActor, query: PartyListQuery): Promise<PartyListResult<CustomerListItem>>;
  detail(user: PartyActor, id: string): Promise<CustomerDetail>;
  update(user: PartyActor, id: string, dto: CustomerCommand): Promise<CustomerProfile>;
  deactivate(user: PartyActor, id: string): Promise<CustomerProfile>;
}

export interface SupplierRepositoryPort {
  create(user: PartyActor, dto: SupplierCommand): Promise<SupplierProfile>;
  list(user: PartyActor, query: PartyListQuery): Promise<PartyListResult<SupplierListItem>>;
  detail(user: PartyActor, id: string): Promise<SupplierDetail>;
  update(user: PartyActor, id: string, dto: SupplierCommand): Promise<SupplierProfile>;
  deactivate(user: PartyActor, id: string): Promise<SupplierProfile>;
}