import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface IBalanceTransaction {
  id: string;
  userId: string;
  type: string;
  amount: number;
  balanceAfter: number;
  description: string;
  orderId: string | null;
  lotId: string | null;
  bidId: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface ITransactionsResponse {
  data: IBalanceTransaction[];
  total: number;
  page: number;
  limit: number;
}

export interface IAdjustPayload {
  amount: number;
  type: 'deposit' | 'refund' | 'car_payment' | 'commission' | 'delivery' | 'customs';
  description: string;
  orderId?: string;
}

@Injectable({ providedIn: 'root' })
export class BalanceService {
  constructor(private readonly api: ApiService) {}

  getUserBalance(userId: string): Observable<{ balance: number }> {
    return this.api.get<{ balance: number }>(`/balance/user/${userId}`);
  }

  getUserTransactions(
    userId: string,
    page = 1,
    limit = 20,
  ): Observable<ITransactionsResponse> {
    return this.api.get<ITransactionsResponse>(
      `/balance/user/${userId}/transactions`,
      { page, limit },
    );
  }

  adjustBalance(userId: string, payload: IAdjustPayload): Observable<IBalanceTransaction> {
    return this.api.post<IBalanceTransaction>(`/balance/${userId}/adjust`, payload);
  }
}
