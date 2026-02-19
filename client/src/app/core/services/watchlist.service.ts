import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { IWatchlistItem, IAddWatchlistItem } from '../../models/watchlist.model';

@Injectable({ providedIn: 'root' })
export class WatchlistService {
  constructor(private readonly api: ApiService) {}

  getWatchlist(): Observable<IWatchlistItem[]> {
    return this.api.get<IWatchlistItem[]>('/watchlist');
  }

  addToWatchlist(data: IAddWatchlistItem): Observable<IWatchlistItem> {
    return this.api.post<IWatchlistItem>('/watchlist', data);
  }

  removeFromWatchlist(id: string): Observable<void> {
    return this.api.delete<void>(`/watchlist/${id}`);
  }
}
