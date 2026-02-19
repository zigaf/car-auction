import { IsOptional, IsNumberString } from 'class-validator';

export class GetOrdersDto {
  @IsOptional()
  @IsNumberString()
  page?: string;

  @IsOptional()
  @IsNumberString()
  limit?: string;
}
