import { IsString, IsNotEmpty } from 'class-validator';

export class UpsertTemplateDto {
  @IsString()
  @IsNotEmpty()
  subject: string;

  @IsString()
  @IsNotEmpty()
  bodyHtml: string;
}
