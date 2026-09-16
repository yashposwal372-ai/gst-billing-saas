export type PartyOpeningBalanceType = 'RECEIVABLE' | 'PAYABLE';
export type CustomerType = 'INDIVIDUAL' | 'BUSINESS';

export interface PartyListQuery {
  page: number;
  pageSize: number;
  search: string;
  status: 'all' | 'active' | 'inactive';
  gstRegistered: 'all' | 'true' | 'false';
  state: string;
  sortBy: 'displayName' | 'code' | 'createdAt' | 'updatedAt';
  sortOrder: 'asc' | 'desc';
}

export interface PartyCommand {
  displayName?: string;
  businessName?: string;
  contactPerson?: string;
  gstRegistered?: boolean;
  gstin?: string;
  pan?: string;
  phone?: string;
  whatsappNumber?: string;
  email?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  stateCode?: string;
  pincode?: string;
  openingBalance?: string;
  openingBalanceType?: PartyOpeningBalanceType;
  paymentTermsDays?: number;
  notes?: string;
  isActive?: boolean;
}

export interface CustomerCommand extends PartyCommand {
  customerType?: CustomerType;
  shippingSameAsBilling?: boolean;
  shippingAddressLine1?: string;
  shippingAddressLine2?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingStateCode?: string;
  shippingPincode?: string;
  creditLimit?: string;
}

export interface SupplierCommand extends PartyCommand {
  bankName?: string;
  accountHolderName?: string;
  accountNumber?: string;
  ifsc?: string;
  upiId?: string;
}

export interface PartyListResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PartyProfile {
  id: string;
  displayName: string;
  businessName: string | null;
  contactPerson: string | null;
  gstRegistered: boolean;
  gstin: string | null;
  pan: string | null;
  phone: string;
  whatsappNumber: string | null;
  email: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  stateCode: string;
  pincode: string;
  openingBalance: string;
  openingBalanceType: PartyOpeningBalanceType;
  paymentTermsDays: number;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type PartyListItem = Pick<PartyProfile, 'id' | 'displayName' | 'businessName' | 'phone' | 'email' | 'gstRegistered' | 'gstin' | 'state' | 'stateCode' | 'openingBalance' | 'openingBalanceType' | 'isActive' | 'createdAt' | 'updatedAt'>;

export interface CustomerListItem extends PartyListItem { customerCode: string }
export interface SupplierListItem extends PartyListItem { supplierCode: string }

export interface CustomerProfile extends PartyProfile {
  customerCode: string;
  customerType: CustomerType;
  shippingSameAsBilling: boolean;
  shippingAddressLine1: string | null;
  shippingAddressLine2: string | null;
  shippingCity: string | null;
  shippingState: string | null;
  shippingStateCode: string | null;
  shippingPincode: string | null;
  creditLimit: string | null;
}

export interface SupplierProfile extends PartyProfile {
  supplierCode: string;
  bankName: string | null;
  accountHolderName: string | null;
  accountNumber: string | null;
  ifsc: string | null;
  upiId: string | null;
}

export interface CustomerDetail {
  profile: CustomerProfile;
  summary: { totalSales: string; totalPaid: string; outstanding: string; invoiceCount: number };
  dataStatus: string;
  ledgerEntries: never[];
  activity: never[];
}

export interface SupplierDetail {
  profile: SupplierProfile;
  summary: { totalPurchases: string; amountPaid: string; amountPayable: string; purchaseCount: number };
  dataStatus: string;
  ledgerEntries: never[];
  activity: never[];
}

export type PartyErrorCode = 'PARTY_NOT_FOUND' | 'PARTY_CONFLICT' | 'PARTY_VALIDATION_ERROR' | 'INTERNAL_CONTEXT_INVALID' | 'PARTY_INTERNAL_ERROR';
export interface PartyErrorResponse { code: PartyErrorCode; message: string; statusCode: number }
export interface CustomerCreateResponse { profile: CustomerProfile }
export interface CustomerUpdateResponse { profile: CustomerProfile }
export interface SupplierCreateResponse { profile: SupplierProfile }
export interface SupplierUpdateResponse { profile: SupplierProfile }
