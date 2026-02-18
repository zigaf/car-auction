import { IsOptional, IsString, IsEnum } from 'class-validator';
import { Language } from '../../../common/enums/language.enum';
import { Currency } from '../../../common/enums/currency.enum';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  countryFlag?: string;

  @IsOptional()
  @IsEnum(Language)
  preferredLanguage?: Language;

  @IsOptional()
  @IsEnum(Currency)
  preferredCurrency?: Currency;
}
