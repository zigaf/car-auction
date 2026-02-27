import { IsString, IsOptional, MaxLength, IsEmail } from 'class-validator';

export class CreateBotUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MaxLength(100)
  firstName: string;

  @IsString()
  @MaxLength(100)
  lastName: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  countryFlag?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;
}
