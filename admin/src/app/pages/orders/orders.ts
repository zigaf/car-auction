import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe, DatePipe } from '@angular/common';
import { OrderService, IOrder } from '../../core/services/order.service';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Ожидает подтверждения',
  approved: 'Подтверждён',
  paid: 'Оплачен',
  delivered_svh: 'Доставлен на СВХ',
  customs: 'На растаможке',
  cleared: 'Растаможен',
  delivering: 'В доставке',
  completed: 'Завершён',
};

const STATUS_BADGE: Record<string, string> = {
  pending: 'badge--amber',
  approved: 'badge--blue',
  paid: 'badge--blue',
  delivered_svh: 'badge--orange',
  customs: 'badge--orange',
  cleared: 'badge--orange',
  delivering: 'badge--purple',
  completed: 'badge--green',
};

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [FormsModule, DecimalPipe, DatePipe],
  templateUrl: './orders.html',
  styleUrl: './orders.scss',
})
export class OrdersPage implements OnInit {
  private readonly orderService = inject(OrderService);

  orders: IOrder[] = [];
  loading = true;
  error = '';
  total = 0;
  page = 1;
  limit = 20;

  filterStatus = '';

  readonly statuses = Object.keys(STATUS_LABELS);
  readonly statusLabels = STATUS_LABELS;
  readonly statusBadge = STATUS_BADGE;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = '';

    this.orderService.getOrders({
      page: this.page,
      limit: this.limit,
      status: this.filterStatus || undefined,
    }).subscribe({
      next: (res) => {
        this.orders = res.data;
        this.total = res.total;
        this.loading = false;
      },
      error: () => {
        this.error = 'Не удалось загрузить заказы';
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

  updateStatus(order: IOrder, status: string): void {
    this.orderService.updateOrderStatus(order.id, status).subscribe({
      next: (updated) => {
        const idx = this.orders.findIndex(o => o.id === updated.id);
        if (idx !== -1) this.orders[idx] = updated;
      },
    });
  }
}
