import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe, DatePipe } from '@angular/common';
import { LotService, ILot } from '../../core/services/lot.service';

const STATUS_LABELS: Record<string, string> = {
  imported: 'Импортирован',
  active: 'Активный',
  trading: 'Торги',
  sold: 'Продан',
  cancelled: 'Отменён',
};

const STATUS_BADGE: Record<string, string> = {
  imported: 'badge--gray',
  active: 'badge--blue',
  trading: 'badge--green',
  sold: 'badge--amber',
  cancelled: 'badge--red',
};

@Component({
  selector: 'app-lots',
  standalone: true,
  imports: [FormsModule, DecimalPipe, DatePipe],
  templateUrl: './lots.html',
  styleUrl: './lots.scss',
})
export class LotsPage implements OnInit {
  private readonly lotService = inject(LotService);

  lots: ILot[] = [];
  loading = true;
  error = '';
  total = 0;
  page = 1;
  limit = 20;

  filterStatus = '';
  filterSearch = '';

  readonly statuses = ['', 'imported', 'active', 'trading', 'sold', 'cancelled'];
  readonly statusLabels = STATUS_LABELS;
  readonly statusBadge = STATUS_BADGE;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = '';

    this.lotService.getLots({
      page: this.page,
      limit: this.limit,
      status: this.filterStatus || undefined,
      search: this.filterSearch || undefined,
    }).subscribe({
      next: (res) => {
        this.lots = res.data;
        this.total = res.total;
        this.loading = false;
      },
      error: () => {
        this.error = 'Не удалось загрузить лоты';
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

  updateStatus(lot: ILot, status: string): void {
    this.lotService.updateStatus(lot.id, status).subscribe({
      next: (updated) => {
        const idx = this.lots.findIndex(l => l.id === updated.id);
        if (idx !== -1) this.lots[idx] = updated;
      },
    });
  }

  deleteLot(id: string): void {
    if (!confirm('Удалить лот? Это действие необратимо.')) return;
    this.lotService.deleteLot(id).subscribe({
      next: () => {
        this.lots = this.lots.filter(l => l.id !== id);
        this.total--;
      },
    });
  }
}
