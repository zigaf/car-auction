import { IsOptional, IsNumberString } from 'class-validator';

export class GetBidsDto {
  @IsOptional()
  @IsNumberString()
  page?: string;

  @IsOptional()
  @IsNumberString()
  limit?: string;
}
