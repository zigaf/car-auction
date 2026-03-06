import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { IUser } from '../../models/user.model';
import { IFavorite } from '../../models/favorite.model';
import { IPaginatedResponse } from '../../models/lot.model';

@Injectable({ providedIn: 'root' })
export class BrokerService {
  constructor(private readonly api: ApiService) {}

  getMyTraders(): Observable<IUser[]> {
    return this.api.get<IUser[]>('/broker/traders');
  }

  getTraderFavorites(
    traderId: string,
    page?: number,
    limit?: number,
  ): Observable<IPaginatedResponse<IFavorite>> {
    return this.api.get<IPaginatedResponse<IFavorite>>(
      `/broker/traders/${traderId}/favorites`,
      { page, limit },
    );
  }

  addToTraderFavorite(traderId: string, lotId: string): Observable<IFavorite> {
    return this.api.post<IFavorite>(
      `/broker/traders/${traderId}/favorites/${lotId}`,
    );
  }

  removeFromTraderFavorite(traderId: string, lotId: string): Observable<void> {
    return this.api.delete<void>(
      `/broker/traders/${traderId}/favorites/${lotId}`,
    );
  }
}
