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
  year: number;
  mileage: number;
  fuelType: string;
  status: string;
  startingBid: number;
  currentBid: number | null;
  auctionStart: string | null;
  auctionEnd: string | null;
  images: ILotImage[];
  createdAt: string;
}

export interface ILotsResponse {
  data: ILot[];
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
}
