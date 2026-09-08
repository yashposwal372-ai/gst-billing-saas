import {
  IsBoolean,
  IsIn,
  IsString,
  MaxLength,
  Matches,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { PartyDto, MONEY_PATTERN, trim } from '../../parties/party.dto.js';
import {
  STATE_CODE_PATTERN,
  PINCODE_PATTERN,
} from '../../common/india-formats.js';
export class CustomerDto extends PartyDto {
  @ValidateIf((_o, v) => v !== undefined)
  @IsIn(['INDIVIDUAL', 'BUSINESS'])
  customerType?: 'INDIVIDUAL' | 'BUSINESS';
  @ValidateIf((_o, v) => v !== undefined)
  @IsBoolean()
  shippingSameAsBilling?: boolean;
  @ValidateIf((_o, v) => v !== undefined)
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  shippingAddressLine1?: string;
  @ValidateIf((_o, v) => v !== undefined)
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  shippingAddressLine2?: string;
  @ValidateIf((_o, v) => v !== undefined)
  @Transform(trim)
  @IsString()
  @MaxLength(80)
  shippingCity?: string;
  @ValidateIf((_o, v) => v !== undefined)
  @Transform(trim)
  @IsString()
  @MaxLength(80)
  shippingState?: string;
  @ValidateIf((_o, v) => v !== undefined && v !== '')
  @Matches(STATE_CODE_PATTERN)
  shippingStateCode?: string;
  @ValidateIf((_o, v) => v !== undefined && v !== '')
  @Matches(PINCODE_PATTERN)
  shippingPincode?: string;
  @ValidateIf((_o, v) => v !== undefined && v !== '')
  @Matches(MONEY_PATTERN)
  creditLimit?: string;
}
