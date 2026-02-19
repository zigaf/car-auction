import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { DecimalPipe, DatePipe } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { OrderService } from '../../../core/services/order.service';
import { IOrder, IOrderStatusHistory, OrderStatus } from '../../../models/order.model';

interface OrderStep {
  status: OrderStatus;
  label: string;
}

const ORDER_STEPS: OrderStep[] = [
  { status: OrderStatus.PENDING, label: 'Ожидает подтверждения' },
  { status: OrderStatus.APPROVED, label: 'Подтверждён' },
  { status: OrderStatus.PAID, label: 'Оплачен' },
  { status: OrderStatus.DELIVERED_SVH, label: 'Доставлен на СВХ' },
  { status: OrderStatus.CUSTOMS, label: 'На растаможке' },
  { status: OrderStatus.CLEARED, label: 'Растаможен' },
  { status: OrderStatus.DELIVERING, label: 'В доставке' },
  { status: OrderStatus.COMPLETED, label: 'Завершён' },
];

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [DecimalPipe, DatePipe],
  templateUrl: './orders.html',
  styleUrl: './orders.scss',
})
export class OrdersComponent implements OnInit, OnDestroy {
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
          this.error = 'Не удалось загрузить заказы';
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
      return `${order.lot.brand} ${order.lot.model} ${order.lot.year}`;
    }
    return 'Лот не найден';
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case OrderStatus.PENDING:
        return 'Ожидает подтверждения';
      case OrderStatus.APPROVED:
        return 'Подтверждён';
      case OrderStatus.PAID:
        return 'Оплачен';
      case OrderStatus.DELIVERED_SVH:
        return 'Доставлен на СВХ';
      case OrderStatus.CUSTOMS:
        return 'На растаможке';
      case OrderStatus.CLEARED:
        return 'Растаможен';
      case OrderStatus.DELIVERING:
        return 'В доставке';
      case OrderStatus.COMPLETED:
        return 'Завершён';
      default:
        return status;
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
