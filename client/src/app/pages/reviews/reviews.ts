import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReviewsService } from '../../core/services/reviews.service';
import { StateService } from '../../core/services/state.service';
import { IReview, IReviewStats } from '../../models/review.model';

@Component({
  selector: 'app-reviews',
  standalone: true,
  imports: [RouterLink, DecimalPipe, DatePipe, FormsModule],
  templateUrl: './reviews.html',
  styleUrl: './reviews.scss',
})
export class ReviewsComponent implements OnInit {
  private readonly reviewsService = inject(ReviewsService);
  private readonly stateService = inject(StateService);

  reviews: IReview[] = [];
  stats: IReviewStats | null = null;
  loading = true;
  loadingMore = false;
  error = '';
  page = 1;
  limit = 20;
  total = 0;

  // Modal state
  showModal = false;
  modalRating = 0;
  modalHoverRating = 0;
  modalText = '';
  submitting = false;
  submitSuccess = false;

  get hasMore(): boolean {
    return this.reviews.length < this.total;
  }

  get isAuthenticated(): boolean {
    return this.stateService.snapshot.isAuthenticated;
  }

  get userName(): string {
    const user = this.stateService.snapshot.user;
    if (!user) return '';
    return `${user.firstName} ${user.lastName}`.trim();
  }

  ngOnInit(): void {
    this.loadReviews();
    this.loadStats();
  }

  private loadReviews(): void {
    this.loading = true;
    this.error = '';
    this.reviewsService.getReviews(1, this.limit).subscribe({
      next: (res) => {
        this.reviews = res.data;
        this.total = res.total;
        this.page = 1;
        this.loading = false;
      },
      error: () => {
        this.error = 'Не удалось загрузить отзывы';
        this.loading = false;
      },
    });
  }

  private loadStats(): void {
    this.reviewsService.getStats().subscribe({
      next: (stats) => {
        this.stats = stats;
      },
    });
  }

  loadMore(): void {
    if (this.loadingMore || !this.hasMore) return;
    this.loadingMore = true;
    this.page++;
    this.reviewsService.getReviews(this.page, this.limit).subscribe({
      next: (res) => {
        this.reviews = [...this.reviews, ...res.data];
        this.total = res.total;
        this.loadingMore = false;
      },
      error: () => {
        this.page--;
        this.loadingMore = false;
      },
    });
  }

  openModal(): void {
    this.showModal = true;
    this.modalRating = 0;
    this.modalHoverRating = 0;
    this.modalText = '';
    this.submitting = false;
    this.submitSuccess = false;
  }

  closeModal(): void {
    this.showModal = false;
  }

  setRating(rating: number): void {
    this.modalRating = rating;
  }

  setHoverRating(rating: number): void {
    this.modalHoverRating = rating;
  }

  submitReview(): void {
    if (this.submitting || this.modalRating === 0 || !this.modalText.trim()) return;
    this.submitting = true;

    this.reviewsService.createReview({
      rating: this.modalRating,
      text: this.modalText.trim(),
    }).subscribe({
      next: (review) => {
        this.reviews = [review, ...this.reviews];
        this.total++;
        this.submitting = false;
        this.submitSuccess = true;
        this.loadStats();
        setTimeout(() => this.closeModal(), 1500);
      },
      error: () => {
        this.submitting = false;
      },
    });
  }

  getInitial(name: string): string {
    return name.charAt(0).toUpperCase();
  }

  getStars(rating: number): number[] {
    return Array.from({ length: 5 }, (_, i) => i + 1);
  }

  getPercentage(count: number): number {
    if (!this.stats || this.stats.total === 0) return 0;
    return Math.round((count / this.stats.total) * 100);
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const months = [
      'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
      'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
    ];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  }
}
