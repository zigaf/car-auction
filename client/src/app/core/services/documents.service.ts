import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { IDocument, IUploadDocument, DocumentType } from '../../models/document.model';
import { IPaginatedResponse } from '../../models/lot.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class DocumentsService {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);

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

  uploadFile(file: File, type: DocumentType): Observable<IDocument> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    return this.http.post<IDocument>(`${environment.apiUrl}/documents/upload`, formData);
  }

  getDocument(id: string): Observable<IDocument> {
    return this.api.get<IDocument>(`/documents/${id}`);
  }
}
