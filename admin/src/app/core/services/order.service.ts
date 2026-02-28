import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface IOrder {
  id: string;
  status: string;
  total: number;
  carPrice: number;
  commission: number;
  createdAt: string;
  updatedAt: string;
  lot: {
    id: string;
    title: string;
    brand: string;
    model: string;
    year: number;
  } | null;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  } | null;
}

export interface IOrdersResponse {
  data: IOrder[];
  total: number;
  page: number;
  limit: number;
}

@Injectable({ providedIn: 'root' })
export class OrderService {
  constructor(private readonly api: ApiService) { }

  getOrders(params: {
    page?: number;
    limit?: number;
    status?: string;
  } = {}): Observable<IOrdersResponse> {
    return this.api.get<IOrdersResponse>('/orders', {
      page: params.page ?? 1,
      limit: params.limit ?? 20,
      status: params.status,
    });
  }

  getOrder(id: string): Observable<IOrder> {
    return this.api.get<IOrder>(`/orders/${id}`);
  }

  updateOrderStatus(id: string, status: string): Observable<IOrder> {
    return this.api.patch<IOrder>(`/orders/${id}/status`, { status });
  }
}
