import { Type, Transform } from 'class-transformer';
import { ArrayMinSize, IsIn, IsInt, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateIf, ValidateNested } from 'class-validator';
import { MONEY, QUANTITY } from '../catalogue/catalogue.dto.js';
import { DATE, STATE_CODE } from '../invoices/invoice.dto.js';

const optional = (_o: unknown, v: unknown) => v !== undefined;
const text = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;

export class PosProductQuery {
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(25) pageSize = 10;
  @ValidateIf(optional) @Transform(text) @IsString() @MaxLength(100) search?: string;
}
export class PosSalesQuery {
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
  @ValidateIf(optional) @Transform(text) @IsString() @MaxLength(100) search?: string;
  @ValidateIf(optional) @Matches(DATE) dateFrom?: string;
  @ValidateIf(optional) @Matches(DATE) dateTo?: string;
  @ValidateIf(optional) @IsUUID() customerId?: string;
  @ValidateIf(optional) @IsIn(['UNPAID','PARTIAL','PAID']) paymentStatus?: 'UNPAID'|'PARTIAL'|'PAID';
  @IsIn(['invoiceDate','invoiceNumber','grandTotal','createdAt']) sortBy: 'invoiceDate'|'invoiceNumber'|'grandTotal'|'createdAt' = 'invoiceDate';
  @IsIn(['asc','desc']) sortOrder: 'asc'|'desc' = 'desc';
}
export class PosLineDto {
  @IsUUID() productId!: string;
  @Matches(QUANTITY) quantity!: string;
  @Matches(MONEY) unitPrice!: string;
  @IsIn(['NONE','PERCENT','AMOUNT']) discountType: 'NONE'|'PERCENT'|'AMOUNT' = 'NONE';
  @ValidateIf(optional) @Matches(MONEY) discountValue?: string;
}
export class PosTenderDto {
  @IsUUID() accountId!: string;
  @IsIn(['CASH','BANK_TRANSFER','UPI','CARD','CHEQUE','OTHER']) method!: 'CASH'|'BANK_TRANSFER'|'UPI'|'CARD'|'CHEQUE'|'OTHER';
  @Matches(MONEY) amount!: string;
  @ValidateIf(optional) @Matches(MONEY) tenderedAmount?: string;
  @ValidateIf(optional) @Transform(text) @IsString() @MaxLength(120) referenceNumber?: string;
}
export class PosCheckoutDto {
  @IsUUID() clientCheckoutId!: string;
  @ValidateIf(optional) @IsUUID() customerId?: string;
  @IsIn(['WALK_IN','CUSTOMER']) customerMode: 'WALK_IN'|'CUSTOMER' = 'WALK_IN';
  @Transform(text) @IsString() @MinLength(2) @MaxLength(80) placeOfSupplyState!: string;
  @Matches(STATE_CODE) placeOfSupplyStateCode!: string;
  @Matches(DATE) invoiceDate!: string;
  @IsIn(['EXCLUSIVE','INCLUSIVE']) priceMode: 'EXCLUSIVE'|'INCLUSIVE' = 'EXCLUSIVE';
  @ValidateIf(optional) @Transform(text) @IsString() @MaxLength(2000) notes?: string;
  @ValidateNested({ each: true }) @Type(() => PosLineDto) @ArrayMinSize(1) lines!: PosLineDto[];
  @IsIn(['PAY_LATER','RECORDED_PAYMENT']) paymentMode: 'PAY_LATER'|'RECORDED_PAYMENT' = 'PAY_LATER';
  @ValidateIf((o) => o.paymentMode === 'RECORDED_PAYMENT') @ValidateNested() @Type(() => PosTenderDto) tender?: PosTenderDto;
}
