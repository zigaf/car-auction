import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { ILot, IPaginatedResponse } from '../../models/lot.model';
import { IBid, IPlaceBidResult } from '../../models/auction.model';

@Injectable({ providedIn: 'root' })
export class AuctionService {
  constructor(private readonly api: ApiService) { }

  placeBid(lotId: string, amount: number, idempotencyKey: string): Observable<IPlaceBidResult> {
    return this.api.post<IPlaceBidResult>('/bids', { lotId, amount, idempotencyKey });
  }

  buyNow(lotId: string, traderId?: string | null): Observable<{ bid: IBid; lot: ILot }> {
    const body: Record<string, string> = { lotId };
    if (traderId) body['traderId'] = traderId;
    return this.api.post<{ bid: IBid; lot: ILot }>('/bids/buy-now', body);
  }

  getBidsByLot(lotId: string, page: number = 1, limit: number = 20): Observable<IPaginatedResponse<IBid>> {
    return this.api.get<IPaginatedResponse<IBid>>(`/bids/lot/${lotId}`, { page, limit });
  }

  getMyBids(page: number = 1, limit: number = 20): Observable<IPaginatedResponse<IBid>> {
    return this.api.get<IPaginatedResponse<IBid>>('/bids/my', { page, limit });
  }

  placePreBid(lotId: string, maxAutoBid: number, idempotencyKey: string): Observable<IPlaceBidResult> {
    return this.api.post<IPlaceBidResult>('/bids/pre-bid', { lotId, maxAutoBid, idempotencyKey });
  }

  getRecentGlobalBids(limit: number = 50): Observable<any[]> {
    return this.api.get<any[]>('/bids/recent', { limit });
  }

  getActiveLots(): Observable<ILot[]> {
    return this.api.get<ILot[]>('/auction/active');
  }
}
