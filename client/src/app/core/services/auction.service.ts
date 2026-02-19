import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { ILot, IPaginatedResponse } from '../../models/lot.model';
import { IBid, IPlaceBidResult } from '../../models/auction.model';

@Injectable({ providedIn: 'root' })
export class AuctionService {
  constructor(private readonly api: ApiService) {}

  placeBid(lotId: string, amount: number, idempotencyKey: string): Observable<IPlaceBidResult> {
    return this.api.post<IPlaceBidResult>('/bids', { lotId, amount, idempotencyKey });
  }

  buyNow(lotId: string): Observable<{ bid: IBid; lot: ILot }> {
    return this.api.post<{ bid: IBid; lot: ILot }>('/bids/buy-now', { lotId });
  }

  getBidsByLot(lotId: string, page: number = 1, limit: number = 20): Observable<IPaginatedResponse<IBid>> {
    return this.api.get<IPaginatedResponse<IBid>>(`/bids/lot/${lotId}`, { page, limit });
  }

  getMyBids(page: number = 1, limit: number = 20): Observable<IPaginatedResponse<IBid>> {
    return this.api.get<IPaginatedResponse<IBid>>('/bids/my', { page, limit });
  }

  getActiveLots(): Observable<ILot[]> {
    return this.api.get<ILot[]>('/auction/active');
  }
}
