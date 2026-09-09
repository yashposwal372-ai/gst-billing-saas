import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  IsUUID,
} from 'class-validator';
const optional = (_o: unknown, v: unknown) => v !== undefined;
const text = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
export const MONEY = /^(0|[1-9]\d{0,12})(\.\d{1,2})?$/;
export const QUANTITY = /^(0|[1-9]\d{0,14})(\.\d{1,3})?$/;
export const UNITS = [
  'PCS',
  'NOS',
  'KG',
  'G',
  'LTR',
  'ML',
  'MTR',
  'BOX',
  'PACK',
  'SET',
  'HOUR',
  'DAY',
  'SERVICE',
] as const;
export class CategoryDto {
  @ValidateIf(optional)
  @Transform(text)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;
  @ValidateIf(optional)
  @Transform(text)
  @IsString()
  @MaxLength(1000)
  description?: string;
  @ValidateIf(optional) @IsBoolean() isActive?: boolean;
}
export class ProductDto {
  @ValidateIf(optional)
  @Transform(text)
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name?: string;
  @ValidateIf(optional)
  @Transform(text)
  @IsString()
  @MaxLength(2000)
  description?: string;
  @ValidateIf(optional) @IsIn(['PRODUCT', 'SERVICE']) type?:
    'PRODUCT' | 'SERVICE';
  @ValidateIf(optional) @IsIn(UNITS) unit?: (typeof UNITS)[number];
  @ValidateIf((_o, v) => v !== undefined && v !== '')
  @IsUUID()
  categoryId?: string;
  @ValidateIf(optional)
  @Transform(text)
  @IsString()
  @MaxLength(80)
  sku?: string;
  @ValidateIf(optional)
  @Transform(text)
  @IsString()
  @MaxLength(100)
  barcode?: string;
  @ValidateIf((_o, v) => v !== undefined && v !== '')
  @Transform(text)
  @Matches(/^\d{4,8}$/)
  hsnSacCode?: string;
  @ValidateIf(optional)
  @Matches(/^(0|[1-9]\d?)(\.\d{1,2})?$|^100(\.0{1,2})?$/)
  gstRate?: string;
  @ValidateIf(optional) @Matches(MONEY) purchasePrice?: string;
  @ValidateIf(optional) @Matches(MONEY) salePrice?: string;
  @ValidateIf((_o, v) => v !== undefined && v !== '')
  @Matches(MONEY)
  mrp?: string;
  @ValidateIf(optional) @IsBoolean() trackInventory?: boolean;
  @ValidateIf((_o, v) => v !== undefined && v !== '')
  @Matches(QUANTITY)
  minimumStock?: string;
  @ValidateIf(optional) @IsBoolean() isActive?: boolean;
}
export class CreateProductDto extends ProductDto {
  @ValidateIf(optional) @Matches(QUANTITY) openingStock?: string;
}
export class PageQuery {
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
}
export class CategoryQuery extends PageQuery {
  @IsIn(['active', 'inactive', 'all']) status: 'active' | 'inactive' | 'all' =
    'active';
  @ValidateIf(optional)
  @Transform(text)
  @IsString()
  @MaxLength(100)
  search?: string;
}
export class ProductQuery extends CategoryQuery {
  @ValidateIf(optional) @IsIn(['PRODUCT', 'SERVICE']) type?:
    'PRODUCT' | 'SERVICE';
  @ValidateIf(optional) @IsUUID() categoryId?: string;
  @ValidateIf(optional)
  @Matches(/^(0|[1-9]\d?)(\.\d{1,2})?$|^100(\.0{1,2})?$/)
  gstRate?: string;
  @IsIn(['all', 'tracked', 'low', 'out']) stockStatus:
    'all' | 'tracked' | 'low' | 'out' = 'all';
  @IsIn(['name', 'productCode', 'createdAt', 'salePrice', 'currentStock'])
  sortBy: 'name' | 'productCode' | 'createdAt' | 'salePrice' | 'currentStock' =
    'name';
  @IsIn(['asc', 'desc']) sortOrder: 'asc' | 'desc' = 'asc';
}
export class AdjustmentDto {
  @IsIn(['INCREASE', 'DECREASE']) direction: 'INCREASE' | 'DECREASE';
  @Matches(QUANTITY) quantity: string;
  @Transform(text) @IsString() @MinLength(1) @MaxLength(500) reason: string;
}
export class MovementQuery extends PageQuery {
  @ValidateIf(optional)
  @IsIn([
    'OPENING',
    'ADJUSTMENT_IN',
    'ADJUSTMENT_OUT',
    'INVOICE_FINALIZED',
    'INVOICE_CANCELLED',
  ])
  type?:
    | 'OPENING'
    | 'ADJUSTMENT_IN'
    | 'ADJUSTMENT_OUT'
    | 'INVOICE_FINALIZED'
    | 'INVOICE_CANCELLED';
}
