import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { DATE, GST_RATE, STATE_CODE } from '../invoices/invoice.dto.js';
const optional = (_o: unknown, v: unknown) => v !== undefined;
const text = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;
export class GstReportQuery {
  @ValidateIf(optional) @Matches(/^20\d{2}-\d{2}$/) financialYear?: string;
  @ValidateIf(optional) @Matches(DATE) dateFrom?: string;
  @ValidateIf(optional) @Matches(DATE) dateTo?: string;
}
export class GstRegisterQuery extends GstReportQuery {
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
  @ValidateIf(optional) @Transform(text) @IsString() @MaxLength(100) search?: string;
  @ValidateIf(optional) @IsUUID() customerId?: string;
  @ValidateIf(optional) @IsUUID() supplierId?: string;
  @ValidateIf(optional) @Matches(GST_RATE) gstRate?: string;
  @ValidateIf(optional) @IsIn(['INTRA_STATE','INTER_STATE']) taxType?: 'INTRA_STATE'|'INTER_STATE';
  @ValidateIf(optional) @Matches(STATE_CODE) placeOfSupply?: string;
  @IsIn(['date','number','partyName','taxableValue','totalTax','grandTotal']) sortBy: 'date'|'number'|'partyName'|'taxableValue'|'totalTax'|'grandTotal' = 'date';
  @IsIn(['asc','desc']) sortOrder: 'asc'|'desc' = 'desc';
}
export class GstExportQuery extends GstRegisterQuery {
  @Type(() => Number) @IsInt() @Min(1) @Max(5000) exportLimit = 1000;
}
