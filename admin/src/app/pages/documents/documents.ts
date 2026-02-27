import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { DocumentsService, IDocument } from '../../core/services/documents.service';

const STATUS_LABELS: Record<string, string | undefined> = {
  pending: 'На проверке',
  approved: 'Одобрен',
  rejected: 'Отклонён',
};

const TYPE_LABELS: Record<string, string | undefined> = {
  passport: 'Паспорт',
  driver_license: 'Вод. удостоверение',
  proof_of_address: 'Подтверждение адреса',
  other: 'Другое',
};

@Component({
  selector: 'app-documents',
  standalone: true,
  imports: [FormsModule, DatePipe],
  templateUrl: './documents.html',
  styleUrl: './documents.scss',
})
export class DocumentsPage implements OnInit {
  private readonly documentsService = inject(DocumentsService);

  documents: IDocument[] = [];
  loading = true;
  error = '';
  total = 0;
  page = 1;
  limit = 20;

  filterStatus = 'pending';

  readonly statusLabels = STATUS_LABELS;
  readonly typeLabels = TYPE_LABELS;
  readonly statuses = ['', 'pending', 'approved', 'rejected'];

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = '';

    this.documentsService.getDocuments({
      page: this.page,
      limit: this.limit,
      status: this.filterStatus || undefined,
    }).subscribe({
      next: (res) => {
        this.documents = res.data;
        this.total = res.total;
        this.loading = false;
      },
      error: () => {
        this.error = 'Не удалось загрузить документы';
        this.loading = false;
      },
    });
  }

  onFilterChange(): void {
    this.page = 1;
    this.load();
  }

  prevPage(): void {
    if (this.page > 1) { this.page--; this.load(); }
  }

  nextPage(): void {
    if (this.page * this.limit < this.total) { this.page++; this.load(); }
  }

  get totalPages(): number {
    return Math.ceil(this.total / this.limit);
  }

  approve(doc: IDocument): void {
    this.documentsService.updateStatus(doc.id, 'approved').subscribe({
      next: (updated) => {
        const idx = this.documents.findIndex(d => d.id === updated.id);
        if (idx !== -1) this.documents[idx] = updated;
      },
    });
  }

  reject(doc: IDocument): void {
    const comment = prompt('Причина отклонения (необязательно):') ?? undefined;
    this.documentsService.updateStatus(doc.id, 'rejected', comment).subscribe({
      next: (updated) => {
        const idx = this.documents.findIndex(d => d.id === updated.id);
        if (idx !== -1) this.documents[idx] = updated;
      },
    });
  }

  openFile(url: string): void {
    window.open(url, '_blank');
  }
}
