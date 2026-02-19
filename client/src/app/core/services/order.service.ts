import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { IOrder, IOrderStatusHistory } from '../../models/order.model';
import { IPaginatedResponse } from '../../models/lot.model';

@Injectable({ providedIn: 'root' })
export class OrderService {
  constructor(private readonly api: ApiService) {}

  getMyOrders(
    page?: number,
    limit?: number,
  ): Observable<IPaginatedResponse<IOrder>> {
    return this.api.get<IPaginatedResponse<IOrder>>('/orders', {
      page,
      limit,
    });
  }

  getOrderById(id: string): Observable<IOrder> {
    return this.api.get<IOrder>(`/orders/${id}`);
  }

  getOrderTracking(id: string): Observable<IOrderStatusHistory[]> {
    return this.api.get<IOrderStatusHistory[]>(`/orders/${id}/tracking`);
  }
}
