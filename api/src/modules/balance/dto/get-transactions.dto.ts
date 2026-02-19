import { IsOptional, IsNumberString } from 'class-validator';

export class GetTransactionsDto {
  @IsOptional()
  @IsNumberString()
  page?: string;

  @IsOptional()
  @IsNumberString()
  limit?: string;
}
