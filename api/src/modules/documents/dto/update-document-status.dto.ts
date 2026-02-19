import { IsIn } from 'class-validator';
import { DocumentStatus } from '../../../common/enums/document-status.enum';

export class UpdateDocumentStatusDto {
  @IsIn([DocumentStatus.APPROVED, DocumentStatus.REJECTED])
  status: DocumentStatus;
}
