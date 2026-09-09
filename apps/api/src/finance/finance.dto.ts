import { Transform, Type } from 'class-transformer';
import { ArrayMinSize, IsIn, IsInt, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateIf, ValidateNested } from 'class-validator';
import { MONEY } from '../catalogue/catalogue.dto.js';
import { DATE } from '../invoices/invoice.dto.js';

const optional = (_o: unknown, v: unknown) => v !== undefined;
const text = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;

export class MoneyAccountDto {
  @Transform(text) @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsIn(['CASH', 'BANK', 'UPI', 'OTHER']) type!: 'CASH' | 'BANK' | 'UPI' | 'OTHER';
  @ValidateIf(optional) @Transform(text) @IsString() @MaxLength(120) bankName?: string;
  @ValidateIf((_o, v) => v !== undefined && v !== '') @Matches(/^\d{4}$/) accountNumberLast4?: string;
  @ValidateIf((_o, v) => v !== undefined && v !== '') @Matches(/^[A-Z]{4}0[A-Z0-9]{6}$/) ifsc?: string;
  @ValidateIf(optional) @Transform(text) @IsString() @MaxLength(100) upiId?: string;
  @ValidateIf(optional) @Matches(MONEY) openingBalance?: string;
  @ValidateIf(optional) @IsIn([true, false]) isActive?: boolean;
}

export class AccountQuery { @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1; @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20; @IsIn(['all','active','inactive']) status: 'all'|'active'|'inactive' = 'active'; @ValidateIf(optional) @Transform(text) @IsString() @MaxLength(100) search?: string; @ValidateIf(optional) @IsIn(['CASH','BANK','UPI','OTHER']) type?: string; }
export class AccountEntryQuery { @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1; @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20; @ValidateIf(optional) @Matches(DATE) dateFrom?: string; @ValidateIf(optional) @Matches(DATE) dateTo?: string; @ValidateIf(optional) @IsString() @MaxLength(40) type?: string; @ValidateIf(optional) @IsIn(['CREDIT','DEBIT']) direction?: string; }

export class PaymentAllocationDto { @ValidateIf(optional) @IsUUID() invoiceId?: string; @ValidateIf(optional) @IsUUID() documentId?: string; @Matches(MONEY) amount!: string; }
export class PaymentDto {
  @IsIn(['CUSTOMER_RECEIPT','SUPPLIER_PAYMENT']) type!: 'CUSTOMER_RECEIPT'|'SUPPLIER_PAYMENT';
  @ValidateIf(optional) @IsUUID() customerId?: string;
  @ValidateIf(optional) @IsUUID() supplierId?: string;
  @IsUUID() accountId!: string;
  @Matches(DATE) paymentDate!: string;
  @IsIn(['CASH','BANK_TRANSFER','UPI','CARD','CHEQUE','OTHER']) method!: 'CASH'|'BANK_TRANSFER'|'UPI'|'CARD'|'CHEQUE'|'OTHER';
  @ValidateIf(optional) @Transform(text) @IsString() @MaxLength(120) referenceNumber?: string;
  @Matches(MONEY) amount!: string;
  @ValidateIf(optional) @Transform(text) @IsString() @MaxLength(2000) notes?: string;
  @ValidateNested({ each: true }) @Type(() => PaymentAllocationDto) @ArrayMinSize(1) allocations!: PaymentAllocationDto[];
}
export class PaymentQuery { @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1; @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20; @ValidateIf(optional) @Transform(text) @IsString() @MaxLength(100) search?: string; @ValidateIf(optional) @IsIn(['CUSTOMER_RECEIPT','SUPPLIER_PAYMENT']) type?: string; @ValidateIf(optional) @IsIn(['DRAFT','POSTED','REVERSED']) status?: string; @ValidateIf(optional) @IsIn(['CASH','BANK_TRANSFER','UPI','CARD','CHEQUE','OTHER']) method?: string; @ValidateIf(optional) @IsUUID() customerId?: string; @ValidateIf(optional) @IsUUID() supplierId?: string; @ValidateIf(optional) @IsUUID() accountId?: string; @ValidateIf(optional) @Matches(DATE) dateFrom?: string; @ValidateIf(optional) @Matches(DATE) dateTo?: string; @IsIn(['paymentDate','paymentNumber','createdAt','amount']) sortBy: 'paymentDate'|'paymentNumber'|'createdAt'|'amount' = 'paymentDate'; @IsIn(['asc','desc']) sortOrder: 'asc'|'desc' = 'desc'; }
export class ReasonDto { @Transform(text) @IsString() @MinLength(3) @MaxLength(500) reason!: string; }

export class ExpenseCategoryDto { @Transform(text) @IsString() @MinLength(2) @MaxLength(120) name!: string; @ValidateIf(optional) @Transform(text) @IsString() @MaxLength(1000) description?: string; @ValidateIf(optional) @IsIn([true, false]) isActive?: boolean; }
export class ExpenseDto { @IsUUID() categoryId!: string; @IsUUID() accountId!: string; @ValidateIf(optional) @IsUUID() supplierId?: string; @Matches(DATE) expenseDate!: string; @Transform(text) @IsString() @MinLength(3) @MaxLength(500) description!: string; @Matches(MONEY) amount!: string; @IsIn(['CASH','BANK_TRANSFER','UPI','CARD','CHEQUE','OTHER']) method!: 'CASH'|'BANK_TRANSFER'|'UPI'|'CARD'|'CHEQUE'|'OTHER'; @ValidateIf(optional) @Transform(text) @IsString() @MaxLength(120) referenceNumber?: string; @ValidateIf(optional) @Transform(text) @IsString() @MaxLength(2000) notes?: string; }
export class ExpenseQuery { @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1; @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20; @ValidateIf(optional) @Transform(text) @IsString() @MaxLength(100) search?: string; @ValidateIf(optional) @IsIn(['DRAFT','POSTED','CANCELLED']) status?: string; @ValidateIf(optional) @IsUUID() categoryId?: string; @ValidateIf(optional) @IsUUID() accountId?: string; @ValidateIf(optional) @IsUUID() supplierId?: string; @ValidateIf(optional) @Matches(DATE) dateFrom?: string; @ValidateIf(optional) @Matches(DATE) dateTo?: string; @IsIn(['expenseDate','expenseNumber','createdAt','amount']) sortBy: 'expenseDate'|'expenseNumber'|'createdAt'|'amount' = 'expenseDate'; @IsIn(['asc','desc']) sortOrder: 'asc'|'desc' = 'desc'; }

export class TransferDto { @IsUUID() fromAccountId!: string; @IsUUID() toAccountId!: string; @Matches(DATE) transferDate!: string; @Matches(MONEY) amount!: string; @ValidateIf(optional) @Transform(text) @IsString() @MaxLength(120) referenceNumber?: string; @ValidateIf(optional) @Transform(text) @IsString() @MaxLength(2000) notes?: string; }
export class ReceivableQuery { @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1; @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20; @ValidateIf(optional) @Transform(text) @IsString() @MaxLength(100) search?: string; @ValidateIf(optional) @IsUUID() customerId?: string; @ValidateIf(optional) @IsIn(['UNPAID','PARTIAL','PAID','OVERDUE']) status?: string; }
export class PayableQuery { @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1; @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20; @ValidateIf(optional) @Transform(text) @IsString() @MaxLength(100) search?: string; @ValidateIf(optional) @IsUUID() supplierId?: string; @ValidateIf(optional) @IsIn(['UNPAID','PARTIAL','PAID','OVERDUE']) status?: string; }
