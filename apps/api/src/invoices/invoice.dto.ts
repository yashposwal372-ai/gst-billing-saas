import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsIn,
  IsInt,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { MONEY, QUANTITY } from '../catalogue/catalogue.dto.js';

const optional = (_o: unknown, v: unknown) => v !== undefined;
const text = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
export const DATE = /^\d{4}-\d{2}-\d{2}$/;
export const GST_RATE = /^(0|[1-9]\d?)(\.\d{1,2})?$|^100(\.0{1,2})?$/;
export const STATE_CODE = /^(0[1-9]|[12][0-9]|3[0-8])$/;

export class InvoiceLineDto {
  @IsUUID()
  productId!: string;

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

export class InvoiceDraftDto {
  @ValidateIf(optional)
  @IsUUID()
  customerId?: string;

  @Transform(text)
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  placeOfSupplyState!: string;

  @Matches(STATE_CODE)
  placeOfSupplyStateCode!: string;

  @Matches(DATE)
  invoiceDate!: string;

  @ValidateIf((_o, v) => v !== undefined && v !== '')
  @Matches(DATE)
  dueDate?: string;

  @IsIn(['EXCLUSIVE', 'INCLUSIVE'])
  priceMode: 'EXCLUSIVE' | 'INCLUSIVE' = 'EXCLUSIVE';

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
  @Type(() => InvoiceLineDto)
  @ArrayMinSize(1)
  lines!: InvoiceLineDto[];
}

export class InvoiceQuery {
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
  @IsIn(['all', 'draft', 'finalized', 'cancelled'])
  status: 'all' | 'draft' | 'finalized' | 'cancelled' = 'all';
  @ValidateIf(optional)
  @Transform(text)
  @IsString()
  @MaxLength(100)
  search?: string;
  @ValidateIf(optional) @IsUUID() customerId?: string;
  @IsIn(['invoiceDate', 'invoiceNumber', 'createdAt', 'grandTotal'])
  sortBy: 'invoiceDate' | 'invoiceNumber' | 'createdAt' | 'grandTotal' =
    'invoiceDate';
  @IsIn(['asc', 'desc']) sortOrder: 'asc' | 'desc' = 'desc';
}

export class CancelInvoiceDto {
  @Transform(text)
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
