import { Transform } from 'class-transformer';
import { IsString, MaxLength, Matches, ValidateIf } from 'class-validator';
import { PartyDto, trim, upper } from './party.dto.js';
import { IFSC_PATTERN, UPI_PATTERN } from './india-formats.js';
export class SupplierDto extends PartyDto {
  @ValidateIf((_o, v) => v !== undefined)
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  bankName?: string;
  @ValidateIf((_o, v) => v !== undefined)
  @Transform(trim)
  @IsString()
  @MaxLength(160)
  accountHolderName?: string;
  @ValidateIf((_o, v) => v !== undefined && v !== '')
  @Matches(/^[0-9]{6,34}$/)
  accountNumber?: string;
  @ValidateIf((_o, v) => v !== undefined && v !== '')
  @Transform(upper)
  @Matches(IFSC_PATTERN)
  ifsc?: string;
  @ValidateIf((_o, v) => v !== undefined && v !== '')
  @MaxLength(100)
  @Matches(UPI_PATTERN)
  upiId?: string;
}
