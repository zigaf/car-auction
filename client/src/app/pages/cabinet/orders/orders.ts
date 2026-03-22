import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { DecimalPipe, DatePipe } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { OrderService } from '../../../core/services/order.service';
import { IOrder, IOrderStatusHistory, OrderStatus } from '../../../models/order.model';
import { LanguageService } from '../../../core/services/language.service';

interface OrderStep {
  status: OrderStatus;
}

const ORDER_STEPS: OrderStep[] = [
  { status: OrderStatus.PENDING },
  { status: OrderStatus.APPROVED },
  { status: OrderStatus.PAID },
  { status: OrderStatus.DELIVERED_SVH },
  { status: OrderStatus.CUSTOMS },
  { status: OrderStatus.CLEARED },
  { status: OrderStatus.DELIVERING },
  { status: OrderStatus.COMPLETED },
];

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [DecimalPipe, DatePipe],
  templateUrl: './orders.html',
  styleUrl: './orders.scss',
})
export class OrdersComponent implements OnInit, OnDestroy {
  ls = inject(LanguageService);
  private readonly orderService = inject(OrderService);
  private readonly destroy$ = new Subject<void>();

  orders: IOrder[] = [];
  loading = true;
  error = '';
  expandedOrderId: string | null = null;
  trackingMap: Record<string, IOrderStatusHistory[]> = {};
  trackingLoading: Record<string, boolean> = {};

  readonly steps = ORDER_STEPS;

  ngOnInit(): void {
    this.loadOrders();
  }

  private loadOrders(): void {
    this.loading = true;
    this.error = '';

    this.orderService.getMyOrders(1, 50)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.orders = res.data;
          this.loading = false;
        },
        error: () => {
          this.error = this.ls.t('orders.error');
          this.loading = false;
        },
      });
  }

  toggleOrder(orderId: string): void {
    if (this.expandedOrderId === orderId) {
      this.expandedOrderId = null;
      return;
    }

    this.expandedOrderId = orderId;

    if (!this.trackingMap[orderId]) {
      this.trackingLoading[orderId] = true;
      this.orderService.getOrderTracking(orderId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (history) => {
            this.trackingMap[orderId] = history;
            this.trackingLoading[orderId] = false;
          },
          error: () => {
            this.trackingMap[orderId] = [];
            this.trackingLoading[orderId] = false;
          },
        });
    }
  }

  getShortId(id: string): string {
    return id.substring(0, 8).toUpperCase();
  }

  getLotTitle(order: IOrder): string {
    if (order.lot) {
      return [order.lot.brand, order.lot.model, order.lot.year]
        .filter(v => v != null && v !== '')
        .join(' ');
    }
    return this.ls.t('orders.notFound');
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case OrderStatus.PENDING:        return this.ls.t('orders.status.pending');
      case OrderStatus.APPROVED:       return this.ls.t('orders.status.approved');
      case OrderStatus.PAID:           return this.ls.t('orders.status.paid');
      case OrderStatus.DELIVERED_SVH:  return this.ls.t('orders.status.deliveredSvh');
      case OrderStatus.CUSTOMS:        return this.ls.t('orders.status.customs');
      case OrderStatus.CLEARED:        return this.ls.t('orders.status.cleared');
      case OrderStatus.DELIVERING:     return this.ls.t('orders.status.delivering');
      case OrderStatus.COMPLETED:      return this.ls.t('orders.status.completed');
      default:                         return status;
    }
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case OrderStatus.PENDING:
        return 'order-badge--yellow';
      case OrderStatus.APPROVED:
      case OrderStatus.PAID:
        return 'order-badge--blue';
      case OrderStatus.DELIVERED_SVH:
      case OrderStatus.CUSTOMS:
      case OrderStatus.CLEARED:
        return 'order-badge--orange';
      case OrderStatus.DELIVERING:
        return 'order-badge--purple';
      case OrderStatus.COMPLETED:
        return 'order-badge--green';
      default:
        return '';
    }
  }

  getStepState(orderStatus: string, stepStatus: string): string {
    const statusOrder = ORDER_STEPS.map((s) => s.status);
    const currentIdx = statusOrder.indexOf(orderStatus as OrderStatus);
    const stepIdx = statusOrder.indexOf(stepStatus as OrderStatus);

    if (stepIdx < currentIdx) {
      return 'progress-step--done';
    }
    if (stepIdx === currentIdx) {
      return 'progress-step--active';
    }
    return '';
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
