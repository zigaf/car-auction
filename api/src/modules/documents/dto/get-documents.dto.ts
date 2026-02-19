import { IsOptional, IsNumberString } from 'class-validator';

export class GetDocumentsDto {
  @IsOptional()
  @IsNumberString()
  page?: string;

  @IsOptional()
  @IsNumberString()
  limit?: string;
}
