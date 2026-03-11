import { Component, OnInit, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DocumentsService } from '../../../core/services/documents.service';
import { AppButtonComponent } from '../../../shared/components/button/button.component';
import { IDocument, DocumentType, DocumentStatus } from '../../../models/document.model';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-documents',
  standalone: true,
  imports: [DatePipe, FormsModule, AppButtonComponent],
  templateUrl: './documents.html',
  styleUrl: './documents.scss',
})
export class DocumentsComponent implements OnInit {
  private readonly documentsService = inject(DocumentsService);

  documents: IDocument[] = [];
  loading = true;
  error = '';

  // Upload modal
  showUploadModal = false;
  uploadType: DocumentType = DocumentType.PASSPORT;
  selectedFile: File | null = null;
  selectedFileName = '';
  uploading = false;
  uploadError = '';

  readonly documentTypes = [
    { value: DocumentType.PASSPORT, label: 'Паспорт / ID' },
    { value: DocumentType.INVOICE, label: 'Инвойс' },
    { value: DocumentType.CUSTOMS_DOC, label: 'Таможенный документ' },
    { value: DocumentType.POWER_OF_ATTORNEY, label: 'Доверенность' },
    { value: DocumentType.OTHER, label: 'Другое' },
  ];

  ngOnInit(): void {
    this.loadDocuments();
  }

  private loadDocuments(): void {
    this.loading = true;
    this.error = '';

    this.documentsService.getDocuments(1, 50).subscribe({
      next: (res) => {
        this.documents = res.data;
        this.loading = false;
      },
      error: () => {
        this.error = 'Не удалось загрузить документы';
        this.loading = false;
      },
    });
  }

  // ─── Upload modal ─────────────────────────────────────────────────────

  openUploadModal(): void {
    this.showUploadModal = true;
    this.uploadType = DocumentType.PASSPORT;
    this.selectedFile = null;
    this.selectedFileName = '';
    this.uploadError = '';
  }

  closeUploadModal(): void {
    this.showUploadModal = false;
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      if (file.size > 10 * 1024 * 1024) {
        this.uploadError = 'Максимальный размер файла — 10 МБ';
        return;
      }
      this.selectedFile = file;
      this.selectedFileName = file.name;
      this.uploadError = '';
    }
  }

  submitUpload(): void {
    if (!this.selectedFile || this.uploading) return;

    this.uploading = true;
    this.uploadError = '';

    this.documentsService.uploadFile(this.selectedFile, this.uploadType).subscribe({
      next: (doc) => {
        this.documents.unshift(doc);
        this.uploading = false;
        this.showUploadModal = false;
      },
      error: () => {
        this.uploadError = 'Не удалось загрузить файл. Попробуйте ещё раз.';
        this.uploading = false;
      },
    });
  }

  // ─── Download ─────────────────────────────────────────────────────────

  downloadDocument(doc: IDocument): void {
    const url = this.getFileUrl(doc.fileUrl);
    window.open(url, '_blank');
  }

  private getFileUrl(path: string): string {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return `${environment.apiUrl.replace('/api', '')}${path}`;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────

  getStatusClass(status: string): string {
    switch (status) {
      case DocumentStatus.APPROVED:
        return 'doc-status--approved';
      case DocumentStatus.PENDING:
        return 'doc-status--pending';
      case DocumentStatus.REJECTED:
        return 'doc-status--rejected';
      default:
        return '';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case DocumentStatus.APPROVED:
        return 'Подтверждён';
      case DocumentStatus.PENDING:
        return 'На проверке';
      case DocumentStatus.REJECTED:
        return 'Отклонён';
      default:
        return status;
    }
  }

  getTypeIcon(type: string): string {
    switch (type) {
      case DocumentType.PASSPORT:
        return 'badge';
      case DocumentType.INVOICE:
        return 'receipt';
      case DocumentType.CUSTOMS_DOC:
        return 'assured_workload';
      case DocumentType.POWER_OF_ATTORNEY:
        return 'gavel';
      default:
        return 'description';
    }
  }

  getTypeLabel(type: string): string {
    switch (type) {
      case DocumentType.PASSPORT:
        return 'Паспорт';
      case DocumentType.INVOICE:
        return 'Инвойс';
      case DocumentType.CUSTOMS_DOC:
        return 'Таможня';
      case DocumentType.POWER_OF_ATTORNEY:
        return 'Доверенность';
      case DocumentType.OTHER:
        return 'Другое';
      default:
        return type;
    }
  }
}
