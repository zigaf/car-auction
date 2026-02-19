import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { IDocument, IUploadDocument } from '../../models/document.model';
import { IPaginatedResponse } from '../../models/lot.model';

@Injectable({ providedIn: 'root' })
export class DocumentsService {
  constructor(private readonly api: ApiService) {}

  getDocuments(
    page?: number,
    limit?: number,
  ): Observable<IPaginatedResponse<IDocument>> {
    return this.api.get<IPaginatedResponse<IDocument>>('/documents', {
      page,
      limit,
    });
  }

  uploadDocument(data: IUploadDocument): Observable<IDocument> {
    return this.api.post<IDocument>('/documents', data);
  }

  getDocument(id: string): Observable<IDocument> {
    return this.api.get<IDocument>(`/documents/${id}`);
  }
}
