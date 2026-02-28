import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface ILotImage {
  id: string;
  url: string;
}

export interface ILot {
  id: string;
  title: string;
  brand: string;
  model: string;
  derivative: string | null;
  year: number;
  mileage: number;
  fuelType: string;
  status: string;
  startingBid: number;
  currentPrice: number | null;
  /** @deprecated kept for backwards compat with list view */
  currentBid: number | null;
  reservePrice: number | null;
  buyNowPrice: number | null;
  bidStep: number;
  auctionType: string | null;
  auctionStartAt: string | null;
  auctionEndAt: string | null;
  /** @deprecated use auctionStartAt */
  auctionStart: string | null;
  /** @deprecated use auctionEndAt */
  auctionEnd: string | null;
  winnerId: string | null;
  vin: string | null;
  description: string | null;
  saleLocation: string | null;
  vehicleLocation: string | null;
  conditionReportUrl: string | null;
  cosmeticGrade: string | null;
  mechanicalGrade: string | null;
  images: ILotImage[];
  isPaused: boolean;
  pausedRemainingMs: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ILotsResponse {
  data: ILot[];
  total: number;
  page: number;
  limit: number;
}

export interface IBid {
  id: string;
  lotId: string;
  userId: string;
  amount: number;
  isPreBid: boolean;
  createdAt: string;
}

export interface IBidsResponse {
  data: IBid[];
  total: number;
  page: number;
  limit: number;
}

@Injectable({ providedIn: 'root' })
export class LotService {
  constructor(private readonly api: ApiService) {}

  getLots(params: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  } = {}): Observable<ILotsResponse> {
    return this.api.get<ILotsResponse>('/lots', {
      page: params.page ?? 1,
      limit: params.limit ?? 20,
      status: params.status,
      search: params.search,
    });
  }

  getLot(id: string): Observable<ILot> {
    return this.api.get<ILot>(`/lots/${id}`);
  }

  updateLot(id: string, data: Partial<ILot>): Observable<ILot> {
    return this.api.patch<ILot>(`/lots/${id}`, data);
  }

  updateStatus(id: string, status: string): Observable<ILot> {
    return this.api.patch<ILot>(`/lots/${id}/status`, { status });
  }

  deleteLot(id: string): Observable<void> {
    return this.api.delete<void>(`/lots/${id}`);
  }

  scheduleLot(id: string, payload: { auctionStartAt: string; auctionEndAt: string; auctionType?: string }): Observable<ILot> {
    return this.api.patch<ILot>(`/lots/${id}/schedule`, payload);
  }

  getBids(lotId: string, page = 1, limit = 20): Observable<IBidsResponse> {
    return this.api.get<IBidsResponse>(`/bids/lot/${lotId}`, { page, limit });
  }

  getActiveLots(): Observable<ILot[]> {
    return this.api.get<ILot[]>('/auction/active');
  }

  pauseAuction(id: string): Observable<ILot> {
    return this.api.post<ILot>(`/lots/${id}/pause`);
  }

  resumeAuction(id: string): Observable<ILot> {
    return this.api.post<ILot>(`/lots/${id}/resume`);
  }

  extendAuction(id: string, minutes: number): Observable<ILot> {
    return this.api.post<ILot>(`/lots/${id}/extend`, { minutes });
  }

  rollbackBid(bidId: string): Observable<{ lotId: string; newCurrentPrice: number }> {
    return this.api.delete<{ lotId: string; newCurrentPrice: number }>(`/admin/bids/${bidId}`);
  }
}
