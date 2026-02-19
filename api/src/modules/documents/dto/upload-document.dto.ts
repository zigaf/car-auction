import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUrl, IsUUID } from 'class-validator';
import { DocumentType } from '../../../common/enums/document-type.enum';

export class UploadDocumentDto {
  @IsEnum(DocumentType)
  type: DocumentType;

  @IsUrl()
  @IsNotEmpty()
  fileUrl: string;

  @IsString()
  @IsNotEmpty()
  fileName: string;

  @IsOptional()
  @IsUUID()
  orderId?: string;
}
