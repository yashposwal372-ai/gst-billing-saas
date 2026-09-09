import { Transform, Type } from 'class-transformer';
import { ArrayMinSize, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateIf, ValidateNested } from 'class-validator';
import { MONEY, QUANTITY } from '../catalogue/catalogue.dto.js';
import { DATE, STATE_CODE } from '../invoices/invoice.dto.js';

const optional = (_o: unknown, v: unknown) => v !== undefined;
const text = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;

export type DocumentType = 'QUOTATION' | 'SALES_ORDER' | 'DELIVERY_CHALLAN' | 'SALES_RETURN' | 'PURCHASE_ORDER' | 'PURCHASE_BILL' | 'PURCHASE_RETURN';
export type DocumentStatus = 'DRAFT' | 'ISSUED' | 'ACCEPTED' | 'REJECTED' | 'CONFIRMED' | 'FINALIZED' | 'CANCELLED';

export class BusinessDocumentLineDto {
  @IsUUID()
  productId!: string;

  @ValidateIf(optional)
  @IsUUID()
  sourceInvoiceLineId?: string;

  @ValidateIf(optional)
  @IsUUID()
  sourceDocumentLineId?: string;

  @Matches(QUANTITY)
  quantity!: string;

  @Matches(MONEY)
  unitPrice!: string;

  @IsIn(['NONE', 'PERCENT', 'AMOUNT'])
  discountType: 'NONE' | 'PERCENT' | 'AMOUNT' = 'NONE';

  @ValidateIf(optional)
  @Matches(MONEY)
  discountValue?: string;
}

export class BusinessDocumentDraftDto {
  @ValidateIf(optional)
  @IsUUID()
  customerId?: string;

  @ValidateIf(optional)
  @IsUUID()
  supplierId?: string;

  @ValidateIf(optional)
  @IsUUID()
  sourceInvoiceId?: string;

  @ValidateIf(optional)
  @IsUUID()
  sourceDocumentId?: string;

  @ValidateIf(optional)
  @Transform(text)
  @IsString()
  @MaxLength(80)
  supplierInvoiceNumber?: string;

  @Transform(text)
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  placeOfSupplyState!: string;

  @Matches(STATE_CODE)
  placeOfSupplyStateCode!: string;

  @Matches(DATE)
  documentDate!: string;

  @ValidateIf((_o, v) => v !== undefined && v !== '')
  @Matches(DATE)
  dueDate?: string;

  @ValidateIf((_o, v) => v !== undefined && v !== '')
  @Matches(DATE)
  validUntil?: string;

  @IsIn(['EXCLUSIVE', 'INCLUSIVE'])
  priceMode: 'EXCLUSIVE' | 'INCLUSIVE' = 'EXCLUSIVE';

  @ValidateIf(optional)
  @Transform(text)
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ValidateIf(optional)
  @Transform(text)
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ValidateIf(optional)
  @Transform(text)
  @IsString()
  @MaxLength(2000)
  terms?: string;

  @ValidateNested({ each: true })
  @Type(() => BusinessDocumentLineDto)
  @ArrayMinSize(1)
  lines!: BusinessDocumentLineDto[];
}

export class BusinessDocumentQuery {
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
  @IsIn(['all', 'draft', 'issued', 'accepted', 'rejected', 'confirmed', 'finalized', 'cancelled'])
  status: 'all' | 'draft' | 'issued' | 'accepted' | 'rejected' | 'confirmed' | 'finalized' | 'cancelled' = 'all';
  @ValidateIf(optional) @Transform(text) @IsString() @MaxLength(100) search?: string;
  @ValidateIf(optional) @IsUUID() customerId?: string;
  @ValidateIf(optional) @IsUUID() supplierId?: string;
  @ValidateIf(optional) @Matches(DATE) from?: string;
  @ValidateIf(optional) @Matches(DATE) to?: string;
  @ValidateIf(optional) @Matches(/^\d{4}-\d{2}$/) financialYear?: string;
  @IsIn(['documentDate', 'documentNumber', 'createdAt', 'grandTotal']) sortBy: 'documentDate' | 'documentNumber' | 'createdAt' | 'grandTotal' = 'documentDate';
  @IsIn(['asc', 'desc']) sortOrder: 'asc' | 'desc' = 'desc';
}

export class CancelDocumentDto {
  @Transform(text)
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

export class ConvertDocumentDto {
  @IsOptional()
  @IsString()
  placeholder?: string;
}
