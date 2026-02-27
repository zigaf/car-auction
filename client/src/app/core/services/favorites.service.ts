import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { IFavorite } from '../../models/favorite.model';
import { IPaginatedResponse } from '../../models/lot.model';

@Injectable({ providedIn: 'root' })
export class FavoritesService {
  constructor(private readonly api: ApiService) {}

  getFavorites(
    page?: number,
    limit?: number,
  ): Observable<IPaginatedResponse<IFavorite>> {
    return this.api.get<IPaginatedResponse<IFavorite>>('/favorites', {
      page,
      limit,
    });
  }

  checkFavorite(lotId: string): Observable<{ isFavorite: boolean }> {
    return this.api.get<{ isFavorite: boolean }>(`/favorites/${lotId}/check`);
  }

  addFavorite(lotId: string): Observable<IFavorite> {
    return this.api.post<IFavorite>(`/favorites/${lotId}`);
  }

  removeFavorite(lotId: string): Observable<void> {
    return this.api.delete<void>(`/favorites/${lotId}`);
  }
}
