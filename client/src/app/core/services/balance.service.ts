import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import {
  IBalanceResponse,
  IBalanceTransaction,
} from '../../models/balance.model';
import { IPaginatedResponse } from '../../models/lot.model';

@Injectable({ providedIn: 'root' })
export class BalanceService {
  constructor(private readonly api: ApiService) {}

  getBalance(): Observable<IBalanceResponse> {
    return this.api.get<IBalanceResponse>('/balance');
  }

  getTransactions(
    page?: number,
    limit?: number,
  ): Observable<IPaginatedResponse<IBalanceTransaction>> {
    return this.api.get<IPaginatedResponse<IBalanceTransaction>>(
      '/balance/transactions',
      { page, limit },
    );
  }
}
