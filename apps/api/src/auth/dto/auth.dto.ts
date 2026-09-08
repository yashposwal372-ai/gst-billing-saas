import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, Matches, MaxLength, IsOptional } from 'class-validator';

export class EmailDto {
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsEmail()
  @MaxLength(254)
  email!: string;
}
export class LoginDto extends EmailDto {
  @IsString()
  @Length(12, 128)
  password!: string;
}
export class SignupDto extends LoginDto {
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @Length(1, 80)
  firstName!: string;

  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @Length(1, 80)
  lastName!: string;

  @IsOptional()
  @Matches(/^\+?[1-9]\d{9,14}$/)
  mobile?: string;
}
export class TokenDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  token!: string;
}
export class ResetPasswordDto extends TokenDto {
  @IsString()
  @Length(12, 128)
  password!: string;
}
