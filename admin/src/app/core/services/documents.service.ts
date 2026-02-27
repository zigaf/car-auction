import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface IDocument {
  id: string;
  type: string;
  status: string;
  fileUrl: string;
  createdAt: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

export interface IDocumentsResponse {
  data: IDocument[];
  total: number;
  page: number;
  limit: number;
}

@Injectable({ providedIn: 'root' })
export class DocumentsService {
  constructor(private readonly api: ApiService) {}

  getDocuments(params: {
    page?: number;
    limit?: number;
    status?: string;
  } = {}): Observable<IDocumentsResponse> {
    return this.api.get<IDocumentsResponse>('/documents/all', {
      page: params.page ?? 1,
      limit: params.limit ?? 20,
      status: params.status,
    });
  }

  updateStatus(id: string, status: string, comment?: string): Observable<IDocument> {
    return this.api.patch<IDocument>(`/documents/${id}/status`, { status, comment });
  }
}
