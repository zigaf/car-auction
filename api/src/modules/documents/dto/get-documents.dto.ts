import { IsOptional, IsNumberString, IsString } from 'class-validator';

export class GetDocumentsDto {
  @IsOptional()
  @IsNumberString()
  page?: string;

  @IsOptional()
  @IsNumberString()
  limit?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
