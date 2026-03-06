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

  checkFavorite(lotId: string, targetUserId?: string | null): Observable<{ isFavorite: boolean }> {
    const params = targetUserId ? { targetUserId } : undefined;
    return this.api.get<{ isFavorite: boolean }>(`/favorites/${lotId}/check`, params);
  }

  addFavorite(lotId: string, targetUserId?: string): Observable<IFavorite> {
    const body = targetUserId ? { targetUserId } : undefined;
    return this.api.post<IFavorite>(`/favorites/${lotId}`, body);
  }

  removeFavorite(lotId: string, targetUserId?: string | null): Observable<void> {
    const params = targetUserId ? { targetUserId } : undefined;
    return this.api.delete<void>(`/favorites/${lotId}`, params);
  }
}
