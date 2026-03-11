import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { IReview, IReviewStats } from '../../models/review.model';

@Injectable({ providedIn: 'root' })
export class ReviewsService {
  constructor(private readonly api: ApiService) {}

  getReviews(
    page?: number,
    limit?: number,
  ): Observable<{ data: IReview[]; total: number; page: number; limit: number }> {
    return this.api.get('/reviews', { page, limit });
  }

  getStats(): Observable<IReviewStats> {
    return this.api.get('/reviews/stats');
  }

  createReview(body: { rating: number; text: string }): Observable<IReview> {
    return this.api.post('/reviews', body);
  }
}
