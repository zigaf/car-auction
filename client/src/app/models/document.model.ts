export enum DocumentType {
  PASSPORT = 'passport',
  POWER_OF_ATTORNEY = 'power_of_attorney',
  INVOICE = 'invoice',
  CUSTOMS_DOC = 'customs_doc',
  OTHER = 'other',
}

export enum DocumentStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export interface IDocument {
  id: string;
  userId: string;
  orderId: string | null;
  type: DocumentType;
  status: DocumentStatus;
  fileUrl: string;
  fileName: string;
  uploadedBy: string;
  createdAt: string;
}

export interface IUploadDocument {
  type: DocumentType;
  fileUrl: string;
  fileName: string;
  orderId?: string;
}
