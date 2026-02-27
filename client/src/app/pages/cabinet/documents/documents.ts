import { Component, OnInit, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { DocumentsService } from '../../../core/services/documents.service';
import { AppButtonComponent } from '../../../shared/components/button/button.component';
import { IDocument, DocumentType, DocumentStatus } from '../../../models/document.model';

@Component({
  selector: 'app-documents',
  standalone: true,
  imports: [DatePipe, AppButtonComponent],
  templateUrl: './documents.html',
  styleUrl: './documents.scss',
})
export class DocumentsComponent implements OnInit {
  private readonly documentsService = inject(DocumentsService);

  documents: IDocument[] = [];
  loading = true;
  error = '';

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
