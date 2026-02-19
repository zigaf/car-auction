import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import {
  ILot,
  ILotFilter,
  IPaginatedResponse,
  ILotStats,
  IBrandCount,
} from '../../models/lot.model';

@Injectable({ providedIn: 'root' })
export class LotService {
  constructor(private readonly api: ApiService) {}

  getAll(filters?: ILotFilter): Observable<IPaginatedResponse<ILot>> {
    const params: Record<string, string | number | undefined> = {};

    if (filters) {
      if (filters.page) params['page'] = filters.page;
      if (filters.limit) params['limit'] = filters.limit;
      if (filters.brand) params['brand'] = filters.brand;
      if (filters.fuelType) params['fuelType'] = filters.fuelType;
      if (filters.yearFrom) params['yearFrom'] = filters.yearFrom;
      if (filters.yearTo) params['yearTo'] = filters.yearTo;
      if (filters.priceFrom) params['priceFrom'] = filters.priceFrom;
      if (filters.priceTo) params['priceTo'] = filters.priceTo;
      if (filters.mileageFrom) params['mileageFrom'] = filters.mileageFrom;
      if (filters.mileageTo) params['mileageTo'] = filters.mileageTo;
      if (filters.country) params['country'] = filters.country;
      if (filters.sort) params['sort'] = filters.sort;
      if (filters.search) params['search'] = filters.search;
    }

    return this.api.get<IPaginatedResponse<ILot>>('/lots', params);
  }

  getById(id: string): Observable<ILot> {
    return this.api.get<ILot>(`/lots/${id}`);
  }

  getBrands(): Observable<IBrandCount[]> {
    return this.api.get<IBrandCount[]>('/lots/brands');
  }

  getStats(): Observable<ILotStats> {
    return this.api.get<ILotStats>('/lots/stats');
  }
}
