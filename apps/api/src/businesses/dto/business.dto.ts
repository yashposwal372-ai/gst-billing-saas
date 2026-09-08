import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';
import { BusinessType, GstMode } from '../../generated/prisma/enums.js';
import { GSTIN_PATTERN, PAN_PATTERN } from '../../common/india-formats.js';

const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;
const optional = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() || undefined : value;
const upper = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toUpperCase() || undefined : value;

export class BusinessDto {
  @Transform(trim) @IsString() @Length(2, 160) name!: string;
  @Transform(optional) @IsOptional() @IsString() @MaxLength(160) tradeName?: string;
  @Transform(trim) @IsString() @Length(2, 160) ownerName!: string;
  @IsEnum(BusinessType) businessType!: BusinessType;
  @IsBoolean() gstRegistered!: boolean;
  @Transform(upper) @IsOptional()
  @Matches(GSTIN_PATTERN, { message: 'GSTIN format is invalid (format check only)' })
  gstin?: string;
  @Transform(upper) @IsOptional()
  @Matches(PAN_PATTERN, { message: 'PAN format is invalid' })
  pan?: string;
  @Matches(/^\+?[1-9]\d{9,14}$/) mobile!: string;
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsEmail() @MaxLength(254) email!: string;
  @Transform(trim) @IsString() @Length(3, 200) addressLine1!: string;
  @Transform(optional) @IsOptional() @IsString() @MaxLength(200) addressLine2?: string;
  @Transform(trim) @IsString() @Length(2, 80) state!: string;
  @Matches(/^(0[1-9]|[12][0-9]|3[0-8])$/) stateCode!: string;
  @Transform(trim) @IsString() @Length(2, 80) city!: string;
  @Matches(/^[1-9][0-9]{5}$/) pincode!: string;
  @Transform(upper) @Matches(/^[A-Z][A-Z0-9-]{0,11}$/) invoicePrefix!: string;
  @Matches(/^20[0-9]{2}-[0-9]{2}$/) financialYear!: string;
  @IsEnum(GstMode) gstMode!: GstMode;
  @Transform(optional) @IsOptional() @IsString() @MaxLength(120) bankName?: string;
  @Transform(optional) @IsOptional() @IsString() @MaxLength(160) accountHolder?: string;
  @Transform(optional) @IsOptional() @Matches(/^[0-9]{6,34}$/) accountNumber?: string;
  @Transform(upper) @IsOptional() @Matches(/^[A-Z]{4}0[A-Z0-9]{6}$/) ifsc?: string;
  @Transform(optional) @IsOptional() @MaxLength(100) @Matches(/^[a-zA-Z0-9._-]{2,64}@[a-zA-Z][a-zA-Z0-9.-]{1,34}$/) upiId?: string;
}
