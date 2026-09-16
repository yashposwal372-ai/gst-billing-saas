import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  GSTIN_PATTERN,
  PAN_PATTERN,
  PHONE_PATTERN,
  STATE_CODE_PATTERN,
  PINCODE_PATTERN,
} from './india-formats.js';
export const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
export const upper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;
export const MONEY_PATTERN = /^(0|[1-9]\d{0,12})(\.\d{1,2})?$/;
// PATCH DTOs allow omission, but never null for required fields. Empty optional strings clear values.
export class PartyDto {
  @ValidateIf((_o, v) => v !== undefined)
  @Transform(trim)
  @IsString()
  @Length(2, 160)
  displayName?: string;
  @ValidateIf((_o, v) => v !== undefined)
  @Transform(trim)
  @IsString()
  @MaxLength(160)
  businessName?: string;
  @ValidateIf((_o, v) => v !== undefined)
  @Transform(trim)
  @IsString()
  @MaxLength(160)
  contactPerson?: string;
  @ValidateIf((_o, v) => v !== undefined) @IsBoolean() gstRegistered?: boolean;
  @ValidateIf((_o, v) => v !== undefined && v !== '')
  @Transform(upper)
  @Matches(GSTIN_PATTERN)
  gstin?: string;
  @ValidateIf((_o, v) => v !== undefined && v !== '')
  @Transform(upper)
  @Matches(PAN_PATTERN)
  pan?: string;
  @ValidateIf((_o, v) => v !== undefined)
  @Matches(PHONE_PATTERN)
  phone?: string;
  @ValidateIf((_o, v) => v !== undefined && v !== '')
  @Matches(PHONE_PATTERN)
  whatsappNumber?: string;
  @ValidateIf((_o, v) => v !== undefined && v !== '')
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email?: string;
  @ValidateIf((_o, v) => v !== undefined)
  @Transform(trim)
  @IsString()
  @Length(3, 200)
  addressLine1?: string;
  @ValidateIf((_o, v) => v !== undefined)
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  addressLine2?: string;
  @ValidateIf((_o, v) => v !== undefined)
  @Transform(trim)
  @IsString()
  @Length(2, 80)
  city?: string;
  @ValidateIf((_o, v) => v !== undefined)
  @Transform(trim)
  @IsString()
  @Length(2, 80)
  state?: string;
  @ValidateIf((_o, v) => v !== undefined)
  @Matches(STATE_CODE_PATTERN)
  stateCode?: string;
  @ValidateIf((_o, v) => v !== undefined)
  @Matches(PINCODE_PATTERN)
  pincode?: string;
  @ValidateIf((_o, v) => v !== undefined)
  @Matches(MONEY_PATTERN, {
    message:
      'openingBalance must be a nonnegative decimal string with at most 2 decimal places',
  })
  openingBalance?: string;
  @ValidateIf((_o, v) => v !== undefined)
  @IsIn(['RECEIVABLE', 'PAYABLE'])
  openingBalanceType?: 'RECEIVABLE' | 'PAYABLE';
  @ValidateIf((_o, v) => v !== undefined)
  @IsInt()
  @Min(0)
  @Max(3650)
  paymentTermsDays?: number;
  @ValidateIf((_o, v) => v !== undefined)
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  notes?: string;
  @ValidateIf((_o, v) => v !== undefined) @IsBoolean() isActive?: boolean;
}
export class PartyQuery {
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
  @Transform(trim) @IsString() @MaxLength(100) search = '';
  @IsIn(['all', 'active', 'inactive']) status = 'active';
  @IsIn(['all', 'true', 'false']) gstRegistered = 'all';
  @Transform(trim) @IsString() @MaxLength(80) state = '';
  @IsIn(['displayName', 'code', 'createdAt', 'updatedAt']) sortBy =
    'displayName';
  @IsIn(['asc', 'desc']) sortOrder: 'asc' | 'desc' = 'asc';
}
