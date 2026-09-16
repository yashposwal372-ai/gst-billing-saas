import type { CustomerCommand, CustomerDetail, CustomerListItem, CustomerProfile, PartyListQuery, PartyListResult, SupplierCommand, SupplierDetail, SupplierListItem, SupplierProfile } from '@gst/party-contracts';
import type { AuthContext } from '../../users/user.select.js';

export const PARTY_CLIENT = Symbol('PARTY_CLIENT');

export interface PartyClientPort {
  createCustomer(auth: AuthContext, dto: CustomerCommand): Promise<CustomerProfile>;
  listCustomers(auth: AuthContext, query: PartyListQuery): Promise<PartyListResult<CustomerListItem>>;
  getCustomer(auth: AuthContext, id: string): Promise<CustomerDetail>;
  updateCustomer(auth: AuthContext, id: string, dto: CustomerCommand): Promise<CustomerProfile>;
  deactivateCustomer(auth: AuthContext, id: string): Promise<CustomerProfile>;
  createSupplier(auth: AuthContext, dto: SupplierCommand): Promise<SupplierProfile>;
  listSuppliers(auth: AuthContext, query: PartyListQuery): Promise<PartyListResult<SupplierListItem>>;
  getSupplier(auth: AuthContext, id: string): Promise<SupplierDetail>;
  updateSupplier(auth: AuthContext, id: string, dto: SupplierCommand): Promise<SupplierProfile>;
  deactivateSupplier(auth: AuthContext, id: string): Promise<SupplierProfile>;
}
