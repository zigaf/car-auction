import { Component, OnInit, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DocumentsService } from '../../../core/services/documents.service';
import { AppButtonComponent } from '../../../shared/components/button/button.component';
import { IDocument, DocumentType, DocumentStatus } from '../../../models/document.model';
import { environment } from '../../../../environments/environment';
import { LanguageService } from '../../../core/services/language.service';

@Component({
  selector: 'app-documents',
  standalone: true,
  imports: [DatePipe, FormsModule, AppButtonComponent],
  templateUrl: './documents.html',
  styleUrl: './documents.scss',
})
export class DocumentsComponent implements OnInit {
  ls = inject(LanguageService);
  private readonly documentsService = inject(DocumentsService);

  documents: IDocument[] = [];
  loading = true;
  error = '';

  // Upload modal
  showUploadModal = false;
  uploadType: DocumentType = DocumentType.PASSPORT;
  selectedFiles: File[] = [];
  selectedFileNames: string[] = [];
  uploading = false;
  uploadError = '';

  get documentTypes() {
    return [
      { value: DocumentType.PASSPORT, label: this.ls.t('docs.type.passport') },
      { value: DocumentType.POWER_OF_ATTORNEY, label: this.ls.t('docs.type.poa') },
      { value: DocumentType.OTHER, label: this.ls.t('docs.type.other') },
    ];
  }

  get requiredDocs(): { type: DocumentType; label: string; icon: string; description: string }[] {
    return [
      { type: DocumentType.PASSPORT, label: this.ls.t('docs.req.passport.label'), icon: 'badge', description: this.ls.t('docs.req.passport.desc') },
      { type: DocumentType.POWER_OF_ATTORNEY, label: this.ls.t('docs.req.poa.label'), icon: 'gavel', description: this.ls.t('docs.req.poa.desc') },
    ];
  }

  getDocStatus(type: DocumentType): 'none' | 'pending' | 'approved' | 'rejected' {
    const doc = this.documents.find(d => d.type === type);
    if (!doc) return 'none';
    return doc.status as 'pending' | 'approved' | 'rejected';
  }

  getDocStatusIcon(type: DocumentType): string {
    switch (this.getDocStatus(type)) {
      case 'approved': return 'check_circle';
      case 'pending': return 'schedule';
      case 'rejected': return 'cancel';
      default: return 'radio_button_unchecked';
    }
  }

  uploadRequired(type: DocumentType): void {
    this.uploadType = type;
    this.showUploadModal = true;
    this.selectedFiles = [];
    this.selectedFileNames = [];
    this.uploadError = '';
  }

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
        this.error = this.ls.t('docs.error');
        this.loading = false;
      },
    });
  }

  // ─── Upload modal ─────────────────────────────────────────────────────

  openUploadModal(): void {
    this.showUploadModal = true;
    this.uploadType = DocumentType.PASSPORT;
    this.selectedFiles = [];
    this.selectedFileNames = [];
    this.uploadError = '';
  }

  closeUploadModal(): void {
    this.showUploadModal = false;
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const files = Array.from(input.files);
      for (const file of files) {
        if (file.size > 10 * 1024 * 1024) {
          this.uploadError = this.ls.t('docs.error.fileSize');
          return;
        }
      }
      this.selectedFiles = files;
      this.selectedFileNames = files.map(f => f.name);
      this.uploadError = '';
    }
  }

  removeFile(index: number): void {
    this.selectedFiles.splice(index, 1);
    this.selectedFileNames.splice(index, 1);
  }

  submitUpload(): void {
    if (this.selectedFiles.length === 0 || this.uploading) return;

    this.uploading = true;
    this.uploadError = '';

    let completed = 0;
    let hasError = false;

    for (const file of this.selectedFiles) {
      this.documentsService.uploadFile(file, this.uploadType).subscribe({
        next: (doc) => {
          this.documents.unshift(doc);
          completed++;
          if (completed === this.selectedFiles.length) {
            this.uploading = false;
            this.showUploadModal = false;
          }
        },
        error: () => {
          if (!hasError) {
            hasError = true;
            this.uploadError = this.ls.t('docs.error.upload');
            this.uploading = false;
          }
        },
      });
    }
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
      case DocumentStatus.APPROVED:  return this.ls.t('docs.status.approved');
      case DocumentStatus.PENDING:   return this.ls.t('docs.status.pending');
      case DocumentStatus.REJECTED:  return this.ls.t('docs.status.rejected');
      default:                       return status;
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
      case DocumentType.PASSPORT:          return this.ls.t('docs.type.passportShort');
      case DocumentType.INVOICE:           return this.ls.t('docs.type.invoice');
      case DocumentType.CUSTOMS_DOC:       return this.ls.t('docs.type.customsShort');
      case DocumentType.POWER_OF_ATTORNEY: return this.ls.t('docs.type.poa');
      case DocumentType.OTHER:             return this.ls.t('docs.type.other');
      default:                             return type;
    }
  }
}
